import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TicketsPurgeService } from './tickets-purge.service';

describe('TicketsPurgeService', () => {
  const NOW = 1_700_000_000_000; // marca de tiempo fija para pruebas
  let tmpBase: string;

  beforeEach(() => {
    jest.restoreAllMocks();
    // Directorio temporal aislado para la prueba (no producción)
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'verifactu-purge-spec-'));
  });

  afterEach(() => {
    // Limpieza del tmpBase
    for (const f of fs.readdirSync(tmpBase)) {
      try { fs.unlinkSync(path.join(tmpBase, f)); } catch {}
    }
    try { fs.rmdirSync(tmpBase); } catch {}
  });

  function touch(filePath: string) {
    fs.writeFileSync(filePath, '');
  }

  it('cuando no hay archivos candidatos → purged 0 files y log una sola vez', () => {
    const service = new TicketsPurgeService();
    const logSpy = jest.spyOn(Logger.prototype as any, 'log').mockImplementation(() => {});

    const removed = service.purgeOnce(tmpBase, NOW);

    expect(removed).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('purged 0 files');
  });

  it('elimina solo los expirados según TTL+GRACE y loguea purged N files', () => {
    const service = new TicketsPurgeService();
    const logSpy = jest.spyOn(Logger.prototype as any, 'log').mockImplementation(() => {});

    // Nombres válidos según patrón: verifactu-connector-<tenantDigits>-<ts>.zip
    const expiredTs1 = NOW - (12 * 60 * 1000) - 10_000; // > TTL(10m)+GRACE(2m)
    const expiredTs2 = NOW - (12 * 60 * 1000) - 50_000;
    const freshTs1 = NOW - (5 * 60 * 1000);             // no debe purgarse

    const f1 = path.join(tmpBase, `verifactu-connector-123-${expiredTs1}.zip`);
    const f2 = path.join(tmpBase, `verifactu-connector-456-${expiredTs2}.zip`);
    const f3 = path.join(tmpBase, `verifactu-connector-789-${freshTs1}.zip`);
    const fOther = path.join(tmpBase, `otro-archivo.zip`); // no coincide con patrón

    touch(f1);
    touch(f2);
    touch(f3);
    touch(fOther);

    const removed = service.purgeOnce(tmpBase, NOW);

    // Debe eliminar 2 expirados
    expect(removed).toBe(2);
    expect(fs.existsSync(f1)).toBe(false);
    expect(fs.existsSync(f2)).toBe(false);

    // No debe tocar los no expirados o que no cumplen patrón
    expect(fs.existsSync(f3)).toBe(true);
    expect(fs.existsSync(fOther)).toBe(true);

    // Log único y con mensaje correcto
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('purged 2 files');
  });
});