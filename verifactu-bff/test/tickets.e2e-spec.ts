/// <reference types="jest" />
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConnectorPackageController } from '../src/api-keys/connector-package.controller';
import { ApiKeysService } from '../src/api-keys/api-keys.service';
import { EventLog } from '../src/event-log/event-log.entity';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// --- Fakes mínimos para no tocar DB ni lógica de producción ---
class FakeApiKeysService {
  async createKey(tenantId: number) {
    return { apiKey: `test-key-${tenantId}` };
  }
}

function fakeEventLogRepo() {
  const qb = {
    insert() { return this; },
    into() { return this; },
    values() { return this; },
    execute: jest.fn().mockResolvedValue({}),
  };
  return {
    createQueryBuilder: () => qb,
  };
}

// --- Helpers de firma (base64url + HMAC SHA-256) y archivos temporales ---
function b64u(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function signTicket(payload: any, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(body).digest();
  return `${b64u(body)}.${b64u(sig)}`;
}

function tmpZipName(tenantId: number) {
  return `verifactu-connector-${tenantId}-${Date.now()}.zip`;
}

function writeTempFile(tmpName: string, bytes = 1024): string {
  const p = path.join(os.tmpdir(), tmpName);
  const buf = Buffer.alloc(bytes, 1); // no necesita ser ZIP real, solo >0 bytes
  fs.writeFileSync(p, buf);
  return p;
}

async function waitForGone(filePath: string, timeoutMs = 1000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!fs.existsSync(filePath)) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return !fs.existsSync(filePath);
}

describe('E2E Tickets de descarga (GET /v1/connector-package/tickets/:token)', () => {
  let app: INestApplication;
  const SECRET = 'test-secret-0123456789';

  beforeAll(async () => {
    // Configurar secretos de ticket para el test
    process.env.DOWNLOAD_TICKET_SECRET = SECRET;
    delete process.env.DOWNLOAD_TICKET_SECRET_NEXT;

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Throttler requerido por @UseGuards(ThrottlerGuard) en el controller
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      controllers: [ConnectorPackageController],
      providers: [
        { provide: ApiKeysService, useClass: FakeApiKeysService },
        { provide: getRepositoryToken(EventLog), useValue: fakeEventLogRepo() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // El BFF real usa prefijo global 'v1' (ver src/main.ts)
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('✅ Éxito: 200 + Content-Type zip + Content-Length > 0 y borra el archivo', async () => {
    const tenantId = 321;
    const name = tmpZipName(tenantId);
    const tmpPath = writeTempFile(name, 2048);
    const stat = fs.statSync(tmpPath);

    const token = signTicket(
      { tenantId, p: name, exp: Date.now() + 5 * 60_000 },
      SECRET,
    );

    const res = await request(app.getHttpServer())
      .get(`/v1/connector-package/tickets/${encodeURIComponent(token)}`)
      .expect(200);

    expect(res.header['content-type']).toMatch(/application\/zip/);
    // Debe informar exactamente el tamaño del archivo
    expect(Number(res.header['content-length'])).toBe(stat.size);
    expect(Number(res.header['content-length'])).toBeGreaterThan(0);
    // Verificar que el archivo se borró al finalizar el stream
    const gone = await waitForGone(tmpPath, 1500);
    expect(gone).toBe(true);
  });

  it('♻️ Reuso tras una descarga: 401 "Artefacto no disponible"', async () => {
    const tenantId = 654;
    const name = tmpZipName(tenantId);
    const tmpPath = writeTempFile(name, 512);
    const token = signTicket(
      { tenantId, p: name, exp: Date.now() + 5 * 60_000 },
      SECRET,
    );

    // Primera descarga (éxito) provoca borrado
    await request(app.getHttpServer())
      .get(`/v1/connector-package/tickets/${encodeURIComponent(token)}`)
      .expect(200);
    const gone = await waitForGone(path.join(os.tmpdir(), name), 1500);
    expect(gone).toBe(true);

    // Segunda descarga (mismo token) debe fallar por falta de artefacto
    const res2 = await request(app.getHttpServer())
      .get(`/v1/connector-package/tickets/${encodeURIComponent(token)}`)
      .expect(401);
    expect(res2.body).toHaveProperty('message', 'Artefacto no disponible');
  });

  it('❌ Firma inválida: 401 "Firma inválida"', async () => {
    const tenantId = 777;
    const name = tmpZipName(tenantId);
    // No creamos archivo: la verificación de firma falla antes de mirar el disco
    const badToken = signTicket(
      { tenantId, p: name, exp: Date.now() + 60_000 },
      'wrong-secret-not-matching',
    );

    const res = await request(app.getHttpServer())
      .get(`/v1/connector-package/tickets/${encodeURIComponent(badToken)}`)
      .expect(401);
    expect(res.body).toHaveProperty('message', 'Firma inválida');
  });

  it('⌛ Token expirado: 401 "Token expirado"', async () => {
    const tenantId = 888;
    const name = tmpZipName(tenantId);
    const token = signTicket(
      { tenantId, p: name, exp: Date.now() - 1_000 },
      SECRET,
    );
    const res = await request(app.getHttpServer())
      .get(`/v1/connector-package/tickets/${encodeURIComponent(token)}`)
      .expect(401);
    expect(res.body).toHaveProperty('message', 'Token expirado');
  });

  it('🔓 Ruta pública (whitelist): sin JWT/x-api-key y token malformado → 401 "Token inválido"', async () => {
    // Sin "Authorization" ni "x-api-key". El error debe ser por token, no por guardias.
    const res = await request(app.getHttpServer())
      .get('/v1/connector-package/tickets/abc') // sin punto → malformado
      .expect(401);
    expect(res.body).toHaveProperty('message', 'Token inválido');
  });
});