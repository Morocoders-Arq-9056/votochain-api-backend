import { Proposal } from '../../../../src/voting/domain/model/aggregates/proposal.aggregate.js';
import { Vote } from '../../../../src/voting/domain/model/aggregates/vote.aggregate.js';
import { BallotOptions } from '../../../../src/voting/domain/model/valueobjects/ballot-options.value-object.js';
import { Choice } from '../../../../src/voting/domain/model/valueobjects/choice.value-object.js';
import { CommunityId } from '../../../../src/voting/domain/model/valueobjects/community-id.value-object.js';
import { EIP712Signature } from '../../../../src/voting/domain/model/valueobjects/eip712-signature.value-object.js';
import { ProposalId } from '../../../../src/voting/domain/model/valueobjects/proposal-id.value-object.js';
import { ProposalStatus } from '../../../../src/voting/domain/model/valueobjects/proposal-status.value-object.js';
import { QuorumSnapshot } from '../../../../src/voting/domain/model/valueobjects/quorum-snapshot.value-object.js';
import { TransactionReference } from '../../../../src/voting/domain/model/valueobjects/transaction-reference.value-object.js';
import { VoteId } from '../../../../src/voting/domain/model/valueobjects/vote-id.value-object.js';
import { VoteNonce } from '../../../../src/voting/domain/model/valueobjects/vote-nonce.value-object.js';
import { VoteStatus } from '../../../../src/voting/domain/model/valueobjects/vote-status.value-object.js';
import { VoterAddress } from '../../../../src/voting/domain/model/valueobjects/voter-address.value-object.js';

const VOTER_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const VOTER_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const VOTER_C = '0xcccccccccccccccccccccccccccccccccccccccc';

function signature(): EIP712Signature {
  return EIP712Signature.create({ v: 27, r: '0xabc', s: '0xdef' });
}

function castFor(voter: string, choice: string): Vote {
  const address = VoterAddress.of(voter);
  return Vote.cast(
    VoteId.generate(),
    ProposalId.of('prop-1'),
    address,
    Choice.of(choice),
    VoteNonce.fresh(),
    signature(),
    address,
  );
}

function openProposal(): Proposal {
  const p = Proposal.create(
    ProposalId.of('prop-1'),
    CommunityId.of('com-1'),
    BallotOptions.of(['yes', 'no']),
  );
  p.open(QuorumSnapshot.freeze({ threshold: 2, basis: 'members' }));
  p.close();
  return p;
}

/**
 * TECH-DEBT-01 regression (closed Sprint-04): only CONFIRMED votes feed the
 * tally. SIGNED / QUEUED / SENT are intent — never fact.
 */
describe('CONFIRMED-only tally (TECH-DEBT-01)', () => {
  it('counts only CONFIRMED votes against the frozen snapshot', () => {
    const signed = castFor(VOTER_A, 'yes');
    const queued = castFor(VOTER_B, 'yes');
    queued.markQueued();
    const sent = castFor(VOTER_C, 'no');
    sent.markQueued();
    sent.markSent(TransactionReference.of({ txHash: '0x123' }));

    expect(signed.status).toBe(VoteStatus.SIGNED);
    expect(queued.status).toBe(VoteStatus.QUEUED);
    expect(sent.status).toBe(VoteStatus.SENT);

    const confirmed = [signed, queued, sent].filter((v) => v.status === VoteStatus.CONFIRMED);
    expect(confirmed).toHaveLength(0);

    const proposal = openProposal();
    proposal.tallyVotes(new Map(), 0);
    expect(proposal.status).toBe(ProposalStatus.TALLIED);
    expect(proposal.tally?.turnout).toBe(0);
  });

  it('tallies a CONFIRMED vote once it is confirmed on-chain', () => {
    const vote = castFor(VOTER_A, 'yes');
    vote.markQueued();
    vote.markSent(TransactionReference.of({ txHash: '0x123' }));
    vote.markConfirmed(TransactionReference.of({ txHash: '0x123' }), 1);
    expect(vote.status).toBe(VoteStatus.CONFIRMED);

    const stored = [vote].filter((v) => v.status === VoteStatus.CONFIRMED);
    const counts = new Map<string, number>();
    for (const v of stored) counts.set(v.choice.value, (counts.get(v.choice.value) ?? 0) + 1);

    const proposal = openProposal();
    proposal.tallyVotes(counts, stored.length);
    expect(proposal.tally?.turnout).toBe(1);
    expect(proposal.tally?.countFor(Choice.of('yes'))).toBe(1);
  });
});
