// Ubicación: verifactu-bff/src/dto/job.dto.ts

// DTO para crear un nuevo trabajo. Solo necesitamos el tipo y los datos de entrada.
export class CreateJobDto {
    type: string;
    payload: object;
}

// DTO para actualizar el estado de un trabajo desde n8n.
export class UpdateJobDto {
    status: string;
    result?: object;
    errorMessage?: string;
}

// DTO para la respuesta que enviamos al frontend.
// Muestra el estado actual y el resultado si está disponible.
export class JobResponseDto {
    id: string;
    status: string;
    result?: object;
    errorMessage?: string;
}
