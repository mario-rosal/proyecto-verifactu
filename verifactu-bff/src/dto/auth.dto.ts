// --- DTOs existentes para el login y recuperación ---
export class LoginDto {
    email: string;
    password: string;
}

export class ForgotPasswordDto {
    email: string;
}

export class ResetPasswordDto {
    token: string;
    password: string;
}

// --- 👇 NUEVO DTO PARA EL REGISTRO UNIFICADO 👇 ---
// Este DTO combina los datos de la empresa y del primer usuario administrador.
export class UnifiedRegisterDto {
    // Datos de la Empresa (Tenant)
    nif: string;
    razonSocial: string;
    sector: string;
    modalidad: 'VERIFACTU' | 'NO_VERIFACTU';

    // Datos del Usuario Administrador
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

// --- DTO antiguo de registro (ya no lo usaremos pero lo dejamos por si acaso) ---
export class RegisterDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantId: number;
}
// --- 👇 NUEVO DTO PARA VALIDAR LA API KEY 👇 ---
export class ValidateApiKeyDto {
    apiKey: string;
}