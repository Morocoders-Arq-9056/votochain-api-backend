import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds the local secret hash to IAM users for classic email+password login.
 * Nullable so Sprint-01 rows survive; the domain requires a hash for ACTIVE
 * identities going forward. Also backfills `outside_subject`, which the
 * entity already maps but Sprint-01 never created.
 */
export class AddSecretHashToIamUsers1762800000000 implements MigrationInterface {
  name = 'AddSecretHashToIamUsers1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS secret_hash VARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS outside_subject VARCHAR(255) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE iam.users DROP COLUMN IF EXISTS secret_hash`);
  }
}
