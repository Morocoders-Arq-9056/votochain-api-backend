import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the NotificationDispatch aggregate
 * (schema `notifications`, table `dispatches`).
 *
 * One row per dispatch. History rides as `jsonb` because it is always loaded
 * with the root and never queried per attempt. The `channel` column carries
 * the structural invariant (always 'EMAIL', fixed by CHECK): a second channel
 * is a new concept with its own aggregate field, never a side-channel here.
 * Never confused with the domain aggregate: this class carries columns only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Entity('dispatches', { schema: 'notifications' })
@Index(['idempotencyKey'], { unique: true })
@Index(['standing'])
export class DispatchOrmEntity extends AuditableOrmEntity {
  /** Dispatch identity (`dsp-` prefixed). */
  @PrimaryColumn() id: string;
  /** Requester-supplied idempotency key; UNIQUE is the duplicate authority. */
  @Column() idempotencyKey: string;
  /** Destination address (email shape). */
  @Column() address: string;
  /** Channel invariant: always 'EMAIL'. */
  @Column({ default: 'EMAIL' }) channel: string;
  /** Known template key from the catalog. */
  @Column() templateKey: string;
  /** Render values for the template. */
  @Column({ type: 'jsonb', default: {} })
  templateValues: Record<string, string>;
  /** Reason supplied by the requester. */
  @Column() reason: string;
  /** Current standing: REQUESTED | REFUSED | CONFIRMED | FAILED. */
  @Column() standing: string;
  /** Append-only outcome history, oldest first.
   *  JSONB by design: always loaded with the root, never queried per entry. */
  @Column({ type: 'jsonb', default: [] })
  history: { at: string; outcome: string; detail?: string }[];
  /** Refusal cause when REFUSED, null otherwise. */
  @Column({ type: 'varchar', nullable: true }) refusal: string | null;
}
