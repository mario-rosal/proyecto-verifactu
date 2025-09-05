// Ubicación: verifactu-bff/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // API versionada para estabilizar contratos (prod-ready)
  app.setGlobalPrefix('v1');

  // --- Security headers (Helmet) ---
  // Política: aplicar SOLO lo requerido por la tarea y sin tocar CORS.
  // - CSP: laxa en dev para no romper dashboard; más estricta en prod.
  // - X-Frame-Options (via frameguard): DENY (o equivalente en CSP via frame-ancestors).
  // - Referrer-Policy: strict-origin-when-cross-origin.
  // - HSTS: solo en producción.
  const nodeEnv =
    process.env.NODE_ENV ||
    (config.get<string>('NODE_ENV') as string) ||
    'development';
  const isProd = nodeEnv === 'production';

  // Content Security Policy
  app.use(
    helmet.contentSecurityPolicy({
      // useDefaults añade: default-src 'self' y otras seguras.
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // En dev permitimos inline/eval para facilitar el dashboard local.
        // En prod, más estricto (sin 'unsafe-eval').
        scriptSrc: isProd
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: isProd
          ? ["'self'", "'unsafe-inline'"]
          : ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        // Bloquea embedding no autorizado (equivale a X-Frame-Options: DENY).
        frameAncestors: ["'none'"],
        // Solo en prod se puede optar por upgrade de peticiones http->https
        // upgradeInsecureRequests: isProd ? [] : null, // (opcional, comentado)
      },
    }),
  );

  // X-Frame-Options: DENY (defensa adicional a frame-ancestors).
  app.use(helmet.frameguard({ action: 'deny' }));

  // Referrer-Policy razonable
  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

  // HSTS solo en producción (HTTPS)
  if (isProd) {
    app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: false }));
  }
  // --- /Security headers ---

  // CORS (sin callback para evitar problemas de tipos):
  // - Si CORS_ORIGINS existe → array de orígenes permitidos
  // - Si no → true (refleja Origin en dev)
  const corsEnv = (config.get<string>('CORS_ORIGINS') || '').trim();
  const allowedOrigins =
    corsEnv.length > 0
      ? corsEnv.split(',').map(s => s.trim()).filter(Boolean)
      : true;

  app.enableCors({
    origin: allowedOrigins,
    credentials: false, // no usamos cookies
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type','x-api-key'],
    exposedHeaders: ['Content-Disposition','x-request-id'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe());
  
  await app.listen(3001);
  console.log(`🚀 BFF de VeriFactu escuchando en: http://localhost:3001`);
}
bootstrap();