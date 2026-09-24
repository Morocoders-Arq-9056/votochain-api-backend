import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a community is suspended.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunitySuspendedEvent implements DomainEvent {
  static readonly eventName = 'CommunitySuspended';
  readonly eventName = CommunitySuspendedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly reason: string,
  ) {}
}
