// ========================================================================
// EXPLICACIÓN: Añadimos los nuevos campos al DTO para que nuestra API
// pueda recibirlos al crear un nuevo tenant.
// ========================================================================

export class CreateTenantDto {
  nif: string;
  razonSocial: string;
  modalidad: 'VERIFACTU' | 'NO_VERIFACTU';
  email: string;
  contactName?: string; // Opcional
  sector: string;
  // No añadimos 'integrationMethod' aquí porque por ahora siempre será 'API' por defecto.
}