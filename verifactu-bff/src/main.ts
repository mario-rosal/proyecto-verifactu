// Ubicación: verifactu-bff/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // API versionada para estabilizar contratos (prod-ready)
  app.setGlobalPrefix('v1');

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
    credentials: false,                // no usamos cookies
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type'],
    exposedHeaders: ['Content-Disposition'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe());
  
  await app.listen(3001);
  console.log(`🚀 BFF de VeriFactu escuchando en: http://localhost:3001`);
}
bootstrap();