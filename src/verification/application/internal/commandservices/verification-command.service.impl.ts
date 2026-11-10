import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomInt } from "node:crypto";
import { VerificationCommandService } from "../../../domain/services/verification-command.service.js";
import { VERIFICATION_CHALLENGE_REPOSITORY } from "../../../domain/repositories/verification-challenge.repository.js";
import type { VerificationChallengeRepository } from "../../../domain/repositories/verification-challenge.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { CODE_COMPARE_SERVICE } from "../outboundservices/codecompare/code-compare.service.js";
import type { CodeCompareService } from "../outboundservices/codecompare/code-compare.service.js";
import { ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";
import { ExternalIamService } from "../outboundservices/acl/external-iam.service.js";
import { NOTIFICATION_DELIVERY_SERVICE } from "../outboundservices/acl/external-notifications.service.js";
import type { NotificationDeliveryService } from "../outboundservices/acl/external-notifications.service.js";
import { VerificationChallenge } from "../../../domain/model/aggregates/verification-challenge.aggregate.js";
import { ChallengeId } from "../../../domain/model/valueobjects/challenge-id.value-object.js";
import { ValidityWindow } from "../../../domain/model/valueobjects/validity-window.value-object.js";
import { RequestVerificationChallengeCommand } from "../../../domain/model/commands/request-verification-challenge.command.js";
import { AnswerVerificationChallengeCommand } from "../../../domain/model/commands/answer-verification-challenge.command.js";
import { ExpireVerificationChallengeCommand } from "../../../domain/model/commands/expire-verification-challenge.command.js";
import { ContactNotAllowedError } from "../../../domain/exceptions/contact-not-allowed.error.js";
import { NoUsableChallengeError } from "../../../domain/exceptions/no-usable-challenge.error.js";
import { ChallengeElapsedError } from "../../../domain/exceptions/challenge-elapsed.error.js";

/**
 * Generates a numeric one-time code of the given length.
 * Orchestration glue (product-pending length): the verdict on the code is
 * executed outside by the compare port, judged here, never kept readable.
 * @param length Code digits (starting proposal: 6).
 */
function generateNumericCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += String(randomInt(0, 10));
  return code;
}

/**
 * Application orchestration for the 3 VerificationChallenge write use cases.
 *
 * Holds no business rules: gates and verdicts execute outside the transaction
 * (the UoW groups DB statements only, never network I/O); the aggregate judges
 * standing and owns the attempt history. The plain code lives only in the
 * requesting method scope and travels solely via the notifications ACL —
 * never persists, never rides a domain event. Published strictly after commit.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-23
 */
@Injectable()
export class VerificationCommandServiceImpl implements VerificationCommandService {
  private readonly logger = new Logger(VerificationCommandServiceImpl.name);

  /**
   * Wires the command service over persistence, transactions and executors.
   * @param challenges Repository port for the VerificationChallenge aggregate.
   * @param unitOfWork Transaction boundary for writes.
   * @param compare Code hash/verdict executor port, observed never performed.
   * @param iam Identity-existence gate (R9 reception lives in the handler).
   * @param consent Opt-in gate, judged where consent lives.
   * @param notifications Delivery-instruction port for the plain code.
   * @param eventEmitter In-process bus for in-module handlers only.
   */
  constructor(
    @Inject(VERIFICATION_CHALLENGE_REPOSITORY) private readonly challenges: VerificationChallengeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CODE_COMPARE_SERVICE) private readonly compare: CodeCompareService,
    private readonly iam: ExternalIamService,
    private readonly consent: ExternalConsentService,
    @Inject(NOTIFICATION_DELIVERY_SERVICE) private readonly notifications: NotificationDeliveryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Opens a challenge for the pair, superseding the prior OPEN atomically.
   * @inheritdoc
   */
  async requestVerificationChallenge(command: RequestVerificationChallengeCommand): Promise<ChallengeId> {
    if (!(await this.iam.personExists(command.personId.value)))
      throw new NoUsableChallengeError('unknown person');
    if (!(await this.consent.mayContactNow(command.personId.value)))
      throw new ContactNotAllowedError('contact not allowed');
    const plain = generateNumericCode(6);
    const codeHash = await this.compare.hash(plain);
    const created = await this.unitOfWork.run(async () => {
      const open = await this.challenges.findOpenByPersonAndPurpose(command.personId, command.purpose);
      if (open) {
        open.supersede();
        await this.challenges.save(open);
      }
      const ch = VerificationChallenge.request(
        ChallengeId.generate(), command.personId, command.purpose, ValidityWindow.fromNow(5), codeHash,
      );
      await this.challenges.save(ch);
      return ch;
    });
    this.publishDomainEvents(created);
    try {
      await this.notifications.sendCode(created.personId.value, plain, created.purpose);
    } catch (err) {
      this.logger.warn(`delivery failed for ${created.id.value}: ${String(err)}`);
    }
    return created.id;
  }

  /**
   * Judges one presented code: confirms, counts, or consumes the challenge.
   * @inheritdoc
   */
  async answerVerificationChallenge(command: AnswerVerificationChallengeCommand): Promise<void> {
    const probe = await this.challenges.findById(command.challengeId);
    if (!probe) throw new NoUsableChallengeError('no usable challenge');
    const holds = await this.compare.matches(command.presentedCode, probe.codeHash);
    let elapsed: ChallengeElapsedError | null = null;
    const challenge = await this.unitOfWork.run(async () => {
      const found = await this.challenges.findById(command.challengeId);
      if (!found) throw new NoUsableChallengeError('no usable challenge');
      try {
        found.answer(holds, new Date());
      } catch (err) {
        if (err instanceof ChallengeElapsedError) elapsed = err;
        else throw err;
      }
      await this.challenges.save(found);
      return found;
    });
    this.publishDomainEvents(challenge);
    if (elapsed) throw elapsed;
  }

  /**
   * Sweeps an OPEN challenge whose window elapsed (explicit/admin trigger;
   * Sprint-01 has no scheduler: expiry is otherwise judged lazily).
   * @inheritdoc
   */
  async expireVerificationChallenge(command: ExpireVerificationChallengeCommand): Promise<void> {
    const probe = await this.challenges.findById(command.challengeId);
    if (!probe) throw new NoUsableChallengeError('no usable challenge');
    const challenge = await this.unitOfWork.run(async () => {
      const found = await this.challenges.findById(command.challengeId);
      if (!found) throw new NoUsableChallengeError('no usable challenge');
      found.expire(new Date());
      await this.challenges.save(found);
      return found;
    });
    this.publishDomainEvents(challenge);
  }

  /**
   * Drains buffered domain events after commit; never called inside run().
   * @param challenge Aggregate whose events are published to in-module handlers.
   */
  private publishDomainEvents(challenge: VerificationChallenge): void {
    for (const event of challenge.pullDomainEvents()) {
      this.eventEmitter.emit(event.eventName, event);
    }
  }
}
