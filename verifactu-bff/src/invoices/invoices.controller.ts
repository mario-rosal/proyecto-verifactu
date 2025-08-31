import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Estampa sobre el PDF original (multipart/form-data → file)
   * Leyenda + QR (según contrato de datos de invoice_record).
   * Protegido por ApiKeyGuard global (JWT OR x-api-key).
   */
  @Post(':id/pdf/stamp')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async stampPdf(
    @Param('id') id: string,
    // evitar dependencia de tipos Express en compilación
    @UploadedFile() file: any,
    @Res({ passthrough: true }) res: Response,
    @Query('store') store?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Missing file');
    }
    const { buffer, filename } = await this.invoicesService.stampOriginalPdf(
      id,
      file.buffer,
    );

    // Si ?store=1, guardamos copia servidor bajo STORAGE_DIR/&lt;id&gt;-VERIFACTU.pdf
    if (store === '1') {
      await this.invoicesService.storeStampedById(id, buffer);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return new StreamableFile(buffer);
  }

  /**
   * Descarga del PDF sellado (copia servidor). Si no existe, 202 "En preparación".
   */
  @Get(':id/pdf/stamped')
  async getStampedPdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buf = await this.invoicesService.readServerStampedById(id);
    if (!buf) {
      res.status(HttpStatus.ACCEPTED);
      return { status: 'processing', message: 'En preparación' };
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${id}-VERIFACTU.pdf"`);
    return new StreamableFile(buf);
  }
}
