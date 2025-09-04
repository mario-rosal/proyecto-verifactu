/// <reference types="jest" />
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { HealthService } from '../src/health/health.service';


// Fake que evita tocar DB en el test
class FakeHealthService {
  async check() {
    return { status: 'ok', db: 'ok' as const };
  }
}

describe('GET /healthz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(HealthService)
      .useClass(FakeHealthService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde 200 con {status:"ok"}', async () => {
    await request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveProperty('status', 'ok');
        // db puede ser "ok" o "ko" en real; aquí forzamos "ok" por el fake
        expect(body).toHaveProperty('db', 'ok'); // <- dejar 'ok'
      });
  });
});