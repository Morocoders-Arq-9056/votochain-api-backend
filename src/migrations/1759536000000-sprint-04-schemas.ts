import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint-04 managed schema (Blockchain Relay + Consent & Compliance).
 *
 * Single Postgres, schema-per-BC, exactly as locked in
 * `docs/Plan/Sprint-04-Relay-Consent.md` §3. Partial uniques backstop the
 * domain invariants (`no-overtaking` per payer, idempotent accept by open
 * content, one live GRANTED per person+scope, one open erasure per person).
 * Every statement is `IF NOT EXISTS` so the migration is re-runnable.
 */
export class Sprint04Schemas1759536000000 implements MigrationInterface {
  name = 'Sprint04Schemas1759536000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS relay`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS relay.orders (id TEXT PRIMARY KEY,
      content_ref TEXT NOT NULL, payer_ref TEXT NOT NULL, order_position INT NOT NULL,
      standing TEXT NOT NULL CHECK (standing IN ('ACCEPTED','ORDERED','SENT','CONFIRMED','FAILED','RETRIED','ABANDONED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (payer_ref, order_position))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_open_content ON relay.orders (content_ref) WHERE standing NOT IN ('CONFIRMED','ABANDONED')`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_orders_payer ON relay.orders (payer_ref, order_position)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS relay.sending_attempts (id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES relay.orders(id) ON DELETE CASCADE,
      attempt_no INT NOT NULL, outcome TEXT NOT NULL CHECK (outcome IN ('SENT','FAILED')),
      reason TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (order_id, attempt_no))`);

    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS consent`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS consent.consents (id VARCHAR PRIMARY KEY,
      person_id VARCHAR NOT NULL, scope VARCHAR NOT NULL, standing VARCHAR NOT NULL,
      policy_version VARCHAR NOT NULL, granted_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_consents_live ON consent.consents (person_id, scope) WHERE standing = 'GRANTED'`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS consent.requests (id VARCHAR PRIMARY KEY,
      person_id VARCHAR NOT NULL, standing VARCHAR NOT NULL,
      confirmations JSONB NOT NULL DEFAULT '{"asked":[],"confirmed":[]}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_requests_person ON consent.requests (person_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_requests_open ON consent.requests (person_id) WHERE standing IN ('REQUESTED','CONFIRMED','COORDINATED','AWAITING_CONFIRMATIONS')`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS consent.policies (id VARCHAR PRIMARY KEY,
      category VARCHAR NOT NULL, terms JSONB NOT NULL, supersedes VARCHAR NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_policies_category ON consent.policies (category)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS consent.ix_policies_category`);
    await queryRunner.query(`DROP TABLE IF EXISTS consent.policies`);
    await queryRunner.query(`DROP INDEX IF EXISTS consent.uq_requests_open`);
    await queryRunner.query(`DROP INDEX IF EXISTS consent.ix_requests_person`);
    await queryRunner.query(`DROP TABLE IF EXISTS consent.requests`);
    await queryRunner.query(`DROP INDEX IF EXISTS consent.uq_consents_live`);
    await queryRunner.query(`DROP TABLE IF EXISTS consent.consents`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS consent`);
    await queryRunner.query(`DROP TABLE IF EXISTS relay.sending_attempts`);
    await queryRunner.query(`DROP INDEX IF EXISTS relay.idx_orders_payer`);
    await queryRunner.query(`DROP INDEX IF EXISTS relay.uq_orders_open_content`);
    await queryRunner.query(`DROP TABLE IF EXISTS relay.orders`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS relay`);
  }
}
