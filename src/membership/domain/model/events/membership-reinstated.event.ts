import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when a membership is reinstated.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipReinstatedEvent implements DomainEvent {
  static readonly eventName = 'MembershipReinstated';
  readonly eventName = MembershipReinstatedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   */
  constructor(public readonly membershipId: MembershipId) {}
}
