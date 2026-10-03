import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class ProposalClosedEvent implements DomainEvent {
  static readonly eventName = 'ProposalClosed';
  readonly eventName = ProposalClosedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly closedAt: Date,
  ) {}
}
