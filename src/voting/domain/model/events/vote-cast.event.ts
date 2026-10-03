import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { EIP712Signature } from "../valueobjects/eip712-signature.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoteId } from "../valueobjects/vote-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class VoteCastEvent implements DomainEvent {
  static readonly eventName = 'VoteCast';
  readonly eventName = VoteCastEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly voteId: VoteId,
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly signature: EIP712Signature,
  ) {}
}
