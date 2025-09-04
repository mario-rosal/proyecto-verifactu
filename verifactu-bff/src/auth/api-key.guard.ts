import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: any) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method: string = (req.method || '').toUpperCase();
    const path: string = req.path || req.url || '';

    // 1) Whitelist mínimos: preflight, health, login y polling de jobs (onboarding)
    if (method === 'OPTIONS') return true;            // CORS preflight
    // Health (con y sin prefijo global 'v1')
    if (path === '/healthz') return true;
    if (path === '/v1/healthz') return true;
    if (method === 'POST' && path === '/v1/auth/login') return true; // login sin JWT aún
    if (method === 'GET' && /^\/v1\/jobs\/[0-9a-fA-F-]{36}$/.test(path)) return true; // polling desde navegador
    // Descarga del conector mediante ticket firmado (HMAC + exp). GET público sin Authorization.
    // Se valida el token en el propio controlador antes de servir el ZIP.
    if (method === 'GET' && /^\/v1\/connector-package\/tickets\/[^/]+$/.test(path)) return true;

    // 2) Si llega JWT Bearer, dejamos pasar; el guard de JWT hará su parte
    const authHeader: string | undefined =
      req.headers['authorization'] || req.headers['Authorization'];
    if (authHeader && /^Bearer\s+/.test(String(authHeader))) {
      return true;
    }

    // 3) Si no hay JWT, exigimos API-Key válida (server-to-server)
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
    if (!apiKey) return false;

    // 4) Validar API key con AuthService
    if (this.authService && typeof this.authService.validateApiKey === 'function') {
      const tenant = await this.authService.validateApiKey(apiKey);
      if (!tenant) return false;
      (req as any).tenant = tenant; // adjuntar tenant
      return true;
    }

    // 5) Por seguridad, denegar si no pudimos validar
    return false;
  }
}