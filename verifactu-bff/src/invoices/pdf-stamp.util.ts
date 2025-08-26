import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';

export type InvoiceRecordLike =
  | {
      // snake_case
      emisor_nif: string;
      serie: string;
      numero: string;
      fecha_emision: string | Date;
      importe_total: number | string;
      hash_actual: string;
    }
  | {
      // camelCase
      emisorNif: string;
      serie: string;
      numero: string;
      fechaEmision: string | Date;
      importeTotal: number | string;
      hashActual: string;
    };

function formatDateYYYYMMDD(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTwoDecimals(n: number | string): string {
  const num =
    typeof n === 'number'
      ? n
      : parseFloat(String(n).replace(',', '.'));
  return (isNaN(num) ? 0 : num).toFixed(2);
}

export function buildVerificationUrl(r: InvoiceRecordLike): string {
  // admitir snake_case o camelCase
  const emisor = (r as any).emisor_nif ?? (r as any).emisorNif;
  const fechaEmi = (r as any).fecha_emision ?? (r as any).fechaEmision;
  const totalRaw = (r as any).importe_total ?? (r as any).importeTotal;
  const hash = (r as any).hash_actual ?? (r as any).hashActual;
  const fecha = formatDateYYYYMMDD(fechaEmi);
  const total = toTwoDecimals(totalRaw);
  const params = new URLSearchParams({
    nif: emisor,
    serie: (r as any).serie,
    numero: (r as any).numero,
    fecha,
    total,
    hash,
  });
  return `https://verifactu.local/verify?${params.toString()}`;
}

/**
 * Estampa leyenda y QR sobre un PDF original.
 * - Leyenda en cabecera (todas las páginas) y sello breve en el pie.
 * - QR en la esquina superior derecha de la **primera** página.
 */
export async function stampInvoicePdf(
  originalPdf: Buffer | Uint8Array,
  record: InvoiceRecordLike,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdf);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    return pdfDoc.save();
  }

  const legend =
    'VERI*FACTU — Factura verificable en la sede electrónica de la AEAT';

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 24; // pt
  const headerFontSize = 10;
  const footerFontSize = 8;

  // Generar QR (PNG)
  const payloadUrl = buildVerificationUrl(record);
  const qrPng = await QRCode.toBuffer(payloadUrl, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 256,
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrSize = 144; // ~2 pulgadas

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();

    // Cabecera (leyenda)
    page.drawText(legend, {
      x: margin,
      y: height - margin - headerFontSize,
      size: headerFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Pie (sello mínimo)
    const seal = 'VERI*FACTU';
    const sealWidth = fontRegular.widthOfTextAtSize(seal, footerFontSize);
    page.drawText(seal, {
      x: width - margin - sealWidth,
      y: margin - 2,
      size: footerFontSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // QR en la primera página (arriba-derecha, por debajo de la cabecera)
    if (idx === 0) {
      const headerReserve = headerFontSize + 10;
      const x = width - margin - qrSize;
      const y = height - margin - headerReserve - qrSize;
      // Fallback simple: si el alto es muy justo, reduce el tamaño del QR
      const finalQrSize = y < margin ? Math.max(96, qrSize - (margin - y)) : qrSize;
      const finalY = y < margin ? margin : y;

      page.drawImage(qrImage, {
        x,
        y: finalY,
        width: finalQrSize,
        height: finalQrSize,
      });
    }
  });

  return pdfDoc.save();
}