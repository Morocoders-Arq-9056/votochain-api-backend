import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a community is archived. Terminal.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityArchivedEvent implements DomainEvent {
  static readonly eventName = 'CommunityArchived';
  readonly eventName = CommunityArchivedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly reason: string,
  ) {}
}
