// Ubicación: verifactu-bff/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API versionada para estabilizar contratos (prod-ready)
  app.setGlobalPrefix('v1');

  // CORS: refleja siempre el Origin del navegador (dev). Evita 'null' en descargas XHR/Blob.
  // En prod cambiaremos a una whitelist por dominio sin alterar el resto.
  app.enableCors({
    origin: true,                      // refleja el Origin recibido
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