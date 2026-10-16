import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint-03 managed schema (Document OCR + Biometric + Wallet).
 *
 * Single Postgres, schema-per-BC, exactly as locked in
 * `docs/Plan/Sprint-03-OCR-Biometric-Wallet.md` §4. Includes the partial
 * `uq_open_exam`, `uq_live_profile` and `wallet` CHECK/UNIQUE backstops,
 * which `synchronize` can neither create nor keep — every statement is
 * `IF NOT EXISTS` so the migration is re-runnable. The wallet schema has
 * NO column capable of holding signing material (structural invariant).
 */
export class Sprint03Schemas1759449600000 implements MigrationInterface {
  name = 'Sprint03Schemas1759449600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ocr`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS ocr.examinations (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
      document_ref VARCHAR(128) NOT NULL, standing VARCHAR(16) NOT NULL, verdict VARCHAR(16),
      consumed BOOLEAN NOT NULL DEFAULT FALSE, requested_at TIMESTAMPTZ NOT NULL, ttl_minutes INT NOT NULL,
      unreadable_reason VARCHAR(32), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_open_exam ON ocr.examinations (person_id, document_ref) WHERE standing = 'OPEN'`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS biometric`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS biometric.profiles (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
      standing VARCHAR(16) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_live_profile ON biometric.profiles (person_id) WHERE standing = 'ENROLLED'`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS biometric.attempts (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
      profile_id VARCHAR(64) NOT NULL, standing VARCHAR(24) NOT NULL, freshness_start TIMESTAMPTZ NOT NULL,
      freshness_minutes INT NOT NULL, failure_reason VARCHAR(32), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_attempt_person ON biometric.attempts (person_id, standing)`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS wallet`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS wallet.wallets (id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
      derivation_position INT NOT NULL UNIQUE, standing TEXT NOT NULL
      CHECK (standing IN ('PROVISIONED','SIGNING_OPEN','ROTATED','SUSPENDED','RETIRED')),
      open_for TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_wallets_person ON wallet.wallets (person_id)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS wallet.events (seq BIGSERIAL PRIMARY KEY, wallet_id TEXT NOT NULL REFERENCES wallet.wallets(id),
      event_name TEXT NOT NULL, payload JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_events_wallet ON wallet.events (wallet_id, seq)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS wallet.idx_events_wallet`);
    await queryRunner.query(`DROP TABLE IF EXISTS wallet.events`);
    await queryRunner.query(`DROP INDEX IF EXISTS wallet.idx_wallets_person`);
    await queryRunner.query(`DROP TABLE IF EXISTS wallet.wallets`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS wallet`);
    await queryRunner.query(`DROP INDEX IF EXISTS biometric.ix_attempt_person`);
    await queryRunner.query(`DROP TABLE IF EXISTS biometric.attempts`);
    await queryRunner.query(`DROP INDEX IF EXISTS biometric.uq_live_profile`);
    await queryRunner.query(`DROP TABLE IF EXISTS biometric.profiles`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS biometric`);
    await queryRunner.query(`DROP INDEX IF EXISTS ocr.uq_open_exam`);
    await queryRunner.query(`DROP TABLE IF EXISTS ocr.examinations`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS ocr`);
  }
}
