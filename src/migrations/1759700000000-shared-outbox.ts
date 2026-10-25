import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Shared transactional outbox (`shared.outbox`): every unit of work stages
 * its domain events in the same transaction as the business change; the
 * relay emits unpublished rows after commit (sync path) or on
 * startup/sweep (recovery). Re-runnable (`IF NOT EXISTS`).
 */
export class SharedOutbox1759700000000 implements MigrationInterface {
  name = 'SharedOutbox1759700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS shared`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS shared.outbox (id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      payload JSONB NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_outbox_unpublished ON shared.outbox (published, occurred_at, id) WHERE published = FALSE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS shared.outbox`);
  }
}
