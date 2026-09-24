import { CommunityStanding } from "./community-standing.value-object.js";

/**
 * Value object representing what a community currently accepts.
 * Derived from standing, never stored separately.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
export const Acceptance = { ACCEPTS_MEMBERS_AND_PROPOSALS: 'ACCEPTS_MEMBERS_AND_PROPOSALS', ACCEPTS_NOTHING_NEW: 'ACCEPTS_NOTHING_NEW', READ_ONLY_HISTORY: 'READ_ONLY_HISTORY' } as const;
export type Acceptance = typeof Acceptance[keyof typeof Acceptance];

/**
 * Derives the acceptance from the current standing.
 * @param standing The current community standing.
 * @returns The corresponding Acceptance.
 */
export function fromStanding(standing: CommunityStanding): Acceptance {
  switch (standing) {
    case CommunityStanding.ACTIVE: return Acceptance.ACCEPTS_MEMBERS_AND_PROPOSALS;
    case CommunityStanding.ARCHIVED: return Acceptance.READ_ONLY_HISTORY;
    default: return Acceptance.ACCEPTS_NOTHING_NEW;
  }
}
