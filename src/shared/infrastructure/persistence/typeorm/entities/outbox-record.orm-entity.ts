import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditableOrmEntity } from '../../../persistence/auditable.orm-entity.js';

/**
 * Durable row for one domain event (transactional outbox, `shared` schema).
 * Written in the same transaction as the business change; the relay emits
 * unpublished rows after commit (sync path) or on startup/sweep (recovery).
 * At-least-once: handlers stay idempotent by standing guards and UNIQUEs.
 */
@Entity('outbox', { schema: 'shared' })
export class OutboxRecordOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;

  @Column() eventName: string;

  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;

  @Column({ default: false }) published: boolean;

  @Column({ type: 'timestamptz' }) occurredAt: Date;
}

export const OUTBOX_UNPUBLISHED_INDEX = 'ix_outbox_unpublished';
