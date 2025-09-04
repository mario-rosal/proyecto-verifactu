import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { APP_GUARD } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';

// SUT: controlador que expone la ruta pública por ticket
import { ConnectorPackageController } from '../src/api-keys/connector-package.controller';

// Dependencias del controlador (mockeadas)
import { ApiKeysService } from '../src/api-keys/api-keys.service';
import { EventLog } from '../src/event-log/event-log.entity';

// Guard global bajo prueba + guard de rate-limit (anulado)
import { ApiKeyGuard } from '../src/auth/apikey.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Mock mínimos
const apiKeysServiceMock = { createKey: jest.fn() };
const eventLogRepoMock = {};
const authServiceMock = { validateApiKey: jest.fn() }; // el guard lo inyecta pero no lo usará por whitelist

describe('ApiKeyGuard whitelist → GET /v1/connector-package/tickets/:token (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{
        ttl: 60000,
        limit: 10,
      }])],
      controllers: [ConnectorPackageController],
      providers: [
        // mocks requeridos por el controlador
        { provide: ApiKeysService, useValue: apiKeysServiceMock },
        { provide: getRepositoryToken(EventLog), useValue: eventLogRepoMock },

        // Guard global bajo prueba
        { provide: APP_GUARD, useClass: ApiKeyGuard },

        // Dependencia del ApiKeyGuard
        { provide: require('../src/auth/auth.service').AuthService, useValue: authServiceMock },
      ],
    })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

    app = moduleRef.createNestApplication();
    // Replicar el prefix global de main.ts para que el path del guard coincida
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('debe permitir el paso del guard sin Authorization y responder 401 "Token inválido" del controlador', async () => {
    await request(app.getHttpServer())
      .get('/v1/connector-package/tickets/TESTTOKEN123')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toHaveProperty('message', 'Token inválido');
        expect(body).toHaveProperty('statusCode', 401);
      });
  });
});
