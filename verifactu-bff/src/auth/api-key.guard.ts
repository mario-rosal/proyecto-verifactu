import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  // Usamos el token AuthService para la inyección, pero tipamos como any para no romper si cambia la firma
  constructor(@Inject(AuthService) private readonly authService: any) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Permitir /healthz sin API key para pruebas y monitorización
    const path: string = req.path || req.url || '';
    if (path === '/healthz') {
      return true;
    }

    const apiKey = (req.headers['x-api-key'] as string) || undefined;
    if (!apiKey) return false;

    // Si AuthService expone validateApiKey, úsalo; si no, deniega
    if (this.authService && typeof this.authService.validateApiKey === 'function') {
      const tenant = await this.authService.validateApiKey(apiKey);
      if (tenant) {
        // Adjunta tenant a la request para capas posteriores
        (req as any).tenant = tenant;
        return true;
      }
      return false;
    }

    // Si no hay método de validación disponible, por seguridad denegamos
    return false;
  }
}