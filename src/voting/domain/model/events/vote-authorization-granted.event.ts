import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { EligibilitySnapshot } from "../valueobjects/eligibility-snapshot.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class VoteAuthorizationGrantedEvent implements DomainEvent {
  static readonly eventName = 'VoteAuthorizationGranted';
  readonly eventName = VoteAuthorizationGrantedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly eligibility: EligibilitySnapshot,
  ) {}
}
