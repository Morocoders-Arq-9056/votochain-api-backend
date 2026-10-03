/**
 * Roster observed in UC3 and frozen in `grant()`. Later roster changes never
 * rewrite this copy. Person and community travel as typed references, never
 * bare strings.
 */
import { CommunityId } from "./community-id.value-object.js";
import { PersonId } from "./person-id.value-object.js";

export class EligibilitySnapshot {
  private constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
    public readonly verdict: string,
    public readonly reference: string,
    public readonly judgedAt: Date,
  ) {
    if (!personId) throw new Error('personId required');
    if (!communityId) throw new Error('communityId required');
    if (!verdict?.trim()) throw new Error('invalid eligibility verdict');
    if (!reference?.trim()) throw new Error('reference required');
    if (!judgedAt) throw new Error('judgedAt required');
  }

  static freeze(input: { personId: PersonId; communityId: CommunityId; verdict: string; reference: string; judgedAt?: Date }): EligibilitySnapshot {
    const snapshot = new EligibilitySnapshot(
      input.personId, input.communityId, input.verdict, input.reference, input.judgedAt ?? new Date(),
    );
    return Object.freeze(snapshot);
  }

  equals(o: EligibilitySnapshot): boolean {
    return this.personId.equals(o.personId)
      && this.communityId.equals(o.communityId)
      && this.verdict === o.verdict
      && this.reference === o.reference;
  }
}
