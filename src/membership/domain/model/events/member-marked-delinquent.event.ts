import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when a member is marked delinquent.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class MemberMarkedDelinquentEvent implements DomainEvent {
  static readonly eventName = 'MemberMarkedDelinquent';
  readonly eventName = MemberMarkedDelinquentEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param reason Recorded delinquency reason.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly reason: string,
  ) {}
}
