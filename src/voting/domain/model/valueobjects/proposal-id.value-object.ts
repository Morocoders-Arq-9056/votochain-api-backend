import { randomUUID } from "node:crypto";

/**
 * Identity of a proposal. Generated as `prop-<uuid>`.
 */
export class ProposalId {
  private constructor(public readonly value: string) {}

  static generate(): ProposalId { return new ProposalId(`prop-${randomUUID()}`); }

  static of(v: string): ProposalId {
    if (!v?.trim()) throw new Error('invalid proposal id');
    return new ProposalId(v);
  }

  equals(o: ProposalId): boolean { return this.value === o.value; }
}
