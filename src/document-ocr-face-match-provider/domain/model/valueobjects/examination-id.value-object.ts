import { randomUUID } from "node:crypto";

/**
 * Identity of a DocumentExamination aggregate (`exm-` prefixed). Stable,
 * never reused: a reexamination is a fresh identity, never a transition.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
export class ExaminationId {
  private constructor(public readonly value: string) {}

  static generate(): ExaminationId { return new ExaminationId(`exm-${randomUUID()}`); }

  static of(v: string): ExaminationId {
    if (!v?.trim()) throw new Error('invalid examination id');
    return new ExaminationId(v);
  }

  equals(o: ExaminationId): boolean { return this.value === o.value; }
}
