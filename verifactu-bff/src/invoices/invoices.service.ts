import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceRecord } from '../entities/invoice_record.entity';
import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(InvoiceRecord)
    private readonly invoiceRepository: Repository<InvoiceRecord>,
  ) {}

  private async findOneOrFail(id: string): Promise<InvoiceRecord> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } as any });
    if (!invoice) throw new NotFoundException(`Invoice with ID "${id}" not found`);
    // No generamos PDF “oficial” sin hash_actual
    const hash = (invoice as any).hash_actual ?? (invoice as any).hashActual;
    if (!hash) {
      throw new UnprocessableEntityException('Invoice exists but has no hash_actual yet.');
    }
    return invoice;
  }

  private to2d(v: any): string {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : String(v ?? '');
  }
  private isoDate(v: any): string {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v ?? '');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
  private pick(obj: any, ...keys: string[]) {
    for (const k of keys) {
      const val = (obj as any)[k];
      if (val !== undefined && val !== null) return val;
    }
    return undefined;
  }
  private wrap(text: string, max = 64): string[] {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
    return out;
  }
  private enc(v: any): string {
    return encodeURIComponent(String(v ?? ''));
  }

  async createPdf(id: string): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
    const invoice = await this.findOneOrFail(id);

    // Toleramos camel_case / snake_case según tu entity real (sin tocar BD)
    const emisor_nif   = String(this.pick(invoice, 'emisor_nif', 'emisorNif') ?? '');
    const serie        = String(this.pick(invoice, 'serie', 'serie') ?? '');
    const numero       = this.pick(invoice, 'numero', 'numero');
    const fechaEmision = this.pick(invoice, 'fecha_emision', 'fechaEmision');
    const importeTotal = this.pick(invoice, 'importe_total', 'importeTotal');
    const baseTotal    = this.pick(invoice, 'base_total', 'baseTotal');
    const cuotaTotal   = this.pick(invoice, 'cuota_total', 'cuotaTotal');
    const hash_actual  = String(this.pick(invoice, 'hash_actual', 'hashActual') ?? '');

    // URL provisional para el QR (según requisito)
    const qrUrl =
      `https://verifactu.local/verify` +
      `?nif=${this.enc(emisor_nif)}` +
      `&serie=${this.enc(serie)}` +
      `&numero=${this.enc(numero)}` +
      `&fecha=${this.enc(this.isoDate(fechaEmision))}` +
      `&total=${this.enc(this.to2d(importeTotal))}` +
      `&hash=${this.enc(hash_actual)}`;

    const qrImageBytes = await QRCode.toBuffer(qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 0,
      scale: 6, // ~120–140 px nítidos
    });

    // PDF A4
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const mono = await pdfDoc.embedFont(StandardFonts.Courier);
    const M = 50;
    let y = height - M;

    // Leyenda visible (texto exacto pedido)
    const legendTop = 'VERI*FACTU — Factura verificable en la sede electrónica de la AEAT';
    page.drawText(legendTop, { x: M, y, font, size: 14, color: rgb(0, 0, 0) });

    // QR arriba-derecha
    const qrImage = await pdfDoc.embedPng(qrImageBytes);
    const qrSize = 125;
    page.drawImage(qrImage, {
      x: width - M - qrSize - 5,
      y: height - M - qrSize,
      width: qrSize,
      height: qrSize,
    });
    y -= 40;

    // Datos visibles
    const draw = (label: string, value?: string | number) => {
      if (value == null || value === '') return;
      page.drawText(`${label}: ${value}`, { x: M, y, size: 12, font });
      y -= 18;
    };
    draw('NIF Emisor', emisor_nif);
    draw('Serie', serie);
    draw('Número', String(numero));
    draw('Fecha Emisión', this.isoDate(fechaEmision));
    draw('Importe Total', `${this.to2d(importeTotal)} EUR`);
    if (baseTotal != null)  draw('Base Total',  `${this.to2d(baseTotal)} EUR`);
    if (cuotaTotal != null) draw('Cuota Total', `${this.to2d(cuotaTotal)} EUR`);
    y -= 6;

    // Hash visible (envuelto)
    page.drawText('Registro (hash_actual):', { x: M, y, size: 11, font });
    y -= 14;
    for (const line of this.wrap(hash_actual, 32)) {
      page.drawText(line, { x: M, y, size: 9, font: mono });
      y -= 12;
    }

    // Leyenda también en el pie (refuerzo)
    page.drawText(legendTop, { x: M, y: M, size: 9, font, color: rgb(0.3, 0.3, 0.3) });

    const pdfBytes = await pdfDoc.save();
    const fileName = `verifactu-${serie}-${numero}.pdf`;
    return { pdfBytes, fileName };
  }
}
