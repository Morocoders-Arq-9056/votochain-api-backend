import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the UserWallet aggregate (schema `wallet`, table
 * `wallets`). Structural invariant: no column can hold signing material —
 * only the position, the standing and the opaque open-for reference.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Entity('wallets', { schema: 'wallet' })
export class WalletOrmEntity extends AuditableOrmEntity {
  /** Wallet identity (`wal-` prefixed). */
  @PrimaryColumn() id: string;
  /** Person reference (`per-` prefixed). */
  @Column() personId: string;
  /** Ordered derivation position (UNIQUE). */
  @Column('int') derivationPosition: number;
  /** Standing: PROVISIONED | SIGNING_OPEN | ROTATED | SUSPENDED | RETIRED. */
  @Column() standing: string;
  /** Opaque open-for reference, never a secret. */
  @Column({ type: 'text', nullable: true }) openFor: string | null;
}
