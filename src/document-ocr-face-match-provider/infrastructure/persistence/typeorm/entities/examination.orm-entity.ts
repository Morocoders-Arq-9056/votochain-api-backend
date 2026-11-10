import { Column, Entity, PrimaryColumn } from "typeorm";
import { AuditableOrmEntity } from "../../../../../shared/infrastructure/persistence/auditable.orm-entity.js";

/**
 * Persistence shape of the DocumentExamination aggregate
 * (schema `ocr`, table `examinations`). No blobs: the evidence dies with the
 * examination — only judgments and closed reasons are stored.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Entity('examinations', { schema: 'ocr' })
export class ExaminationOrmEntity extends AuditableOrmEntity {
  /** Examination identity (`exm-` prefixed). */
  @PrimaryColumn() id: string;
  /** Person reference (`per-` prefixed). */
  @Column() personId: string;
  /** Document reference. */
  @Column() documentRef: string;
  /** Standing: OPEN | CONCLUDED | EXPIRED. */
  @Column() standing: string;
  /** Verdict: MATCH | NO_MATCH | UNREADABLE, when concluded. */
  @Column({ type: 'varchar', length: 16, nullable: true }) verdict: string | null;
  /** Single-use flag for a concluded MATCH. */
  @Column({ default: false }) consumed: boolean;
  /** Window start. */
  @Column() requestedAt: Date;
  /** Window length in minutes. */
  @Column('int') ttlMinutes: number;
  /** Closed unreadable reason (5), when the read failed. */
  @Column({ type: 'varchar', length: 32, nullable: true }) unreadableReason: string | null;
}
