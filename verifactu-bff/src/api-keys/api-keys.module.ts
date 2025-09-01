import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ConnectorPackageController } from './connector-package.controller';
import { ApiKey } from '../entities/api-key.entity';
import { EventLog } from '../event-log/event-log.entity';
import { Tenant } from '../entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, EventLog, Tenant])],
  controllers: [ApiKeysController, ConnectorPackageController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}