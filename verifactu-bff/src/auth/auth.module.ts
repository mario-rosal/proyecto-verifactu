import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// Entidades
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { ApiKey } from '../entities/api-key.entity';

import { ConfigModule, ConfigService } from '@nestjs/config';

// Guard (ajusta la ruta si lo tienes en ./guards/api-key.guard)
import { ApiKeyGuard } from './api-key.guard';
import { JwtRotationStrategy } from './jwt-rotation.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, ApiKey]),
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // registramos el guard a nivel global desde el mismo módulo que provee AuthService
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    JwtRotationStrategy,
  ],
  // exporta el servicio por si lo necesitan otros módulos
  exports: [AuthService],
})
export class AuthModule {}

