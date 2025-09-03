import { Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeysService } from './api-keys.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from '../event-log/event-log.entity';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

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
    // Permite forzar variante: web | full | config
    const variant = (req.query?.variant || '').toString().toLowerCase();

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

    // 3) Construir ZIP en memoria (sin streaming directo a res)
    const chunks: Buffer[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    const archive = archiver('zip', { zlib: { level: 9 } });
    const finished = new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      archive.on('error', reject);
    });
    archive.pipe(stream);

    // 3.a) Añadir config.json al ZIP
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

    // Selección única de artefacto: preferir "WebSetup" (nsis-web) si existe, luego "Setup" completo.
    let addedExecutable = false;
    if (variant !== 'config' && firstExistingDir) {
      try {
        const entries = fs.readdirSync(firstExistingDir, { withFileTypes: true });
        const files = entries.filter(e => e.isFile()).map(e => e.name);

        // Candidatos
        const webExe = files.find(n => /WebSetup.*\.exe$/i.test(n) || /nsis[-_.]?web.*\.exe$/i.test(n));
        const fullExe = files.find(n => /Setup.*\.exe$/i.test(n));

        let chosen: string | null = null;
        if (variant === 'web') {
          chosen = webExe || null;
        } else if (variant === 'full') {
          // elegir "full", pero si no existe, caer al web
          chosen = fullExe || webExe || null;
        } else {
          // por defecto: preferir web si está disponible
          chosen = webExe || fullExe || null;
        }

        if (chosen) {
          const abs = path.join(firstExistingDir, chosen);
          archive.file(abs, { name: 'bin/' + path.basename(abs) });
          addedExecutable = true;
        } else {
          // No hay .exe; incluir carpeta por si existe portable (win-unpacked) u otros binarios
          archive.directory(firstExistingDir, 'bin');
        }
      } catch {
        // fallback abajo
      }
    }
    if (!firstExistingDir || variant === 'config') {
      // Solo config / o no existe bin: incluir README de cortesía
      archive.append(
        Buffer.from(
          'No se adjuntó instalador. Usa el instalador existente y coloca este config.json en la ruta indicada.\n',
          'utf8',
        ),
        { name: 'bin/README.txt' },
      );
    } else if (!addedExecutable) {
      // No se pudo elegir ejecutable, añadir README explicativo
      archive.append(
        Buffer.from(
          'Binarios no encontrados. Compila el conector (electron-builder) en verifactu-printer-connector/bin.\n',
          'utf8',
        ),
        { name: 'bin/README.txt' },
      );
    }

    // 4) Registrar evento en event_log (antes de cerrar el ZIP)
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

    // 5) Finalizar ZIP en memoria y enviar con Content-Length
    await archive.finalize();
    await finished;
    const buffer = Buffer.concat(chunks);
    res.status(200);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="verifactu-connector-${tenantId}.zip"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}