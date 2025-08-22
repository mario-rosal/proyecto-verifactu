// ========================================================================
// ARCHIVO 1 de 4: verifactu-bff/src/auth/auth.module.ts (NUEVO ARCHIVO)
// ========================================================================
// EXPLICACIÓN: Creamos un módulo dedicado para toda la lógica de
// autenticación. Importamos JwtModule para la gestión de tokens y
// TypeOrmModule para poder interactuar con las entidades User y Tenant.
// ========================================================================

import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { JwtModule } from '@nestjs/jwt';
import { ApiKey } from '../entities/api-key.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Tenant, ApiKey]),
    JwtModule.register({
      global: true,
      secret: 'tu-secreto-muy-seguro-cambiar-en-produccion',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}