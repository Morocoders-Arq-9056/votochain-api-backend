import { randomUUID } from "node:crypto";
import { CommunityId } from "./community-id.value-object.js";
import { MembershipStatus } from "./membership-status.value-object.js";
import { PersonId } from "./person-id.value-object.js";

/**
 * Frozen answer to "is this person eligible right now?". The snapshot is
 * frozen at the moment asked: later standing changes only affect future
 * judgments, never rewrite this one (H3). `NotEligible` is a verdict held
 * here, never an exception.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class EligibilitySnapshot {
  /**
   * Creates a snapshot; use {@link EligibilitySnapshot.now},
   * {@link EligibilitySnapshot.withVerdict} or {@link EligibilitySnapshot.rehydrate}.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   * @param standingObserved Standing at the moment of judgment.
   * @param verdict Eligibility verdict.
   * @param reference Stable reference Voting freezes a copy of.
   * @param judgedAt Moment of judgment.
   */
  private constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
    public readonly standingObserved: MembershipStatus,
    public readonly verdict: boolean,
    public readonly reference: string,
    public readonly judgedAt: Date,
  ) {
    if (!personId) throw new Error('personId required');
    if (!communityId) throw new Error('communityId required');
    if (!standingObserved) throw new Error('standingObserved required');
    if (!reference?.trim()) throw new Error('reference required');
    if (!judgedAt) throw new Error('judgedAt required');
    Object.freeze(this);
  }

  /**
   * Drafts a snapshot for the current moment with a negative placeholder
   * verdict; finalize with {@link EligibilitySnapshot.withVerdict}.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   * @param standingObserved Standing observed right now.
   */
  static now(personId: PersonId, communityId: CommunityId, standingObserved: MembershipStatus): EligibilitySnapshot {
    return new EligibilitySnapshot(personId, communityId, standingObserved, false, `snap-${randomUUID()}`, new Date());
  }

  /**
   * Rebuilds a stored snapshot without raising events.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   * @param standingObserved Standing at the moment of judgment.
   * @param verdict Eligibility verdict.
   * @param reference Stable reference Voting freezes a copy of.
   * @param judgedAt Moment of judgment.
   */
  static rehydrate(
    personId: PersonId,
    communityId: CommunityId,
    standingObserved: MembershipStatus,
    verdict: boolean,
    reference: string,
    judgedAt: Date,
  ): EligibilitySnapshot {
    return new EligibilitySnapshot(personId, communityId, standingObserved, verdict, reference, judgedAt);
  }

  /**
   * Freezes the final verdict, keeping reference and moment.
   * @param eligible Verdict judged by the eligibility policy.
   */
  withVerdict(eligible: boolean): EligibilitySnapshot {
    return new EligibilitySnapshot(
      this.personId, this.communityId, this.standingObserved, eligible, this.reference, this.judgedAt,
    );
  }

  /**
   * Value comparison by stable reference.
   * @param o Other snapshot.
   */
  equals(o: EligibilitySnapshot): boolean {
    return this.reference === o.reference;
  }
}
