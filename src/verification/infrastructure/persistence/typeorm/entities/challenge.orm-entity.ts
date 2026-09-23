import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the VerificationChallenge aggregate
 * (schema `verification`, table `challenges`).
 *
 * One row per (person, purpose) proof attempt; at most one OPEN per pair —
 * enforced by the partial `uq_open_pair` index (see Sprint-01 DDL), not by
 * this class. Never carries the plain code, only its hash. Never confused
 * with the domain aggregate: this class carries columns only.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Entity('challenges', { schema: 'verification' })
@Index(['personId', 'purpose', 'standing'])
export class ChallengeOrmEntity extends AuditableOrmEntity {
  /** Challenge identity (`ch-` prefixed). */
  @PrimaryColumn() id: string;
  /** Referenced person id (`per-` prefixed). */
  @Column() personId: string;
  /** Proof purpose: login | email-verification | password-reset. */
  @Column() purpose: string;
  /** Challenge standing: OPEN | CONFIRMED | INVALIDATED | EXPIRED. */
  @Column() standing: string;
  /** Judged attempts so far. */
  @Column() attempts: number;
  /** Agreed maximum attempts. */
  @Column() maxAttempts: number;
  /** HMAC-SHA256 hex of the presented code; never plain. */
  @Column() codeHash: string;
  /** When the challenge was requested. */
  @Column() requestedAt: Date;
  /** When the challenge stops being answerable. */
  @Column() expiresAt: Date;
  /** Why the challenge ended unconfirmed, or null. */
  @Column({ type: 'varchar', length: 24, nullable: true }) reason: string | null;
}
