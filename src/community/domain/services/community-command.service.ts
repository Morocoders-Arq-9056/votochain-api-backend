import { ActivateCommunityCommand } from "../model/commands/activate-community.command.js";
import { AppointCommunityAdminCommand } from "../model/commands/appoint-community-admin.command.js";
import { ArchiveCommunityCommand } from "../model/commands/archive-community.command.js";
import { DefineVotingPolicyCommand } from "../model/commands/define-voting-policy.command.js";
import { ReactivateCommunityCommand } from "../model/commands/reactivate-community.command.js";
import { RegisterCommunityCommand } from "../model/commands/register-community.command.js";
import { RemoveCommunityAdminCommand } from "../model/commands/remove-community-admin.command.js";
import { SuspendCommunityCommand } from "../model/commands/suspend-community.command.js";
import { UpdateCommunitySettingsCommand } from "../model/commands/update-community-settings.command.js";
import { CommunityId } from "../model/valueobjects/community-id.value-object.js";

/**
 * Domain port for Community write use cases (CQRS command side).
 *
 * Naming follows skill ddd-guideliness v1.0.11: one method per command,
 * `methodName = lowerCamel(ClassName without Command suffix)`, receiving
 * the command object. Implementations live in application and hold no
 * business rules; every invariant is enforced by the `Community` aggregate.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export interface CommunityCommandService {
  /**
   * Registers a brand-new REGISTERED community with its founding administrator.
   * Name uniqueness is checked in application.
   * @param command Carries the initial settings and the founding person.
   * @returns A promise that resolves to the newly created CommunityId.
   */
  registerCommunity(command: RegisterCommunityCommand): Promise<CommunityId>;

  /**
   * Activates a REGISTERED community once policy is defined and an administrator named.
   * @param command Carries communityId.
   */
  activateCommunity(command: ActivateCommunityCommand): Promise<void>;

  /**
   * Updates the community facts without touching standing history.
   * @param command Carries communityId and the new settings.
   */
  updateCommunitySettings(command: UpdateCommunitySettingsCommand): Promise<void>;

  /**
   * Defines a new voting policy version, superseding the previous.
   * @param command Carries communityId, threshold, basis and majority rule.
   */
  defineVotingPolicy(command: DefineVotingPolicyCommand): Promise<void>;

  /**
   * Entrusts a person as administrator; existence is judged in IAM.
   * @param command Carries communityId and personId.
   */
  appointCommunityAdmin(command: AppointCommunityAdminCommand): Promise<void>;

  /**
   * Removes an administrator, refusing the last one while ACTIVE.
   * @param command Carries communityId and personId.
   */
  removeCommunityAdmin(command: RemoveCommunityAdminCommand): Promise<void>;

  /**
   * Suspends an ACTIVE community with a recorded reason.
   * @param command Carries communityId and reason.
   */
  suspendCommunity(command: SuspendCommunityCommand): Promise<void>;

  /**
   * Reactivates a SUSPENDED community once the cause is resolved.
   * @param command Carries communityId.
   */
  reactivateCommunity(command: ReactivateCommunityCommand): Promise<void>;

  /**
   * Archives an ACTIVE or SUSPENDED community. Terminal.
   * @param command Carries communityId and reason.
   */
  archiveCommunity(command: ArchiveCommunityCommand): Promise<void>;
}
/**
 * Injection token for the {@link CommunityCommandService} port.
 * TypeScript interfaces are erased at compile time, so NestJS DI needs it.
 */
export const COMMUNITY_COMMAND_SERVICE = Symbol('COMMUNITY_COMMAND_SERVICE');
