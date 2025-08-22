// ========================================================================
// EXPLICACIÓN: Creamos un nuevo DTO específico para validar los datos
// que llegarán de las facturas enviadas por los clientes.
// Se ha modificado el 'receptor' para soportar IDs fiscales internacionales.
// ========================================================================

export class CreateInvoiceDto {
    emisorNif: string;
    
    // Campo obligatorio para indicar si es una factura normal o una anulación
    tipo: 'ALTA' | 'ANULACION';

    serie: string;
    numero: string;
    fechaEmision: string; // Formato YYYY-MM-DD
    
    receptor: {
        nombre: string;
        // Campo genérico para NIF, VAT, etc.
        idFiscal: string; 
        // Opcional: Código de país ISO 2 (ej. 'FR', 'DE') para IDs no españoles
        codigoPais?: string; 
    };

    lineas: any[];

    totales: {
        base: number;
        iva: number;
        total: number;
    };
}