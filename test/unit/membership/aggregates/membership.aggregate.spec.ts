import { Membership } from '../../../../src/membership/domain/model/aggregates/membership.aggregate.js';
import { CommunityId } from '../../../../src/membership/domain/model/valueobjects/community-id.value-object.js';
import { CommunityRole, CommunityRoleKind } from '../../../../src/membership/domain/model/valueobjects/community-role.value-object.js';
import { MembershipStatus } from '../../../../src/membership/domain/model/valueobjects/membership-status.value-object.js';
import { PersonId } from '../../../../src/membership/domain/model/valueobjects/person-id.value-object.js';
import { Unit } from '../../../../src/membership/domain/model/valueobjects/unit.value-object.js';
import { EligibilitySnapshot } from '../../../../src/membership/domain/model/valueobjects/eligibility-snapshot.value-object.js';
import { MembershipRegisteredEvent } from '../../../../src/membership/domain/model/events/membership-registered.event.js';
import { MembershipActivatedEvent } from '../../../../src/membership/domain/model/events/membership-activated.event.js';
import { CommunityRoleAssignedEvent } from '../../../../src/membership/domain/model/events/community-role-assigned.event.js';
import { MemberMarkedDelinquentEvent } from '../../../../src/membership/domain/model/events/member-marked-delinquent.event.js';
import { DelinquencyClearedEvent } from '../../../../src/membership/domain/model/events/delinquency-cleared.event.js';
import { MembershipSuspendedEvent } from '../../../../src/membership/domain/model/events/membership-suspended.event.js';
import { MembershipReinstatedEvent } from '../../../../src/membership/domain/model/events/membership-reinstated.event.js';
import { MembershipTerminatedEvent } from '../../../../src/membership/domain/model/events/membership-terminated.event.js';
import { EligibilityJudgedEvent } from '../../../../src/membership/domain/model/events/eligibility-judged.event.js';
import { IllegalMembershipTransitionError } from '../../../../src/membership/domain/exceptions/illegal-membership-transition.error.js';
import { RoleRequiresActiveError } from '../../../../src/membership/domain/exceptions/role-requires-active.error.js';
import { TerminationIsTerminalError } from '../../../../src/membership/domain/exceptions/termination-is-terminal.error.js';

function requestedMembership(): Membership {
  const membership = Membership.register(PersonId.generate(), CommunityId.generate(), null);
  membership.pullDomainEvents();
  return membership;
}

function activeMembership(): Membership {
  const membership = requestedMembership();
  membership.activate();
  membership.pullDomainEvents();
  return membership;
}

