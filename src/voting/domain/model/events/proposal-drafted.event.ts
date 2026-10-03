import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class ProposalDraftedEvent implements DomainEvent {
  static readonly eventName = 'ProposalDrafted';
  readonly eventName = ProposalDraftedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly communityId: CommunityId,
  ) {}
}
