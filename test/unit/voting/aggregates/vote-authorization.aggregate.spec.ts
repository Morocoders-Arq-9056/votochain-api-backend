import { VoteAuthorization } from '../../../../src/voting/domain/model/aggregates/vote-authorization.aggregate.js';
import { AuthorizationId } from '../../../../src/voting/domain/model/valueobjects/authorization-id.value-object.js';
import { AuthorizationStatus } from '../../../../src/voting/domain/model/valueobjects/authorization-status.value-object.js';
import { CommunityId } from '../../../../src/voting/domain/model/valueobjects/community-id.value-object.js';
import { EligibilitySnapshot } from '../../../../src/voting/domain/model/valueobjects/eligibility-snapshot.value-object.js';
import { PersonId } from '../../../../src/voting/domain/model/valueobjects/person-id.value-object.js';
import { ProposalId } from '../../../../src/voting/domain/model/valueobjects/proposal-id.value-object.js';
import { VoteId } from '../../../../src/voting/domain/model/valueobjects/vote-id.value-object.js';
import { VoterAddress } from '../../../../src/voting/domain/model/valueobjects/voter-address.value-object.js';
import { VoteAuthorizationConsumedEvent } from '../../../../src/voting/domain/model/events/vote-authorization-consumed.event.js';
import { VoteAuthorizationDeniedEvent } from '../../../../src/voting/domain/model/events/vote-authorization-denied.event.js';
import { VoteAuthorizationGrantedEvent } from '../../../../src/voting/domain/model/events/vote-authorization-granted.event.js';
import { VoteAuthorizationRequestedEvent } from '../../../../src/voting/domain/model/events/vote-authorization-requested.event.js';
import { AuthorizationAlreadyConsumedError } from '../../../../src/voting/domain/exceptions/authorization-already-consumed.error.js';

const VOTER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function voter(): VoterAddress {
  return VoterAddress.of(VOTER);
}

function requestAuth(): VoteAuthorization {
  return VoteAuthorization.request(
    AuthorizationId.generate(),
    ProposalId.of('prop-1'),
    voter(),
    60,
  );
}

function eligibility(): EligibilitySnapshot {
  return EligibilitySnapshot.freeze({
    personId: PersonId.of('person-1'),
    communityId: CommunityId.of('comm-1'),
    verdict: 'ELIGIBLE',
    reference: 'roster-1',
  });
}

describe('VoteAuthorization aggregate', () => {
  it('requests PENDING with a VoteAuthorizationRequestedEvent', () => {
    const auth = requestAuth();

    expect(auth.status).toBe(AuthorizationStatus.PENDING);
    expect(auth.voterAddress.equals(voter())).toBe(true);

    const events = auth.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(VoteAuthorizationRequestedEvent);
  });

  it('grants while staying PENDING and denies to DENIED', () => {
    const granted = requestAuth();
    granted.pullDomainEvents();

    granted.grant(eligibility());
    expect(granted.status).toBe(AuthorizationStatus.PENDING);
    expect(granted.eligibility?.verdict).toBe('ELIGIBLE');

    const grantEvents = granted.pullDomainEvents();
    expect(grantEvents).toHaveLength(1);
    expect(grantEvents[0]).toBeInstanceOf(VoteAuthorizationGrantedEvent);

    const denied = requestAuth();
    denied.pullDomainEvents();

    denied.deny('NOT_ELIGIBLE');
    expect(denied.status).toBe(AuthorizationStatus.DENIED);
    expect(denied.denialReason).toBe('NOT_ELIGIBLE');

    const denyEvents = denied.pullDomainEvents();
    expect(denyEvents).toHaveLength(1);
    expect(denyEvents[0]).toBeInstanceOf(VoteAuthorizationDeniedEvent);
  });

  it('consumes once and refuses a second consume', () => {
    const auth = requestAuth();
    auth.grant(eligibility());
    auth.pullDomainEvents();

    auth.consume(VoteId.generate());
    expect(auth.status).toBe(AuthorizationStatus.CONSUMED);

    const events = auth.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(VoteAuthorizationConsumedEvent);

    expect(() => auth.consume(VoteId.generate())).toThrow(
      AuthorizationAlreadyConsumedError,
    );
  });
});
