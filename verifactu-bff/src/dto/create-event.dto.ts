// Este es el "formulario" que el conector de Electron usará
// para enviar la información de un nuevo evento.
export class CreateEventDto {
  // Alineado con event_log.entity.ts: eventType es texto (varchar)
  eventType: string;
  details?: Record<string, any>;
}
