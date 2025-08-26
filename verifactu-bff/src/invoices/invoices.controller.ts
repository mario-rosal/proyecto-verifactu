import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
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
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Missing file');
    }
    const { buffer, filename } = await this.invoicesService.stampOriginalPdf(
      id,
      file.buffer,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return new StreamableFile(buffer);
  }
}