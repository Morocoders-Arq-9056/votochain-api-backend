import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when a membership is suspended.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipSuspendedEvent implements DomainEvent {
  static readonly eventName = 'MembershipSuspended';
  readonly eventName = MembershipSuspendedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param reason Recorded suspension reason.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly reason: string,
  ) {}
}
