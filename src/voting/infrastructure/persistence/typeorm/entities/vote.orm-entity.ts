import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the Vote aggregate (schema `voting`, table `votes`).
 * Single-CONFIRMED per (proposal, voter) is `uq_vote_confirmed` (partial
 * unique); `idx_votes_proposal_status` serves the tally read.
 */
@Entity('votes', { schema: 'voting' })
export class VoteOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() proposalId: string;
  @Column() voterAddress: string;
  @Column() choice: string;
  @Column() nonce: string;
  @Column({ type: 'jsonb' }) signature: { v: number; r: string; s: string };
  @Column({ nullable: true }) txHash: string | null;
  @Column({ nullable: true }) blockNumber: number | null;
  @Column() status: string;
}
