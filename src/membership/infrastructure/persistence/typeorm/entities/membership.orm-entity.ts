import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the Membership aggregate
 * (schema `membership`, table `memberships`).
 *
 * One row per (person, community) pair. `status` and `role` are real columns
 * because the roster and live-pair finders filter on them; the last judgment
 * rides as verdict + snapshot reference (the frozen snapshot itself is
 * re-anchored to the current row on load). Never confused with the domain
 * aggregate: this class carries columns only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Entity('memberships', { schema: 'membership' })
@Index(['communityId', 'status'])
export class MembershipOrmEntity extends AuditableOrmEntity {
  /** Membership identity (`mem-` prefixed). */
  @PrimaryColumn() id: string;
  /** Person reference (`per-` prefixed). */
  @Column() personId: string;
  /** Community reference (`com-` prefixed). */
  @Column() communityId: string;
  /** Standing: REQUESTED | ACTIVE | DELINQUENT | SUSPENDED | TERMINATED. */
  @Column() status: string;
  /** Role kind: PRESIDENT | BOARD_MEMBER | OWNER. */
  @Column() role: string;
  /** Dwelling code, when a unit is assigned. */
  @Column({ nullable: true }) unitCode: string | null;
  /** Last verdict: ELIGIBLE | NOT_ELIGIBLE, when ever judged. */
  @Column({ nullable: true }) lastVerdict: string | null;
  /** Last frozen snapshot reference, when ever judged. */
  @Column({ nullable: true }) lastSnapshotRef: string | null;
}
