import { Proposal } from '../../../../src/voting/domain/model/aggregates/proposal.aggregate.js';
import { BallotOptions } from '../../../../src/voting/domain/model/valueobjects/ballot-options.value-object.js';
import { Choice } from '../../../../src/voting/domain/model/valueobjects/choice.value-object.js';
import { CommunityId } from '../../../../src/voting/domain/model/valueobjects/community-id.value-object.js';
import { ProposalId } from '../../../../src/voting/domain/model/valueobjects/proposal-id.value-object.js';
import { ProposalStatus } from '../../../../src/voting/domain/model/valueobjects/proposal-status.value-object.js';
import { QuorumSnapshot } from '../../../../src/voting/domain/model/valueobjects/quorum-snapshot.value-object.js';
import { ProposalClosedEvent } from '../../../../src/voting/domain/model/events/proposal-closed.event.js';
import { ProposalDraftedEvent } from '../../../../src/voting/domain/model/events/proposal-drafted.event.js';
import { ProposalOpenedEvent } from '../../../../src/voting/domain/model/events/proposal-opened.event.js';
import { ProposalTalliedEvent } from '../../../../src/voting/domain/model/events/proposal-tallied.event.js';
import { QuorumNotReachedEvent } from '../../../../src/voting/domain/model/events/quorum-not-reached.event.js';
import { QuorumReachedEvent } from '../../../../src/voting/domain/model/events/quorum-reached.event.js';
import { IllegalProposalTransitionError } from '../../../../src/voting/domain/exceptions/illegal-proposal-transition.error.js';
import { InvalidChoiceError } from '../../../../src/voting/domain/exceptions/invalid-choice.error.js';
import { ProposalNotOpenError } from '../../../../src/voting/domain/exceptions/proposal-not-open.error.js';

function draftProposal(): Proposal {
  return Proposal.create(
    ProposalId.of('prop-1'),
    CommunityId.of('comm-1'),
    BallotOptions.of(['yes', 'no']),
  );
}

function openProposal(): Proposal {
  const proposal = draftProposal();
  proposal.pullDomainEvents();
  proposal.open(QuorumSnapshot.freeze({ threshold: 2, basis: 'members' }));
  return proposal;
}

function closedProposal(): Proposal {
  const proposal = openProposal();
  proposal.pullDomainEvents();
  proposal.close();
  return proposal;
}

describe('Proposal aggregate', () => {
  it('creates DRAFT with a ProposalDraftedEvent', () => {
    const proposal = draftProposal();

    expect(proposal.status).toBe(ProposalStatus.DRAFT);
    expect(proposal.quorum).toBeNull();
    expect(proposal.tally).toBeNull();

    const events = proposal.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProposalDraftedEvent);
  });

  it('opens once with a frozen quorum and refuses a second open', () => {
    const proposal = draftProposal();
    proposal.pullDomainEvents();

    proposal.open(QuorumSnapshot.freeze({ threshold: 2, basis: 'members' }));
    expect(proposal.status).toBe(ProposalStatus.OPEN);
    expect(proposal.quorum?.threshold).toBe(2);

    const events = proposal.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProposalOpenedEvent);

    expect(() =>
      proposal.open(QuorumSnapshot.freeze({ threshold: 5, basis: 'members' })),
    ).toThrow(IllegalProposalTransitionError);
  });

  it('closes only from OPEN', () => {
    const draft = draftProposal();
    expect(() => draft.close()).toThrow(IllegalProposalTransitionError);

    const proposal = openProposal();
    proposal.pullDomainEvents();

    proposal.close();
    expect(proposal.status).toBe(ProposalStatus.CLOSED);

    const events = proposal.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(ProposalClosedEvent);

    expect(() => proposal.close()).toThrow(IllegalProposalTransitionError);
  });

  it('tallies only from CLOSED and emits ProposalTalliedEvent + QuorumReached', () => {
    const draft = draftProposal();
    expect(() => draft.tallyVotes(new Map([['yes', 2]]), 2)).toThrow(
      IllegalProposalTransitionError,
    );

    const open = openProposal();
    expect(() => open.tallyVotes(new Map([['yes', 2]]), 2)).toThrow(
      IllegalProposalTransitionError,
    );

    const proposal = closedProposal();
    proposal.pullDomainEvents();

    proposal.tallyVotes(
      new Map([
        ['yes', 2],
        ['no', 1],
      ]),
      3,
    );
    expect(proposal.status).toBe(ProposalStatus.TALLIED);
    expect(proposal.tally?.quorumMet).toBe(true);
    expect(proposal.tally?.countFor(Choice.of('yes'))).toBe(2);

    const events = proposal.pullDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(ProposalTalliedEvent);
    expect(events[1]).toBeInstanceOf(QuorumReachedEvent);
  });

  it('emits QuorumNotReached when turnout is below the frozen threshold', () => {
    const proposal = draftProposal();
    proposal.pullDomainEvents();
    proposal.open(QuorumSnapshot.freeze({ threshold: 10, basis: 'members' }));
    proposal.close();
    proposal.pullDomainEvents();

    proposal.tallyVotes(new Map([['yes', 2]]), 2);
    expect(proposal.tally?.quorumMet).toBe(false);

    const events = proposal.pullDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(ProposalTalliedEvent);
    expect(events[1]).toBeInstanceOf(QuorumNotReachedEvent);
  });

  it('assertOpen throws ProposalNotOpenError when not OPEN', () => {
    const draft = draftProposal();
    expect(() => draft.assertOpen()).toThrow(ProposalNotOpenError);

    const open = openProposal();
    expect(() => open.assertOpen()).not.toThrow();

    open.close();
    expect(() => open.assertOpen()).toThrow(ProposalNotOpenError);
  });

  it('assertChoice throws InvalidChoiceError for an unknown choice', () => {
    const proposal = openProposal();

    expect(() => proposal.assertChoice(Choice.of('yes'))).not.toThrow();
    expect(() => proposal.assertChoice(Choice.of('maybe'))).toThrow(InvalidChoiceError);
  });

  // TECH-DEBT-01: tallyVotes currently accepts pre-aggregated counts, so it
  // cannot distinguish CONFIRMED votes from SIGNED/QUEUED/SENT/FAILED ones.
  // Desired Sprint-04 semantics: only CONFIRMED votes contribute to counts
  // and turnout. This test is written against those semantics and must fail
  // until the tally input carries per-vote status.
  it.skip('TECH-DEBT-01: tally counts CONFIRMED only', () => {
    const proposal = closedProposal();
    proposal.pullDomainEvents();

    // 3 observed votes for 'yes', but only 2 are CONFIRMED (1 still QUEUED).
    proposal.tallyVotes(new Map([['yes', 3]]), 3);

    const events = proposal.pullDomainEvents();
    const tallied = events.find((e): e is ProposalTalliedEvent => e instanceof ProposalTalliedEvent);
    expect(tallied?.tally.countFor(Choice.of('yes'))).toBe(2);
    expect(tallied?.tally.turnout).toBe(2);
  });
});
