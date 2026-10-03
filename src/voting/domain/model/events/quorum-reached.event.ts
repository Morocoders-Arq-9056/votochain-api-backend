import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";

export class QuorumReachedEvent implements DomainEvent {
  static readonly eventName = 'QuorumReached';
  readonly eventName = QuorumReachedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly turnout: number,
  ) {}
}
