import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Transport dedup for POST /votes (schema `voting`, table `request_log`).
 * NOT an aggregate: no domain port beyond find/save, used by the application
 * layer only. The idempotency key is the primary key. The former `receipt`
 * snapshot column was write-only (never read back) and dropped.
 */
@Entity('request_log', { schema: 'voting' })
export class RequestLogOrmEntity {
  @PrimaryColumn() idempotencyKey: string;
  @Column() voteId: string;
}
