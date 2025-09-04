import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Purga los ZIP temporales generados por:
 *   POST /v1/connector-package/tickets  →  tmpName = "verifactu-connector-<tenant>-<ts>.zip"
 * El token expira a los 10 minutos; aquí usamos TTL=10min + GRACE=2min.
 */
@Injectable()
export class TicketsPurgeService implements OnModuleInit {
  private readonly logger = new Logger(TicketsPurgeService.name);
  private readonly TTL_MS = 10 * 60 * 1000;     // debe coincidir con el usado al firmar el token
  private readonly GRACE_MS = 2 * 60 * 1000;    // margen de seguridad
  private readonly PATTERN = /^verifactu-connector-\d+-(\d+)\.zip$/;

  onModuleInit() {
    // Purga inicial para pruebas y arranques limpios
    try { this.purgeOnce(); } catch (e: any) {
      this.logger.warn(`Purge inicial falló: ${e?.message}`);
    }
  }

  // Ejecuta cada minuto (frecuencia corta para entorno dev; se puede ampliar en prod)
  @Interval(60_000)
  handleInterval() {
    try { this.purgeOnce(); } catch (e: any) {
      this.logger.warn(`Purge periódica falló: ${e?.message}`);
    }
  }

  private purgeOnce(): void {
    const dir = os.tmpdir();
    const now = Date.now();
    let removed = 0;
    for (const file of fs.readdirSync(dir)) {
      const m = this.PATTERN.exec(file);
      if (!m) continue;
      const ts = Number(m[1]);
      if (!Number.isFinite(ts)) continue;
      const age = now - ts;
      if (age > this.TTL_MS + this.GRACE_MS) {
        const full = path.join(dir, file);
        try {
          fs.unlinkSync(full);
          removed++;
        } catch (err: any) {
          this.logger.warn(`No se pudo eliminar ${full}: ${err?.message}`);
        }
      }
    }
    if (removed > 0) {
      this.logger.log(`Purgados ${removed} paquetes expirados en ${dir}`);
    }
  }
}
