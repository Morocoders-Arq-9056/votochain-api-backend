import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class ReplayRejectedEvent implements DomainEvent {
  static readonly eventName = 'ReplayRejected';
  readonly eventName = ReplayRejectedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly reason: string,
  ) {}
}
