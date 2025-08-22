// ========================================================================
// EXPLICACIÓN: Este es nuestro "guardia de seguridad". Usa el JwtService
// para verificar el token de cada petición. Si el token es válido,
// adjunta los datos del usuario a la petición para que podamos usarlos más adelante.
// Si no es válido, deniega el acceso automáticamente.
// ========================================================================

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: 'tu-secreto-muy-seguro-cambiar-en-produccion',
      });
      // Adjuntamos el payload del token a la request
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}