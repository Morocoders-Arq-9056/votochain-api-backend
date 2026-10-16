import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

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
