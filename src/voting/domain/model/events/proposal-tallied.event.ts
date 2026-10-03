import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { Tally } from "../valueobjects/tally.value-object.js";

export class ProposalTalliedEvent implements DomainEvent {
  static readonly eventName = 'ProposalTallied';
  readonly eventName = ProposalTalliedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly tally: Tally,
  ) {}
}
