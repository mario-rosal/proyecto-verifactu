import { Controller, Post, Get, Param, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeysService } from './api-keys.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from '../event-log/event-log.entity';
import * as fs from 'fs';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import * as path from 'path';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import * as os from 'os';
import * as crypto from 'crypto';

@UseGuards(ThrottlerGuard)
@Controller('connector-package')
export class ConnectorPackageController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    @InjectRepository(EventLog)
    private readonly eventLogRepo: Repository<EventLog>,
  ) {}

  // ---- helpers de tickets (HMAC SHA-256, exp unix-ms) ----
  private ticketSecret(): Buffer {
    const raw = process.env.DOWNLOAD_TICKET_SECRET || 'change-me-dev-secret';
    return Buffer.from(raw, 'utf8');
  }
  private ticketSecretNext(): Buffer | null {
    const raw = process.env.DOWNLOAD_TICKET_SECRET_NEXT;
    if (!raw || !raw.length) return null;
    return Buffer.from(raw, 'utf8');
  }
  private b64u(buf: Buffer): string {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  private unb64u(str: string): Buffer {
    const pad = 4 - (str.length % 4 || 4);
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    return Buffer.from(b64, 'base64');
  }
  private signTicket(payload: object): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const sig = crypto.createHmac('sha256', this.ticketSecret()).update(body).digest();
    return `${this.b64u(body)}.${this.b64u(sig)}`;
  }
  private verifyTicket(token: string): any {
    const [b, s] = token.split('.');
    if (!b || !s) throw new UnauthorizedException('Token inválido');
    const body = this.unb64u(b);
    const got = this.unb64u(s);

    // 1º intento: secreto actual
    const expect1 = crypto.createHmac('sha256', this.ticketSecret()).update(body).digest();
    if (!crypto.timingSafeEqual(expect1, got)) {
      // 2º intento: secreto de rotación (si existe y es suficientemente largo)
      const next = this.ticketSecretNext();
      if (!next || next.length < 24) {
        throw new UnauthorizedException('Firma inválida');
      }
      const expect2 = crypto.createHmac('sha256', next).update(body).digest();
      if (!crypto.timingSafeEqual(expect2, got)) {
        throw new UnauthorizedException('Firma inválida');
      }
    }
    const json = JSON.parse(body.toString('utf8'));
    if (typeof json.exp !== 'number' || Date.now() > json.exp) throw new UnauthorizedException('Token expirado');
    return json;
  }

  /**
   * POST /connector-package (JWT-only)
   * - Genera API Key dedicada
   * - Empaqueta binarios del conector + config.json con esa API Key y tenantId
   * - Devuelve application/zip por streaming
   * - Registra CONFIG_UPDATE { action: CONNECTOR_PACKAGE_GENERATED }
   */
  // 3 req/min (ttl en ms)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
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

    // Añadir únicamente el/los instalador(es) .exe
    const binPath = path.join(__dirname, '../../../verifactu-printer-connector/bin');
    if (fs.existsSync(binPath)) {
      const files = fs.readdirSync(binPath);
      const exeFiles = files.filter(f => f.endsWith('.exe'));
      exeFiles.forEach(exeFile => {
        archive.file(path.join(binPath, exeFile), { name: exeFile });
      });
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

  /**
   * POST /connector-package/tickets (JWT-only)
   * - Genera API Key y prepara ZIP temporal
   * - Devuelve { url, filename, size, expiresAt } con token firmado (expira)
   */
  // 5 req/min (ttl en ms)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('tickets')
  async createDownloadTicket(@Req() req: any, @Res() res: Response) {
    const authHeader = (req.headers?.authorization || '') as string;
    let tenantId: number = Number(req.user?.tenantId);
    if (!Number.isInteger(tenantId)) {
      try {
        const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        const payloadB64 = raw.split('.')[1] || '';
        const json = payloadB64 ? JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) : {};
        const claim = (json?.tenantId ?? json?.tenant_id ?? json?.tid);
        if (claim !== undefined && claim !== null) tenantId = Number(claim);
      } catch { /* noop */ }
    }
    if (!Number.isInteger(tenantId)) throw new UnauthorizedException('Tenant no resuelto desde JWT');

    // Generar API Key
    const { apiKey } = await this.apiKeysService.createKey(tenantId);

    // config.json
    const config = { apiKey, tenantId };
    const configBuffer = Buffer.from(JSON.stringify(config, null, 2), 'utf8');

    // ZIP temporal
    const tmpName = `verifactu-connector-${tenantId}-${Date.now()}.zip`;
    const tmpPath = path.join(os.tmpdir(), tmpName);
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(tmpPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      out.on('close', () => resolve());
      out.on('error', reject);
      archive.on('error', reject);
      archive.pipe(out);
      archive.append(configBuffer, { name: 'config.json' });
      const binPath = path.join(__dirname, '../../../verifactu-printer-connector/bin');
      if (fs.existsSync(binPath)) {
        const files = fs.readdirSync(binPath);
        const exeFiles = files.filter(f => f.endsWith('.exe'));
        exeFiles.forEach(exeFile => {
          archive.file(path.join(binPath, exeFile), { name: exeFile });
        });
      }
      archive.finalize().catch(reject);
    });

    // Log
    await this.eventLogRepo
      .createQueryBuilder()
      .insert()
      .into(EventLog)
      .values({
        tenantId,
        eventType: 'CONFIG_UPDATE',
        details: { action: 'CONNECTOR_PACKAGE_GENERATED', ticket: true },
      })
      .execute();

    const stat = fs.statSync(tmpPath);
    const expMs = Date.now() + 10 * 60 * 1000; // 10 min
    const token = this.signTicket({ tenantId, p: tmpName, exp: expMs });
    const urlPath = `/v1/connector-package/tickets/${encodeURIComponent(token)}`;

    res.status(201).json({
      url: urlPath,
      filename: `verifactu-connector-${tenantId}.zip`,
      size: stat.size,
      expiresAt: expMs,
    });
  }

  /**
   * GET /connector-package/tickets/:token
   * - Valida token y expiración
   * - Sirve el ZIP y borra el artefacto temporal al finalizar
   */
  // 10 req/min (ttl en ms)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('tickets/:token')
  async downloadByTicket(@Param('token') token: string, @Res() res: Response) {
    const data = this.verifyTicket(token);
    const tmpPath = path.join(os.tmpdir(), data.p);
    if (!fs.existsSync(tmpPath)) throw new UnauthorizedException('Artefacto no disponible');
    const stat = fs.statSync(tmpPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="verifactu-connector-${data.tenantId}.zip"`);
    res.setHeader('Content-Length', String(stat.size));
    const stream = fs.createReadStream(tmpPath);
    stream.pipe(res);
    stream.on('close', () => { fs.unlink(tmpPath, () => {}); });
    stream.on('error', () => { try { fs.unlinkSync(tmpPath); } catch {} res.end(); });
  }
}