import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { VERIFICATION_COMMAND_SERVICE } from "../../domain/services/verification-command.service.js";
import type { VerificationCommandService } from "../../domain/services/verification-command.service.js";
import { VERIFICATION_QUERY_SERVICE } from "../../domain/services/verification-query.service.js";
import type { VerificationQueryService } from "../../domain/services/verification-query.service.js";
import { PersonId } from "../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../../domain/model/valueobjects/challenge-id.value-object.js";
import { parsePurpose } from "../../domain/model/valueobjects/purpose.value-object.js";
import { RequestVerificationChallengeCommand } from "../../domain/model/commands/request-verification-challenge.command.js";
import { AnswerVerificationChallengeCommand } from "../../domain/model/commands/answer-verification-challenge.command.js";
import { GetChallengeByIdQuery } from "../../domain/model/queries/get-challenge-by-id.query.js";
import { GetChallengeStandingByPersonAndPurposeQuery } from "../../domain/model/queries/get-challenge-standing-by-person-and-purpose.query.js";
import { PurposeUnknownError } from "../../domain/exceptions/purpose-unknown.error.js";
import { NoUsableChallengeError } from "../../domain/exceptions/no-usable-challenge.error.js";
import type { AnswerChallengeResultDto, ChallengeStandingDto, VerificationContextFacade } from "../../interfaces/acl/verification-context.facade.js";

/**
 * Application implementation of the published {@link VerificationContextFacade}.
 * Translates primitive boundary strings into domain VOs, delegates to the
 * command/query services, and translates back to primitives. Reads the
 * post-answer state back through the query side, keeping commands void.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Injectable()
export class VerificationContextFacadeImpl implements VerificationContextFacade {
  /**
   * Wires the facade over command and query services.
   * @param commands Write-side application service.
   * @param queries Read-side application service.
   */
  constructor(
    @Inject(VERIFICATION_COMMAND_SERVICE) private readonly commands: VerificationCommandService,
    @Inject(VERIFICATION_QUERY_SERVICE) private readonly queries: VerificationQueryService,
  ) {}

  /**
   * Opens a challenge for the pair and returns its id string.
   * @param personId Person id (`per-` prefixed string).
   * @param purpose Proof purpose string.
   */
  async requestChallenge(personId: string, purpose: string): Promise<string> {
    const id = await this.commands.requestVerificationChallenge(
      new RequestVerificationChallengeCommand(this.toPersonId(personId), this.toPurpose(purpose)),
    );
    return id.value;
  }

  /**
   * Judges one presented code and answers the resulting standing.
   * @param challengeId Challenge id (`ch-` prefixed string).
   * @param code Presented plain code.
   */
  async answerChallenge(challengeId: string, code: string): Promise<AnswerChallengeResultDto> {
    const id = this.toChallengeId(challengeId);
    await this.commands.answerVerificationChallenge(new AnswerVerificationChallengeCommand(id, code));
    const challenge = await this.queries.getChallengeById(new GetChallengeByIdQuery(id));
    if (!challenge) throw new NotFoundException();
    return { standing: challenge.standing, remaining: challenge.attempts.remaining() };
  }

  /**
   * Answers usability and remaining attempts for the pair.
   * @param personId Person id (`per-` prefixed string).
   * @param purpose Proof purpose string.
   */
  async getStanding(personId: string, purpose: string): Promise<ChallengeStandingDto> {
    return this.queries.getChallengeStandingByPersonAndPurpose(
      new GetChallengeStandingByPersonAndPurposeQuery(this.toPersonId(personId), this.toPurpose(purpose)),
    );
  }

  /**
   * Parses a person id string or raises the unknown-person rejection.
   * @param personId Raw person id string.
   */
  private toPersonId(personId: string): PersonId {
    try {
      return PersonId.of(personId);
    } catch {
      throw new NoUsableChallengeError('unknown person');
    }
  }

  /**
   * Parses a purpose string or raises the closed-set rejection.
   * @param purpose Raw purpose string.
   */
  private toPurpose(purpose: string) {
    try {
      return parsePurpose(purpose);
    } catch {
      throw new PurposeUnknownError();
    }
  }

  /**
   * Parses a challenge id string or raises the no-usable rejection.
   * @param challengeId Raw challenge id string.
   */
  private toChallengeId(challengeId: string): ChallengeId {
    try {
      return ChallengeId.of(challengeId);
    } catch {
      throw new NoUsableChallengeError('no usable challenge');
    }
  }
}
