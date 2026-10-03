import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sprint-02 managed schema (Membership + Voting + Notifications).
 *
 * Single Postgres, schema-per-BC, exactly as locked in
 * `docs/Plan/Sprint-02-Membership-Voting-Notifications.md` §5 and the
 * voting impl-guide §6 (column names already snake_case per
 * SnakeNamingStrategy). Includes the partial `uq_live_pair`, `uq_auth_pending`
 * and `uq_vote_confirmed` backstops, which `synchronize` can neither create
 * nor keep — every statement is `IF NOT EXISTS` so the migration is
 * re-runnable. Run with `pnpm migration:run`; the app never auto-runs
 * migrations (`migrationsRun: false`).
 */
export class Sprint02Schemas1758835200000 implements MigrationInterface {
  name = 'Sprint02Schemas1758835200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS membership`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS membership.memberships (id VARCHAR(36) PRIMARY KEY, person_id VARCHAR(36) NOT NULL,
      community_id VARCHAR(36) NOT NULL, status VARCHAR(12) NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'OWNER',
      unit_code VARCHAR(32) NULL, last_verdict VARCHAR(16) NULL, last_snapshot_ref VARCHAR(64) NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_live_pair ON membership.memberships (person_id, community_id) WHERE status <> 'TERMINATED'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_roster ON membership.memberships (community_id, status) WHERE status = 'ACTIVE'`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS voting`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS voting.proposals (id TEXT PRIMARY KEY, community_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('DRAFT','OPEN','CLOSED','TALLIED')),
      options JSONB NOT NULL, quorum_snapshot JSONB NULL, tally JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS voting.authorizations (id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES voting.proposals(id),
      voter_address TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('PENDING','CONSUMED','EXPIRED','DENIED')),
      denial_reason TEXT NULL, expires_at TIMESTAMPTZ NOT NULL, eligibility_snapshot JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS voting.votes (id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES voting.proposals(id),
      voter_address TEXT NOT NULL, choice TEXT NOT NULL, nonce TEXT NOT NULL,
      signature JSONB NOT NULL, tx_hash TEXT NULL, block_number INT NULL,
      status TEXT NOT NULL CHECK (status IN ('SIGNED','QUEUED','SENT','CONFIRMED','FAILED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (proposal_id, voter_address, nonce))`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS voting.request_log (idempotency_key TEXT PRIMARY KEY,
      vote_id TEXT NOT NULL REFERENCES voting.votes(id), receipt JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_pending ON voting.authorizations (proposal_id, voter_address) WHERE status = 'PENDING'`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_vote_confirmed ON voting.votes (proposal_id, voter_address) WHERE status = 'CONFIRMED'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_votes_proposal_status ON voting.votes (proposal_id, status)`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS notifications`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS notifications.dispatches (id VARCHAR PRIMARY KEY,
      idempotency_key VARCHAR NOT NULL UNIQUE, address VARCHAR NOT NULL,
      channel VARCHAR NOT NULL DEFAULT 'EMAIL' CHECK (channel = 'EMAIL'),
      template_key VARCHAR NOT NULL, template_values JSONB NOT NULL DEFAULT '{}', reason VARCHAR NOT NULL,
      standing VARCHAR NOT NULL, history JSONB NOT NULL DEFAULT '[]', refusal VARCHAR NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS ix_dispatches_standing ON notifications.dispatches (standing)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS notifications.ix_dispatches_standing`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications.dispatches`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS notifications`);
    await queryRunner.query(`DROP INDEX IF EXISTS voting.idx_votes_proposal_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS voting.uq_vote_confirmed`);
    await queryRunner.query(`DROP INDEX IF EXISTS voting.uq_auth_pending`);
    await queryRunner.query(`DROP TABLE IF EXISTS voting.request_log`);
    await queryRunner.query(`DROP TABLE IF EXISTS voting.votes`);
    await queryRunner.query(`DROP TABLE IF EXISTS voting.authorizations`);
    await queryRunner.query(`DROP TABLE IF EXISTS voting.proposals`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS voting`);
    await queryRunner.query(`DROP INDEX IF EXISTS membership.ix_roster`);
    await queryRunner.query(`DROP INDEX IF EXISTS membership.uq_live_pair`);
    await queryRunner.query(`DROP TABLE IF EXISTS membership.memberships`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS membership`);
  }
}
