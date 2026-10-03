import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";
import { Unit } from "../valueobjects/unit.value-object.js";

/**
 * Event emitted when a dwelling unit is assigned.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class UnitAssignedEvent implements DomainEvent {
  static readonly eventName = 'UnitAssigned';
  readonly eventName = UnitAssignedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param unit Dwelling unit assigned.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly unit: Unit,
  ) {}
}
