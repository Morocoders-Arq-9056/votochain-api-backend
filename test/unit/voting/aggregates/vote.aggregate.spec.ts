import { Vote } from '../../../../src/voting/domain/model/aggregates/vote.aggregate.js';
import { Choice } from '../../../../src/voting/domain/model/valueobjects/choice.value-object.js';
import { EIP712Signature } from '../../../../src/voting/domain/model/valueobjects/eip712-signature.value-object.js';
import { ProposalId } from '../../../../src/voting/domain/model/valueobjects/proposal-id.value-object.js';
import { TransactionReference } from '../../../../src/voting/domain/model/valueobjects/transaction-reference.value-object.js';
import { VoteId } from '../../../../src/voting/domain/model/valueobjects/vote-id.value-object.js';
import { VoteNonce } from '../../../../src/voting/domain/model/valueobjects/vote-nonce.value-object.js';
import { VoterAddress } from '../../../../src/voting/domain/model/valueobjects/voter-address.value-object.js';
import { VoteStatus } from '../../../../src/voting/domain/model/valueobjects/vote-status.value-object.js';
import { SignedVoteQueuedEvent } from '../../../../src/voting/domain/model/events/signed-vote-queued.event.js';
import { TransactionSentEvent } from '../../../../src/voting/domain/model/events/transaction-sent.event.js';
import { VoteCastEvent } from '../../../../src/voting/domain/model/events/vote-cast.event.js';
import { VoteConfirmedOnChainEvent } from '../../../../src/voting/domain/model/events/vote-confirmed-on-chain.event.js';
import { VoteMessageBuiltEvent } from '../../../../src/voting/domain/model/events/vote-message-built.event.js';
import { SignerMismatchError } from '../../../../src/voting/domain/exceptions/signer-mismatch.error.js';

const VOTER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function voter(): VoterAddress {
  return VoterAddress.of(VOTER);
}

function signature(): EIP712Signature {
  return EIP712Signature.create({ v: 27, r: '0xabc', s: '0xdef' });
}

function castVote(): Vote {
  return Vote.cast(
    VoteId.generate(),
    ProposalId.of('prop-1'),
    voter(),
    Choice.of('yes'),
    VoteNonce.of('nonce-1'),
    signature(),
    voter(),
  );
}

describe('Vote aggregate', () => {
  it('builds the signable message as vote:proposal:voter:choice:nonce', () => {
    const message = Vote.buildMessage(
      ProposalId.of('prop-1'),
      voter(),
      Choice.of('yes'),
      VoteNonce.of('nonce-1'),
    );

    expect(message).toBe(`vote:prop-1:${VOTER}:yes:nonce-1`);
  });

  it('casts SIGNED emitting VoteMessageBuiltEvent then VoteCastEvent in order', () => {
    const vote = castVote();

    expect(vote.status).toBe(VoteStatus.SIGNED);

    const events = vote.pullDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(VoteMessageBuiltEvent);
    expect(events[1]).toBeInstanceOf(VoteCastEvent);
  });

  it('refuses to cast when the recovered signer differs from the voter', () => {
    expect(() =>
      Vote.cast(
        VoteId.generate(),
        ProposalId.of('prop-1'),
        voter(),
        Choice.of('yes'),
        VoteNonce.of('nonce-1'),
        signature(),
        VoterAddress.of(OTHER),
      ),
    ).toThrow(SignerMismatchError);
  });

  it('transitions SIGNED → QUEUED → SENT → CONFIRMED', () => {
    const vote = castVote();
    vote.pullDomainEvents();

    vote.markQueued();
    expect(vote.status).toBe(VoteStatus.QUEUED);
    expect(vote.pullDomainEvents()[0]).toBeInstanceOf(SignedVoteQueuedEvent);

    vote.markSent(TransactionReference.of({ txHash: '0xhash' }));
    expect(vote.status).toBe(VoteStatus.SENT);
    expect(vote.reference?.txHash).toBe('0xhash');
    expect(vote.pullDomainEvents()[0]).toBeInstanceOf(TransactionSentEvent);

    vote.markConfirmed(TransactionReference.of({ txHash: '0xhash', blockNumber: 42 }), 42);
    expect(vote.status).toBe(VoteStatus.CONFIRMED);

    const events = vote.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(VoteConfirmedOnChainEvent);
  });
});
