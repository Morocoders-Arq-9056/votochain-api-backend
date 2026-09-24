import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunitySettings } from "../valueobjects/community-settings.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when the settings of a community are updated.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunitySettingsUpdatedEvent implements DomainEvent {
  static readonly eventName = 'CommunitySettingsUpdated';
  readonly eventName = CommunitySettingsUpdatedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly settings: CommunitySettings,
  ) {}
}
