import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the BiometricProfile aggregate
 * (schema `biometric`, table `profiles`). No images, crops or descriptors.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Entity('profiles', { schema: 'biometric' })
export class ProfileOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() personId: string;
  @Column() standing: string;
}
