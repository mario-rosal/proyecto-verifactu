import { Controller, Get, Header, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id/pdf')
  @Header('Cache-Control', 'no-store')
  async getInvoicePdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { pdfBytes, fileName } = await this.invoicesService.createPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    // Nombre simple suficiente aquí
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return new StreamableFile(pdfBytes);
  }
}
