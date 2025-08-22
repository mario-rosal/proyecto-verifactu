// Ubicación: verifactu-bff/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- 👇 LA SOLUCIÓN DEFINITIVA Y ROBUSTA ESTÁ AQUÍ 👇 ---
  // Habilitamos CORS con una configuración explícita. Esto le dice al
  // navegador que acepte peticiones desde cualquier origen ('*'), con
  // los métodos y cabeceras más comunes. Es la configuración más robusta
  // para un entorno de desarrollo y soluciona el bloqueo de "Failed to fetch".
  app.enableCors({
    origin: '*', // Permite cualquier origen
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe());
  
  await app.listen(3001);
  console.log(`🚀 BFF de VeriFactu escuchando en: http://localhost:3001`);
}
bootstrap();