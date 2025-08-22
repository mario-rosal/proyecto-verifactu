import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

async function getAnyAllowedEventType(ds: DataSource): Promise<string> {
  const rows = await ds.query(`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'event_type'
    ORDER BY e.enumsortorder
    LIMIT 1;
  `);
  return rows?.[0]?.enumlabel ?? 'APP_START';
}

async function getExistingTenantId(ds: DataSource): Promise<number> {
  const rows = await ds.query(`SELECT id FROM tenant ORDER BY id LIMIT 1;`);
  if (!rows?.length) {
    throw new Error('No hay tenants en la BD de test. Crea uno antes de ejecutar este e2e.');
  }
  return rows[0].id as number;
}

describe('DB append-only (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('event_log: UPDATE/DELETE bloqueados por trigger', async () => {
    const eventType = await getAnyAllowedEventType(ds);
    const tenantId = await getExistingTenantId(ds);

    const [row] = await ds.query(
      `INSERT INTO event_log (tenant_id, event_type, details, created_at)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [tenantId, eventType, {}, new Date()],
    );
    const id = row.id as number;

    await expect(
      ds.query(`UPDATE event_log SET event_type='${eventType}' WHERE id=${id}`),
    ).rejects.toThrow(/append-only/);

    await expect(
      ds.query(`DELETE FROM event_log WHERE id=${id}`),
    ).rejects.toThrow(/append-only/);
  });

  it('invoice_record: UPDATE/DELETE bloqueados por trigger', async () => {
    // 1) Intenta usar un registro existente
    let rows = await ds.query(`SELECT id FROM invoice_record ORDER BY id LIMIT 1;`);
    let id: number;

    if (rows.length) {
      id = rows[0].id as number;
    } else {
      // 2) Si no hay, inserta uno mínimo VÁLIDO con todos los NOT NULL (según tu esquema)
      const tenantId = await getExistingTenantId(ds);
      const hash = 'A'.repeat(64);
      const zero = '0'.repeat(64);

      const insert = await ds.query(
        `INSERT INTO invoice_record
          (tenant_id, hash_actual, hash_anterior, tipo, serie, numero, fecha_emision,
           emisor_nif, base_total, cuota_total, importe_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          tenantId,
          hash,
          zero,
          'ALTA',          // tipo
          'E2E',           // serie
          '0001',          // numero
          new Date(),      // fecha_emision (date/timestamptz aceptan ISO)
          'ES00000000',    // emisor_nif
          100,             // base_total
          21,              // cuota_total
          121,             // importe_total
        ],
      );
      id = insert[0].id as number;
    }

    // 3) Valida triggers append-only
    await expect(
      ds.query(`UPDATE invoice_record SET tipo = tipo WHERE id = ${id}`),
    ).rejects.toThrow(/append-only/);

    await expect(
      ds.query(`DELETE FROM invoice_record WHERE id = ${id}`),
    ).rejects.toThrow(/append-only/);
  });
});


