import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when delinquency is cleared.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class DelinquencyClearedEvent implements DomainEvent {
  static readonly eventName = 'DelinquencyCleared';
  readonly eventName = DelinquencyClearedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   */
  constructor(public readonly membershipId: MembershipId) {}
}
