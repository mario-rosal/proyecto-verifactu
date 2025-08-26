import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceRecord } from '../entities/invoice_record.entity';
import { stampInvoicePdf, buildVerificationUrl } from './pdf-stamp.util';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(InvoiceRecord)
    private readonly invoiceRecordRepo: Repository<InvoiceRecord>,
  ) {}

  /**
   * Devuelve el PDF original estampado con leyenda + QR.
   * No modifica BD.
   */
  async stampOriginalPdf(id: string, originalPdfBuffer: Buffer) {
    const record = await this.invoiceRecordRepo.findOne({
      where: { id: id as any },
      // usar nombres de propiedad del entity (camelCase)
      select: ['emisorNif', 'serie', 'numero', 'fechaEmision', 'importeTotal', 'hashActual'] as any,
    });

    if (!record) {
      throw new NotFoundException('invoice_record not found');
    }
    if (!record.hashActual) {
      throw new UnprocessableEntityException('invoice_record lacks hash_actual');
    }

    const stamped = await stampInvoicePdf(originalPdfBuffer, record as any);
    const filename = `verifactu-${record.serie}-${record.numero}.pdf`;
    return { buffer: stamped, filename };
  }

  /**
   * Compatibilidad con el endpoint existente GET /invoices/:id/pdf
   * Genera un A4 mínimo con leyenda + QR + hash (no usa PDF original).
   */
  async createPdf(id: string): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
    const record = await this.invoiceRecordRepo.findOne({
      where: { id: id as any },
      select: ['emisorNif', 'serie', 'numero', 'fechaEmision', 'importeTotal', 'hashActual'] as any,
    });
    if (!record) {
      throw new NotFoundException('invoice_record not found');
    }
    if (!record.hashActual) {
      throw new UnprocessableEntityException('invoice_record lacks hash_actual');
    }

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const legend = 'VERI*FACTU — Factura verificable en la sede electrónica de la AEAT';
    page.drawText(legend, { x: 24, y: 812, size: 12, font: fontBold, color: rgb(0, 0, 0) });

    const payloadUrl = buildVerificationUrl(record as any);
    const qrPng = await QRCode.toBuffer(payloadUrl, { type: 'png', errorCorrectionLevel: 'M', margin: 0, width: 256 });
    const qrImage = await pdf.embedPng(qrPng);
    page.drawImage(qrImage, { x: 595.28 - 24 - 144, y: 812 - 10 - 144, width: 144, height: 144 });

    const hashText = `HASH: ${record.hashActual}`;
    page.drawText(hashText, { x: 24, y: 36, size: 10, font, color: rgb(0, 0, 0) });
    page.drawText('VERI*FACTU', { x: 595.28 - 24 - font.widthOfTextAtSize('VERI*FACTU', 9), y: 24, size: 9, font, color: rgb(0, 0, 0) });

    const pdfBytes = await pdf.save();
    const fileName = `verifactu-${record.serie}-${record.numero}.pdf`;
    return { pdfBytes, fileName };
  }
}
