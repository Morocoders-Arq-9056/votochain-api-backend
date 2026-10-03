import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import type { AuthorizationDenialReason } from "../valueobjects/authorization-denial-reason.value-object.js";
import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class VoteAuthorizationDeniedEvent implements DomainEvent {
  static readonly eventName = 'VoteAuthorizationDenied';
  readonly eventName = VoteAuthorizationDeniedEvent.eventName;
  readonly occurredAt = new Date();

  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly reason: AuthorizationDenialReason,
  ) {}
}
