// ========================================================================
// EXPLICACIÓN: Este es nuestro "guardia de seguridad". Usa el JwtService
// para verificar el token de cada petición. Si el token es válido,
// adjunta los datos del usuario a la petición para que podamos usarlos más adelante.
// Si no es válido, deniega el acceso automáticamente.
// ========================================================================

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const primary = this.config.get<string>('JWT_SECRET');
      const next = this.config.get<string>('JWT_SECRET_NEXT'); // opcional (rotación)
      if (!primary) throw new UnauthorizedException();

      let payload: any;
      try {
        // 1º intento con el secreto actual
        payload = await this.jwtService.verifyAsync(token, { secret: primary });
      } catch (e: any) {
        // No reintentar si expiró
        if (e && (e.name === 'TokenExpiredError' || e.message?.includes('expired'))) {
          throw new UnauthorizedException();
        }
        // 2º intento con el secreto "NEXT" si está definido (ventana de gracia)
        if (next && next.length >= 24) {
          try {
            payload = await this.jwtService.verifyAsync(token, { secret: next });
          } catch {
            throw new UnauthorizedException();
          }
        } else {
          throw new UnauthorizedException();
        }
      }
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