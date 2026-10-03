import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Event emitted when a membership is registered.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipRegisteredEvent implements DomainEvent {
  static readonly eventName = 'MembershipRegistered';
  readonly eventName = MembershipRegisteredEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param personId Person joining.
   * @param communityId Community joined.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
  ) {}
}
