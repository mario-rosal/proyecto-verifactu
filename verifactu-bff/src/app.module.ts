// ========================================================================
// EXPLICACIÓN: Importamos nuestro nuevo AuthModule en el módulo principal
// de la aplicación para que NestJS lo reconozca y lo active.
// ========================================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Tenant } from './entities/tenant.entity';
import { InvoiceRecord } from './entities/invoice_record.entity';
import { HttpModule } from '@nestjs/axios';
import { Job } from './entities/job.entity';
import { AuthModule } from './auth/auth.module';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { EventLog } from './event-log/event-log.entity';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [
    InvoicesModule,
    HealthModule,
    AuthModule, // <-- El AuthModule está correctamente importado
    HttpModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'asdfer34gf3L-d',
      database: 'verifactu_db',
      entities: [Tenant, InvoiceRecord, Job, User, ApiKey, EventLog], // <-- 2. Añadir EventLog a la lista
      synchronize: false,
      logging: true,
      extra: {
        max: 20,
      },
    }),
    TypeOrmModule.forFeature([Tenant, InvoiceRecord, Job, User, ApiKey, EventLog]), // <-- 3. Registrarla para inyección
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}