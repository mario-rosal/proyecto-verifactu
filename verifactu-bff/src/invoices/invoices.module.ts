import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceRecord } from '../entities/invoice_record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceRecord])],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
