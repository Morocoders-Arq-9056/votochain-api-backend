import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityRole } from "../valueobjects/community-role.value-object.js";
import { MembershipId } from "../valueobjects/membership-id.value-object.js";

/**
 * Event emitted when a community role is assigned.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class CommunityRoleAssignedEvent implements DomainEvent {
  static readonly eventName = 'CommunityRoleAssigned';
  readonly eventName = CommunityRoleAssignedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates the event.
   * @param membershipId Membership identity.
   * @param role Community role assigned.
   */
  constructor(
    public readonly membershipId: MembershipId,
    public readonly role: CommunityRole,
  ) {}
}
