export class FacturaDto {
  emisor: {
    nombre: string;
    nif: string;
  };
  receptor: {
    nif: string;
  };
  fechaEmision: string;
  lineas: {
    desc: string;
  }[];
  totales: {
    total: number;
  };
}