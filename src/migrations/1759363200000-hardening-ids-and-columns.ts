import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint-01/02 hardening migration (2026-10-03 review).
 *
 * 1. Widens the over-short id columns. The plans' own DDL declared
 *    `VARCHAR(36)`, but generated typed ids are prefixed (`ch-`+UUID=39,
 *    `per-`/`mem-`/`com-`+UUID=40), so inserts overflowed. IAM/Community
 *    already used `VARCHAR(64)` for the same reason.
 * 2. Adds `iam.users.outside_subject`: the provider-side subject reference
 *    (`sub`) linked with the outside prover, previously dropped on the floor.
 * 3. Adds `voting.authorizations.person_id`: the authorization's person id,
 *    so `grant()` can freeze the real person instead of the on-chain address.
 *
 * Every statement is idempotent (`IF EXISTS`/`IF NOT EXISTS`); the app never
 * auto-runs migrations. Run with `pnpm migration:run`.
 */
export class HardeningIdsAndColumns1759363200000 implements MigrationInterface {
  name = 'HardeningIdsAndColumns1759363200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS verification.challenges ALTER COLUMN id TYPE VARCHAR(64)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS verification.challenges ALTER COLUMN person_id TYPE VARCHAR(64)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN id TYPE VARCHAR(64)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN person_id TYPE VARCHAR(64)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN community_id TYPE VARCHAR(64)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS iam.users ADD COLUMN IF NOT EXISTS outside_subject VARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE IF EXISTS voting.authorizations ADD COLUMN IF NOT EXISTS person_id TEXT NOT NULL DEFAULT ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS voting.authorizations DROP COLUMN IF EXISTS person_id`);
    await queryRunner.query(`ALTER TABLE IF EXISTS iam.users DROP COLUMN IF EXISTS outside_subject`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN community_id TYPE VARCHAR(36)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN person_id TYPE VARCHAR(36)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS membership.memberships ALTER COLUMN id TYPE VARCHAR(36)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS verification.challenges ALTER COLUMN person_id TYPE VARCHAR(36)`);
    await queryRunner.query(`ALTER TABLE IF EXISTS verification.challenges ALTER COLUMN id TYPE VARCHAR(36)`);
  }
}
