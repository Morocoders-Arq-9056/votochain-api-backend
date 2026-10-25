import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AUTHORIZATION_COMMAND_SERVICE } from "../../../domain/services/authorization-command.service.js";
import type { VoteAuthorizationCommandService } from "../../../domain/services/authorization-command.service.js";
import { AUTHORIZATION_REPOSITORY } from "../../../domain/repositories/authorization.repository.js";
import type { VoteAuthorizationRepository } from "../../../domain/repositories/authorization.repository.js";
import { ExpireVoteAuthorizationCommand } from "../../../domain/model/commands/expire-vote-authorization.command.js";

/**
 * Expiry maintenance: periodically transitions PENDING authorizations past
 * their window to EXPIRED via the domain `expire()` (one transaction each;
 * races with consume() are absorbed per authorization and retried next tick).
 * Runs on an unref'd interval so it never holds the process open in tests.
 *
 * Tunables (`process.env`, defaults in parentheses):
 * `VOTING_AUTH_SWEEP_MS` (300000), `VOTING_AUTH_SWEEP_BATCH` (100),
 * `VOTING_AUTH_SWEEP_ENABLED` ('true').
 */
@Injectable()
export class AuthorizationExpireSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthorizationExpireSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(AUTHORIZATION_REPOSITORY) private readonly auths: VoteAuthorizationRepository,
    @Inject(AUTHORIZATION_COMMAND_SERVICE) private readonly commands: VoteAuthorizationCommandService,
  ) {}

  onModuleInit(): void {
    if (process.env.VOTING_AUTH_SWEEP_ENABLED === 'false') {
      this.logger.log('authorization expire-sweep disabled');
      return;
    }
    const ms = Number(process.env.VOTING_AUTH_SWEEP_MS ?? 300000);
    this.timer = setInterval(() => void this.sweepOnce(), Number.isFinite(ms) && ms > 0 ? ms : 300000);
    (this.timer as unknown as { unref?: () => void }).unref?.();
    this.logger.log('authorization expire-sweep started');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async sweepOnce(): Promise<number> {
    const batch = Number(process.env.VOTING_AUTH_SWEEP_BATCH ?? 100);
    const expired = await this.auths.findExpiredPending(new Date(), Number.isFinite(batch) && batch > 0 ? batch : 100);
    let expiredCount = 0;
    for (const auth of expired) {
      try {
        await this.commands.expireVoteAuthorization(new ExpireVoteAuthorizationCommand(auth.id));
        expiredCount++;
      } catch (e) {
        // Race with consume()/deny(): the next tick re-reads; never aborts the sweep.
        this.logger.warn(`sweep skipped ${auth.id.value}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (expiredCount > 0) this.logger.log(`authorization expire-sweep expired ${expiredCount} authorization(s)`);
    return expiredCount;
  }
}
