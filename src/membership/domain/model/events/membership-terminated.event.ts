import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when a membership is terminated.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MembershipTerminatedEvent implements DomainEvent {
  static readonly eventName = 'MembershipTerminated';
  readonly eventName = MembershipTerminatedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param reason Recorded termination reason.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly reason: string,
  ) {}
}
