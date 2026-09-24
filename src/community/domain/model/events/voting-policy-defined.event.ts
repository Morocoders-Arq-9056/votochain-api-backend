import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { VotingPolicy } from "../valueobjects/voting-policy.value-object.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";

/**
 * Event emitted when a voting policy is defined. Each definition supersedes
 * the previous one; superseded versions remain history, never edited.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class VotingPolicyDefinedEvent implements DomainEvent {
  static readonly eventName = 'VotingPolicyDefined';
  readonly eventName = VotingPolicyDefinedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly communityId: CommunityId,
    public readonly policy: VotingPolicy,
    public readonly supersedes: VotingPolicy | null,
  ) {}
}
