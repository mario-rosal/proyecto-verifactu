import { Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeysService } from './api-keys.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from '../event-log/event-log.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

@Controller('connector-package')
export class ConnectorPackageController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    @InjectRepository(EventLog)
    private readonly eventLogRepo: Repository<EventLog>,
  ) {}

  /**
   * POST /connector-package (JWT-only)
   * - Genera API Key dedicada
   * - Empaqueta binarios del conector + config.json con esa API Key y tenantId
   * - Devuelve application/zip por streaming
   * - Registra CONFIG_UPDATE { action: CONNECTOR_PACKAGE_GENERATED }
   */
  @Post()
  async createConnectorPackage(@Req() req: any, @Res() res: Response) {
    const authHeader = (req.headers?.authorization || '') as string;
    let tenantId: number = Number(req.user?.tenantId);
    if (!Number.isInteger(tenantId)) {
      try {
        const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const payloadB64 = raw.split('.')[1] || '';
        const json = payloadB64 ? JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) : {};
        const claim = (json?.tenantId ?? json?.tenant_id ?? json?.tid);
        if (claim !== undefined && claim !== null) {
          tenantId = Number(claim);
        }
      } catch {
        /* noop */
      }
    }
    if (!Number.isInteger(tenantId)) {
      throw new UnauthorizedException('Tenant no resuelto desde JWT');
    }

    // 1) Generar API Key
    const { apiKey } = await this.apiKeysService.createKey(tenantId);

    // 2) Construir config.json en memoria
    const config = {
      apiKey,
      tenantId,
    };
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2), 'utf8');

    // 3) Preparar ZIP (archiver)
    res.status(200).setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="verifactu-connector-${tenantId}.zip"`,
    );

    const archive = archiver.create('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      // Importante: finalizar respuesta en caso de error de stream
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);

    // 3.a) Añadir config.json
    archive.append(configBuffer, { name: 'config.json' });

    // 3.b) Incluir instalador del conector (robusto en monorepo Windows/Linux)
    // Ruta base esperada: <monorepo>/verifactu-printer-connector/bin
    const tryDirs = [
      // si Nest corre desde TS (ts-node): __dirname = verifactu-bff/src/api-keys
      path.resolve(__dirname, '..', '..', '..', 'verifactu-printer-connector', 'bin'),
      // si Nest corre desde dist:
      path.resolve(__dirname, '..', '..', '..', '..', 'verifactu-printer-connector', 'bin'),
      // cwd del proceso (normalmente verifactu-bff):
      path.resolve(process.cwd(), '..', 'verifactu-printer-connector', 'bin'),
    ];

    const firstExistingDir = tryDirs.find(d => {
      try { return fs.existsSync(d) && fs.statSync(d).isDirectory(); } catch { return false; }
    });

    let addedExecutable = false;
    if (firstExistingDir) {
      // Buscar ejecutables .exe en la carpeta bin
      try {
        const entries = fs.readdirSync(firstExistingDir, { withFileTypes: true });
        const exes = entries
          .filter(e => e.isFile() && /\.exe$/i.test(e.name))
          .map(e => path.join(firstExistingDir, e.name));
        if (exes.length > 0) {
          // Añadir cada .exe explícitamente bajo bin/
          for (const exePath of exes) {
            const name = 'bin/' + path.basename(exePath);
            archive.file(exePath, { name });
          }
          addedExecutable = true;
        } else {
          // Si no hay .exe, incluir toda la carpeta (p.ej. win-unpacked) por si el usuario quiere portable
          archive.directory(firstExistingDir, 'bin');
        }
      } catch {
        // fallback abajo
      }
    }
    if (!firstExistingDir || !addedExecutable) {
      // Mock de cortesía si aún no existen binarios .exe
      archive.append(
        Buffer.from(
          'Binarios no encontrados. Asegúrate de compilar el conector en verifactu-printer-connector/bin (npm run dist:win).',
          'utf8',
        ),
        { name: 'bin/README.txt' },
      );
    }

    // 4) Registrar evento en event_log
    await this.eventLogRepo
      .createQueryBuilder()
      .insert()
      .into(EventLog)
      .values({
        tenantId,
        eventType: 'CONFIG_UPDATE',
        details: { action: 'CONNECTOR_PACKAGE_GENERATED' },
      })
      .execute();

    // 5) Cerrar el ZIP (stream). Nest enviará el stream al cliente.
    await archive.finalize();
  }
}
