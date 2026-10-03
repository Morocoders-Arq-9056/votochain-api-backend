import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint-01 managed schema (IAM + Community + Verification).
 *
 * Single Postgres, schema-per-BC, exactly as locked in
 * `docs/Plan/Sprint-01-IAM-Community-Verification.md` §6 (column names
 * already snake_case per SnakeNamingStrategy). Includes the partial
 * `uq_open_pair` backstop, which `synchronize` can neither create nor
 * keep — every statement is `IF NOT EXISTS` so the migration is
 * re-runnable. Run with `pnpm migration:run`; the app never auto-runs
 * migrations (`migrationsRun: false`).
 */
export class Sprint01Schemas1758662400000 implements MigrationInterface {
  name = 'Sprint01Schemas1758662400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS iam`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS iam.users (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL UNIQUE,
      standing VARCHAR(16) NOT NULL, session VARCHAR(16) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE, email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      roles TEXT NOT NULL, outside_prover VARCHAR(64) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS community`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS community.communities (id VARCHAR(64) PRIMARY KEY, standing VARCHAR(16) NOT NULL,
      name VARCHAR(255) NOT NULL, domicile VARCHAR(255) NOT NULL, contact VARCHAR(255) NOT NULL,
      policy JSONB NULL, admins JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_communities_standing ON community.communities (standing)`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS verification`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS verification.challenges (id VARCHAR(36) PRIMARY KEY, person_id VARCHAR(36) NOT NULL,
      purpose VARCHAR(24) NOT NULL, standing VARCHAR(12) NOT NULL, attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 5, code_hash VARCHAR(128) NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
      reason VARCHAR(24) NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_open_pair ON verification.challenges (person_id, purpose) WHERE standing = 'OPEN'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS verification.uq_open_pair`);
    await queryRunner.query(`DROP INDEX IF EXISTS community.idx_communities_standing`);
    await queryRunner.query(`DROP TABLE IF EXISTS verification.challenges`);
    await queryRunner.query(`DROP TABLE IF EXISTS community.communities`);
    await queryRunner.query(`DROP TABLE IF EXISTS iam.users`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS verification`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS community`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS iam`);
  }
}