describe('Membership aggregate', () => {
  it('registers REQUESTED with the OWNER role and a MembershipRegisteredEvent', () => {
    const personId = PersonId.generate();
    const communityId = CommunityId.generate();
    const membership = Membership.register(personId, communityId, null);

    expect(membership.status).toBe(MembershipStatus.REQUESTED);
    expect(membership.role.kind).toBe(CommunityRoleKind.OWNER);
    expect(membership.personId.equals(personId)).toBe(true);
    expect(membership.communityId.equals(communityId)).toBe(true);
    expect(membership.lastEligibility).toBeNull();

    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MembershipRegisteredEvent);
  });

  it('activates a REQUESTED membership', () => {
    const membership = requestedMembership();

    membership.activate();

    expect(membership.status).toBe(MembershipStatus.ACTIVE);
    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MembershipActivatedEvent);
  });

  it('refuses to activate when not REQUESTED', () => {
    const membership = activeMembership();

    expect(() => membership.activate()).toThrow(IllegalMembershipTransitionError);
  });

  it('assigns a role only when ACTIVE', () => {
    const requested = requestedMembership();
    expect(() => requested.assignRole(CommunityRole.of(CommunityRoleKind.PRESIDENT))).toThrow(
      RoleRequiresActiveError,
    );

    const active = activeMembership();
    active.assignRole(CommunityRole.of(CommunityRoleKind.PRESIDENT));

    expect(active.role.kind).toBe(CommunityRoleKind.PRESIDENT);
    const events = active.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CommunityRoleAssignedEvent);
  });

  it('marks delinquent and clears back to ACTIVE', () => {
    const membership = activeMembership();

    membership.markDelinquent('unpaid fees');
    expect(membership.status).toBe(MembershipStatus.DELINQUENT);

    membership.clearDelinquency();
    expect(membership.status).toBe(MembershipStatus.ACTIVE);

    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(MemberMarkedDelinquentEvent);
    expect(events[1]).toBeInstanceOf(DelinquencyClearedEvent);
  });

  it('refuses to clear delinquency when not DELINQUENT', () => {
    const membership = activeMembership();

    expect(() => membership.clearDelinquency()).toThrow(IllegalMembershipTransitionError);
  });

  it('suspends from ACTIVE and from DELINQUENT but refuses from REQUESTED', () => {
    const fromActive = activeMembership();
    fromActive.suspend('misconduct');
    expect(fromActive.status).toBe(MembershipStatus.SUSPENDED);
    expect(fromActive.pullDomainEvents()[0]).toBeInstanceOf(MembershipSuspendedEvent);

    const fromDelinquent = activeMembership();
    fromDelinquent.markDelinquent('unpaid fees');
    fromDelinquent.pullDomainEvents();
    fromDelinquent.suspend('misconduct');
    expect(fromDelinquent.status).toBe(MembershipStatus.SUSPENDED);

    const requested = requestedMembership();
    expect(() => requested.suspend('misconduct')).toThrow(IllegalMembershipTransitionError);
  });

  it('reinstates a SUSPENDED membership and refuses otherwise', () => {
    const membership = activeMembership();
    expect(() => membership.reinstate()).toThrow(IllegalMembershipTransitionError);

    membership.suspend('misconduct');
    membership.pullDomainEvents();
    membership.reinstate();

    expect(membership.status).toBe(MembershipStatus.ACTIVE);
    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MembershipReinstatedEvent);
  });

  it('treats terminate as terminal for every further mutation', () => {
    const membership = activeMembership();
    membership.terminate('withdrawn');
    expect(membership.status).toBe(MembershipStatus.TERMINATED);
    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(MembershipTerminatedEvent);

    expect(() => membership.activate()).toThrow(TerminationIsTerminalError);
    expect(() => membership.assignRole(CommunityRole.of(CommunityRoleKind.PRESIDENT))).toThrow(
      TerminationIsTerminalError,
    );
    expect(() => membership.assignUnit(Unit.of('A-101'))).toThrow(TerminationIsTerminalError);
    expect(() => membership.markDelinquent('late')).toThrow(TerminationIsTerminalError);
    expect(() => membership.clearDelinquency()).toThrow(TerminationIsTerminalError);
    expect(() => membership.suspend('cause')).toThrow(TerminationIsTerminalError);
    expect(() => membership.reinstate()).toThrow(TerminationIsTerminalError);
    expect(() => membership.terminate('again')).toThrow(TerminationIsTerminalError);
  });

  it('judges eligibility by stub policy, freezes the snapshot, and emits an event', () => {
    const membership = activeMembership();
    const policy = {
      judge: (status: MembershipStatus, _snapshot: EligibilitySnapshot): boolean =>
        status === MembershipStatus.ACTIVE,
    };

    const snapshot = membership.judgeEligibility(policy);

    expect(snapshot.verdict).toBe(true);
    expect(snapshot.standingObserved).toBe(MembershipStatus.ACTIVE);
    expect(membership.lastEligibility).toBe(snapshot);

    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(EligibilityJudgedEvent);
  });

  it('produces a new snapshot on a second judgment without rewriting the past', () => {
    const membership = activeMembership();
    const allowActive = {
      judge: (status: MembershipStatus, _snapshot: EligibilitySnapshot): boolean =>
        status === MembershipStatus.ACTIVE,
    };

    const first = membership.judgeEligibility(allowActive);
    membership.pullDomainEvents();
    membership.suspend('misconduct');
    membership.pullDomainEvents();
    const denyAll = {
      judge: (_status: MembershipStatus, _snapshot: EligibilitySnapshot): boolean => false,
    };
    const second = membership.judgeEligibility(denyAll);

    expect(first.verdict).toBe(true);
    expect(first.standingObserved).toBe(MembershipStatus.ACTIVE);
    expect(second.verdict).toBe(false);
    expect(second.standingObserved).toBe(MembershipStatus.SUSPENDED);
    expect(second.reference).not.toBe(first.reference);
    expect(membership.lastEligibility).toBe(second);

    const events = membership.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(EligibilityJudgedEvent);
  });

  it('answers NOT eligible for a ghost without throwing', () => {
    const ghost = Membership.ghost(PersonId.generate(), CommunityId.generate());

    expect(ghost.lastEligibility?.verdict).toBe(false);

    const policy = {
      judge: (status: MembershipStatus, _snapshot: EligibilitySnapshot): boolean =>
        status === MembershipStatus.ACTIVE,
    };
    let snapshot!: EligibilitySnapshot;
    expect(() => {
      snapshot = ghost.judgeEligibility(policy);
    }).not.toThrow();
    expect(snapshot.verdict).toBe(false);
  });

  it('drains domain events on pull', () => {
    const membership = Membership.register(PersonId.generate(), CommunityId.generate(), null);

    const first = membership.pullDomainEvents();
    expect(first).toHaveLength(1);

    const second = membership.pullDomainEvents();
    expect(second).toHaveLength(0);
  });
});
