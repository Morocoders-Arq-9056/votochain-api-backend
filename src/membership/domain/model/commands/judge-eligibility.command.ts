import { CommunityId } from "../valueobjects/community-id.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

/**
 * Command judging eligibility for a pair right now.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
export class JudgeEligibilityCommand {
  /**
   * Creates the command.
   * @param personId Person the judgment is about.
   * @param communityId Community the judgment is about.
   */
  constructor(
    public readonly personId: PersonId,
    public readonly communityId: CommunityId,
  ) {
    if (!personId) throw new Error('personId required');
    if (!communityId) throw new Error('communityId required');
  }
}
