import { ActivateMembershipCommand } from "../model/commands/activate-membership.command.js";
import { AssignCommunityRoleCommand } from "../model/commands/assign-community-role.command.js";
import { AssignUnitCommand } from "../model/commands/assign-unit.command.js";
import { ClearDelinquencyCommand } from "../model/commands/clear-delinquency.command.js";
import { JudgeEligibilityCommand } from "../model/commands/judge-eligibility.command.js";
import { MarkDelinquentCommand } from "../model/commands/mark-delinquent.command.js";
import { RegisterMembershipCommand } from "../model/commands/register-membership.command.js";
import { ReinstateMembershipCommand } from "../model/commands/reinstate-membership.command.js";
import { SuspendMembershipCommand } from "../model/commands/suspend-membership.command.js";
import { TerminateMembershipCommand } from "../model/commands/terminate-membership.command.js";
import { EraseMembershipsByPersonCommand } from "../model/commands/erase-memberships-by-person.command.js";
import { EligibilitySnapshot } from "../model/valueobjects/eligibility-snapshot.value-object.js";
import { MembershipId } from "../model/valueobjects/membership-id.value-object.js";

/**
 * Domain port for Membership write use cases (CQRS command side).
 *
 * One method per command, `methodName = lowerCamel(ClassName without Command
 * suffix)`, receiving the command object. Implementations live in application
 * and hold no business rules; every invariant is enforced by Membership.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export interface MembershipCommandService {
  /** Registers a fresh REQUESTED pair after the IAM/community gates. */
  registerMembership(command: RegisterMembershipCommand): Promise<MembershipId>;
  /** Activates a REQUESTED membership. */
  activateMembership(command: ActivateMembershipCommand): Promise<void>;
  /** Assigns the dwelling unit without touching standing history. */
  assignUnit(command: AssignUnitCommand): Promise<void>;
  /** Assigns the community role; requires ACTIVE. */
  assignCommunityRole(command: AssignCommunityRoleCommand): Promise<void>;
  /** Marks an ACTIVE membership delinquent. */
  markDelinquent(command: MarkDelinquentCommand): Promise<void>;
  /** Clears delinquency back to ACTIVE. */
  clearDelinquency(command: ClearDelinquencyCommand): Promise<void>;
  /** Suspends an ACTIVE or DELINQUENT membership. */
  suspendMembership(command: SuspendMembershipCommand): Promise<void>;
  /** Reinstates a SUSPENDED membership back to ACTIVE. */
  reinstateMembership(command: ReinstateMembershipCommand): Promise<void>;
  /** Terminates the membership. Terminal. */
  terminateMembership(command: TerminateMembershipCommand): Promise<void>;
  /**
   * Terminates every live membership held by one person (erasure execution,
   * R12: the owner deletes its own data). Idempotent.
   * @returns How many memberships were terminated.
   */
  eraseMembershipsByPerson(command: EraseMembershipsByPersonCommand): Promise<number>;
  /** Judges eligibility now, freezing a snapshot (ghost when absent). */
  judgeEligibility(command: JudgeEligibilityCommand): Promise<EligibilitySnapshot>;
}
/**
 * Injection token for the {@link MembershipCommandService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const MEMBERSHIP_COMMAND_SERVICE = Symbol('MEMBERSHIP_COMMAND_SERVICE');
