import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * NOTE (pre-existing ESM TDZ fix): `DeliveryOrderOrmEntity` is declared FIRST
 * because `SendingAttemptOrmEntity.order` carries eager `design:type` metadata
 * referencing it. Declared in the opposite order, ESM evaluation throws
 * `ReferenceError: Cannot access 'DeliveryOrderOrmEntity' before initialization`
 * at import time. The `@OneToMany`/`@ManyToOne` closures stay lazy.
 */
@Entity('orders', { schema: 'relay' })
export class DeliveryOrderOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'content_ref' })
  contentRef!: string;

  @Column({ name: 'payer_ref' })
  payerRef!: string;

  @Column({ name: 'order_position', type: 'int' })
  orderPosition!: number;

  @Column()
  standing!: string;

  @OneToMany(() => SendingAttemptOrmEntity, (a) => a.order, { cascade: true })
  attempts!: SendingAttemptOrmEntity[];
}

@Entity('sending_attempts', { schema: 'relay' })
export class SendingAttemptOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ name: 'attempt_no', type: 'int' })
  attemptNo!: number;

  @Column()
  outcome!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @ManyToOne(() => DeliveryOrderOrmEntity, (o) => o.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: DeliveryOrderOrmEntity;
}
