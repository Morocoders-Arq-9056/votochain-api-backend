import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the Proposal aggregate (schema `voting`, table
 * `proposals`). Options ride as JSONB (never queried per-choice); the quorum
 * snapshot and tally are frozen JSONB details — never child identities.
 */
@Entity('proposals', { schema: 'voting' })
export class ProposalOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() communityId: string;
  @Column() status: string;
  @Column({ type: 'jsonb' }) options: string[];
  @Column({ type: 'jsonb', nullable: true })
  quorumSnapshot: { threshold: number; basis: string } | null;
  @Column({ type: 'jsonb', nullable: true })
  tally: { counts: Record<string, number>; turnout: number; quorumMet: boolean } | null;
}
