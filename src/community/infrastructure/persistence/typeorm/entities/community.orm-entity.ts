import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the Community aggregate
 * (schema `community`, table `communities`).
 *
 * One row per community. Settings live in real columns because the
 * `findByName` finder filters on them; the voting policy head and the
 * administrator list ride as JSONB because they are always loaded with
 * the root and never queried per-child. The policy head nests its
 * `supersedes` chain inline (see Sprint-01 DDL comment), so superseded
 * versions remain history without a second table. Never confused with
 * the domain aggregate: this class carries columns only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Entity('communities', { schema: 'community' })
@Index(['standing'])
export class CommunityOrmEntity extends AuditableOrmEntity {
  /** Community identity (`com-` prefixed). */
  @PrimaryColumn() id: string;
  /** Community standing: REGISTERED | ACTIVE | SUSPENDED | ARCHIVED. */
  @Column() standing: string;
  /** Community name; unique among live communities (guarded in application). */
  @Column() name: string;
  /** Community domicile. */
  @Column() domicile: string;
  /** Community contact. */
  @Column() contact: string;
  /** Current policy head with its nested supersedes chain, or null when undefined. */
  @Column({ type: 'jsonb', nullable: true })
  policy: { threshold: number; basis: string; majorityRule: string; supersedes: unknown | null } | null;
  /** Entrusted administrators as person references with entrustment moments. */
  @Column({ type: 'jsonb', default: [] })
  admins: { personId: string; entrustedAt: string }[];
}
