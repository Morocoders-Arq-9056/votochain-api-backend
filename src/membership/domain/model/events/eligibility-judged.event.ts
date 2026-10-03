import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { EligibilitySnapshot } from "../valueobjects/eligibility-snapshot.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Event emitted when eligibility is judged.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class EligibilityJudgedEvent implements DomainEvent {
  static readonly eventName = 'EligibilityJudged';
  readonly eventName = EligibilityJudgedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   * @param snapshot Frozen eligibility snapshot.
   */
  constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
    public readonly snapshot: EligibilitySnapshot,
  ) {}
}
