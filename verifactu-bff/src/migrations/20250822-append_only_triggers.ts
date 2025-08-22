import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppendOnlyTriggers20250822 implements MigrationInterface {
  name = 'AppendOnlyTriggers20250822';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- invoice_record ---
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_invoice_record_append_only ON "invoice_record";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_invoice_record_modifications();`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_invoice_record_modifications()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'invoice_record es append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_invoice_record_append_only
      BEFORE UPDATE OR DELETE ON "invoice_record"
      FOR EACH ROW EXECUTE FUNCTION prevent_invoice_record_modifications();
    `);

    // --- event_log ---
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_event_log_append_only ON "event_log";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_event_log_modifications();`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_event_log_modifications()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'event_log es append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_event_log_append_only
      BEFORE UPDATE OR DELETE ON "event_log"
      FOR EACH ROW EXECUTE FUNCTION prevent_event_log_modifications();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_invoice_record_append_only ON "invoice_record";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_invoice_record_modifications();`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_event_log_append_only ON "event_log";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_event_log_modifications();`);
  }
}
