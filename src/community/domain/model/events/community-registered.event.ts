import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunitySettings } from "../valueobjects/community-settings.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a community is registered.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityRegisteredEvent implements DomainEvent {
  static readonly eventName = 'CommunityRegistered';
  readonly eventName = CommunityRegisteredEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly settings: CommunitySettings,
  ) {}
}
