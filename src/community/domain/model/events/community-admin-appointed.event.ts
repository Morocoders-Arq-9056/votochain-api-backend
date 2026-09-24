import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a community administrator is appointed.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityAdminAppointedEvent implements DomainEvent {
  static readonly eventName = 'CommunityAdminAppointed';
  readonly eventName = CommunityAdminAppointedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly personId: PersonId,
  ) {}
}
