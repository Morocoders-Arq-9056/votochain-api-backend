import { Injectable, Logger } from "@nestjs/common";

/**
 * Outbound ACL through which Membership notifies Voting of a frozen
 * eligibility judgment (UC10 anchor). Primitives-only at the boundary:
 * Voting freezes its own copy of the snapshot from the reference.
 * Log-only until Voting exposes an eligibility consumer; the in-module
 * handler stays untouched.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class ExternalVotingService {
  private readonly logger = new Logger(ExternalVotingService.name);

  /**
   * Records the frozen judgment until Voting consumes it.
   * @param personId Person id (`per-` prefixed string).
   * @param communityId Community id (`com-` prefixed string).
   * @param snapshotRef Frozen snapshot reference Voting copies.
   */
  async eligibilityJudged(personId: string, communityId: string, snapshotRef: string): Promise<void> {
    this.logger.log(`eligibility judged (log-only, no Voting consumer): ${personId} in ${communityId} ref ${snapshotRef}`);
  }
}
