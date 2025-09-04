import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Whitelist: descarga pública por ticket (acepta /v1/, /v2/, ...)
    const path: string = request.path || request.url || '';
    const method: string = (request.method || '').toUpperCase();
    if (
      method === 'GET' &&
      /^\/(?:v\d+\/)?connector-package\/tickets\/[^/]+$/.test(path)
    ) {
      return true;
    }

    const apiKey = this.extractKeyFromHeader(request);
    
    if (!apiKey) {
      throw new UnauthorizedException('Falta la cabecera X-API-KEY.');
    }

    try {
      // Usamos el servicio de autenticación para validar la clave.
      // Si es válida, nos devolverá los datos del tenant.
      const tenantInfo = await this.authService.validateApiKey(apiKey);
      
      // Adjuntamos la información del tenant a la petición para que el
      // controlador pueda usarla.
      request['tenant'] = tenantInfo;

    } catch (error) {
      // Si validateApiKey lanza una excepción (porque la clave no es válida),
      // la capturamos y devolvemos un 401 Unauthorized.
      throw new UnauthorizedException('La API Key proporcionada es inválida.');
    }
    
    return true; // Si todo va bien, permitimos el acceso.
  }

  private extractKeyFromHeader(request: Request): string | undefined {
    // La clave vendrá en una cabecera personalizada llamada 'x-api-key'.
    // Las cabeceras se reciben en minúsculas por estándar.
    return request.headers['x-api-key'] as string;
  }
}