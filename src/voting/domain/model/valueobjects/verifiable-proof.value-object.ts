import { Choice } from "./choice.value-object.js";
import { EIP712Signature } from "./eip712-signature.value-object.js";
import { ProposalId } from "./proposal-id.value-object.js";
import { TransactionReference } from "./transaction-reference.value-object.js";
import { VoteId } from "./vote-id.value-object.js";
import { VoteStatus } from "./vote-status.value-object.js";
import { VoterAddress } from "./voter-address.value-object.js";

/**
 * Verifiable proof of a vote: choice + signature + tx + recovered signer —
 * verifiable without trusting this platform. Identity travels as typed value
 * objects, never bare strings.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class VerifiableProof {
  private constructor(
    public readonly voteId: VoteId,
    public readonly proposalId: ProposalId,
    public readonly choice: Choice,
    public readonly signature: EIP712Signature,
    public readonly reference: TransactionReference | null,
    public readonly recovered: VoterAddress,
    public readonly status: VoteStatus,
  ) {
    if (!voteId) throw new Error('voteId required');
    if (!proposalId) throw new Error('proposalId required');
    if (!choice) throw new Error('choice required');
    if (!signature) throw new Error('signature required');
    if (!recovered) throw new Error('recovered signer required');
    if (!status) throw new Error('status required');
  }

  static from(input: {
    voteId: VoteId; proposalId: ProposalId; choice: Choice; signature: EIP712Signature;
    reference: TransactionReference | null; recovered: VoterAddress; status: VoteStatus;
  }): VerifiableProof {
    return new VerifiableProof(
      input.voteId, input.proposalId, input.choice, input.signature,
      input.reference, input.recovered, input.status,
    );
  }

  equals(o: VerifiableProof): boolean {
    return this.voteId.equals(o.voteId)
      && this.choice.equals(o.choice)
      && this.signature.equals(o.signature)
      && this.recovered.equals(o.recovered)
      && this.status === o.status;
  }
}
