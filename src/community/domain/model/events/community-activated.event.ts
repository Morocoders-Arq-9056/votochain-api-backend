import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a community is activated.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityActivatedEvent implements DomainEvent {
  static readonly eventName = 'CommunityActivated';
  readonly eventName = CommunityActivatedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(public readonly communityId: CommunityId) {}
}
