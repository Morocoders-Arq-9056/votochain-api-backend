import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { QuorumSnapshot } from "../valueobjects/quorum-snapshot.value-object.js";

export class ProposalOpenedEvent implements DomainEvent {
  static readonly eventName = 'ProposalOpened';
  readonly eventName = ProposalOpenedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly quorum: QuorumSnapshot,
  ) {}
}
