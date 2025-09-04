import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HttpException } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fsp from 'fs/promises';

/**
 * Interceptor de logging JSON.
 * - Genera/propaga x-request-id
 * - Escribe a consola (JSON) y a logs/app-YYYY-MM-DD.jsonl
 * - Aún NO está registrado globalmente (sin cambios de comportamiento)
 */
@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logsDir = path.join(process.cwd(), 'logs');

  private async append(record: Record<string, unknown>): Promise<void> {
    try {
      await fsp.mkdir(this.logsDir, { recursive: true });
      const d = new Date();
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const file = path.join(this.logsDir, `app-${yyyy}-${mm}-${dd}.jsonl`);
      await fsp.appendFile(file, JSON.stringify(record) + '\n', { encoding: 'utf8' });
    } catch {
      // No romper la request por fallos de disco
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const start = Date.now();
    const reqId: string = (req.headers?.['x-request-id'] as string) || randomUUID();
    try { res.setHeader('x-request-id', reqId); } catch {}

    const base = {
      time: new Date().toISOString(),
      reqId,
      method: req?.method,
      url: req?.originalUrl || req?.url,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress,
      tenantId: (req?.user?.tenantId ?? req?.tenant?.id ?? null),
    };

    const log = async (level: 'info' | 'error', status: number, extra?: Record<string, unknown>) => {
      const rec = {
        ...base,
        level,
        status,
        duration_ms: Date.now() - start,
        ...(extra || {})
      };
      try {
        // eslint-disable-next-line no-console
        (level === 'error' ? console.error : console.log)(JSON.stringify(rec));
      } catch {}
      void this.append(rec);
    };

    return next.handle().pipe(
      tap({
        next: () => void log('info', res?.statusCode ?? 200),
        error: (err: unknown) => {
          // Tomar el status de la excepción si existe
          let status = 500;
          const anyErr = err as any;
          if (anyErr) {
            if (typeof (anyErr as HttpException)?.getStatus === 'function') {
              try { status = (anyErr as HttpException).getStatus(); } catch { /* noop */ }
            } else if (typeof anyErr.status === 'number') {
              status = anyErr.status;
            } else if (typeof anyErr.statusCode === 'number') {
              status = anyErr.statusCode;
            }
          }
          void log('error', status, { error: { name: anyErr?.name, message: anyErr?.message } });
        },
      }),
    );
  }
}
