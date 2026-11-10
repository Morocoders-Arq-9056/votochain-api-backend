import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the VerificationAttempt aggregate
 * (schema `biometric`, table `attempts`). Ephemeral; carries standings and
 * freshness only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Entity('attempts', { schema: 'biometric' })
@Index(['personId', 'standing'])
export class AttemptOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() personId: string;
  @Column() profileId: string;
  @Column() standing: string;
  @Column() freshnessStart: Date;
  @Column('int') freshnessMinutes: number;
  @Column({ type: 'varchar', length: 32, nullable: true }) failureReason: string | null;
}
