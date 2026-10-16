import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the VoteAuthorization aggregate (schema `voting`,
 * table `authorizations`). The eligibility snapshot rides as JSONB; the
 * single-PENDING guard is `uq_auth_pending` (partial unique) plus the finder.
 */
@Entity('authorizations', { schema: 'voting' })
export class VoteAuthorizationOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() proposalId: string;
  @Column() voterAddress: string;
  @Column() personId: string;
  @Column() status: string;
  @Column({ nullable: true }) denialReason: string | null;
  @Column() expiresAt: Date;
  @Column({ type: 'jsonb', nullable: true }) eligibilitySnapshot: unknown | null;
}
