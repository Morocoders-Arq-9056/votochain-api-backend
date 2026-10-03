import { PersonId } from "../valueobjects/person-id.value-object.js";
import { ProposalId } from "../valueobjects/proposal-id.value-object.js";
import { VoterAddress } from "../valueobjects/voter-address.value-object.js";

export class RequestVoteAuthorizationCommand {
  constructor(
    public readonly proposalId: ProposalId,
    public readonly voterAddress: VoterAddress,
    public readonly personId: PersonId,
    public readonly walletHint: string | null = null,
  ) {
    if (!proposalId) throw new Error('proposalId required');
    if (!voterAddress) throw new Error('voterAddress required');
    if (!personId) throw new Error('personId required');
  }
}
