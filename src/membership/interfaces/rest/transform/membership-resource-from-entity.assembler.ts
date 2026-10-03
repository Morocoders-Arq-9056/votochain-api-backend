import { Membership } from "../../../domain/model/aggregates/membership.aggregate.js";
import type { MembershipStatus } from "../../../domain/model/valueobjects/membership-status.value-object.js";
import { EligibilitySnapshot } from "../../../domain/model/valueobjects/eligibility-snapshot.value-object.js";
import { EligibilityAnswerResource } from "../resources/eligibility-answer.resource.js";
import { MembershipResource } from "../resources/membership.resource.js";

/**
 * Renders response resources straight from the re-read aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipResourceFromEntityAssembler {
  /**
   * Renders one membership resource from its aggregate.
   * @param membership Re-read aggregate just written or queried.
   */
  static toResourceFromEntity(membership: Membership): MembershipResource {
    const last = membership.lastEligibility;
    return new MembershipResource(
      membership.id.value,
      membership.personId.value,
      membership.communityId.value,
      membership.status,
      membership.role.kind,
      membership.unit?.code ?? null,
      last ? (last.verdict ? 'ELIGIBLE' : 'NOT_ELIGIBLE') : null,
      last?.reference ?? null,
    );
  }

  /**
   * Renders a resource per membership, preserving order, optionally narrowed
   * to one standing. The status predicate lives here so the controller stays
   * a thin orchestration line.
   * @param memberships Aggregates to render (e.g. roster, person's pairs).
   * @param status Standing to keep, or null for the whole list.
   */
  static toResourceList(memberships: Membership[], status: MembershipStatus | null = null): MembershipResource[] {
    const narrowed = status ? memberships.filter((m) => m.status === status) : memberships;
    return narrowed.map((m) => this.toResourceFromEntity(m));
  }

  /**
   * Renders the frozen judgment answer from its snapshot.
   * @param snapshot Frozen judgment just commanded.
   */
  static toEligibilityAnswerResource(snapshot: EligibilitySnapshot): EligibilityAnswerResource {
    return new EligibilityAnswerResource(snapshot.verdict, snapshot.reference, snapshot.standingObserved);
  }
}
