import { CommunityStanding } from "./community-standing.value-object.js";

/**
 * Value object that carries the Community aggregate's answer to the standing
 * question: the current standing plus whether members and proposals are
 * accepted now. Derived state — no invariants.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export class CommunityStandingAnswer {
  constructor(
    public readonly standing: CommunityStanding,
    public readonly acceptsMembers: boolean,
    public readonly acceptsProposals: boolean,
  ) {}

  /**
   * Answers the standing question for the given standing.
   * Only an ACTIVE community accepts members and proposals.
   * @param standing The current community standing.
   * @returns A new instance of CommunityStandingAnswer.
   */
  static answer(standing: CommunityStanding): CommunityStandingAnswer {
    const accepts = standing === CommunityStanding.ACTIVE;
    return new CommunityStandingAnswer(standing, accepts, accepts);
  }
}
