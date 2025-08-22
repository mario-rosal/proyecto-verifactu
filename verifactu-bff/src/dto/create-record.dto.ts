// verifactu-bff/src/dto/create-record.dto.ts
export class CreateRecordDto {
tenantId: string;
tipo: 'ALTA' | 'ANULACION';
serie: string;
numero: string;
fechaEmision: string; // Formato YYYY-MM-DD
emisor: { nif: string; nombre: string };
receptor?: { nif: string; nombre: string };
lineas?: any[]; // Por ahora simple
totales?: { base: number; iva: number; total: number };
}