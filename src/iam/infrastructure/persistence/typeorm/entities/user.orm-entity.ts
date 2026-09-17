import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the User aggregate (schema `iam`, table `users`).
 *
 * Roles are stored as a `simple-array` (comma-separated TEXT) per impl-guide:
 * the VO-set is the correct shape — no child table, no Composite. Never
 * confused with the domain aggregate: this class carries columns only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Entity('users', { schema: 'iam' })
export class UserOrmEntity extends AuditableOrmEntity {
  /** Technical identity id (`usr-` prefixed). */
  @PrimaryColumn() id: string;
  /** Referenced person id (`per-` prefixed), unique per identity. */
  @Column({ unique: true }) personId: string;
  /** Access standing: REGISTERED | ACTIVE | SUSPENDED. */
  @Column() standing: string;
  /** Session standing: SESSION_CLOSED | SESSION_OPEN. */
  @Column() session: string;
  /** Recorded contact email, globally unique. */
  @Column({ unique: true }) email: string;
  /** Whether the recorded address stands verified. */
  @Column() emailVerified: boolean;
  /** Held system roles as comma-separated values (simple-array). */
  @Column('simple-array') roles: string[];
  /** Linked outside prover (`auth0`) or null. */
  @Column({ nullable: true }) outsideProver: string | null;
}
