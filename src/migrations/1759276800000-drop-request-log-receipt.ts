import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Drops the write-only `receipt` snapshot from `voting.request_log`.
 *
 * The column was written on every POST /votes and never read back (replays
 * re-query the proof and rebuild the receipt), while leaking the interfaces
 * receipt DTO into persistence. The store keeps key→voteId dedup only.
 * Re-runnable (`IF EXISTS`); run with `pnpm migration:run`.
 */
export class DropRequestLogReceipt1759276800000 implements MigrationInterface {
  name = 'DropRequestLogReceipt1759276800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS voting.request_log DROP COLUMN IF EXISTS receipt`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS voting.request_log ADD COLUMN IF NOT EXISTS receipt JSONB NOT NULL DEFAULT '{}'`);
  }
}
