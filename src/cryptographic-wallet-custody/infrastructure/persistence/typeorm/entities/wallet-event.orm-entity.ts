import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Scrutiny log of wallet facts (schema `wallet`, table `events`). The
 * adapter appends the aggregate's drained-safe events in the same unit of
 * work as the wallet row. Child rows, not jsonb — attempts have identity
 * and their own queries.
 */
@Entity('events', { schema: 'wallet' })
export class WalletEventOrmEntity {
  @PrimaryGeneratedColumn() seq: number;
  @Column() walletId: string;
  @Column() eventName: string;
  @Column('jsonb') payload: Record<string, unknown>;
  @Column() occurredAt: Date;
}
