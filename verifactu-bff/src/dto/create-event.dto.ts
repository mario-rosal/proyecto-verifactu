import { EventType } from '../entities/event-log.entity';

// Este es el "formulario" que el conector de Electron usará
// para enviar la información de un nuevo evento.
export class CreateEventDto {
    eventType: EventType;
    details: object;
}
