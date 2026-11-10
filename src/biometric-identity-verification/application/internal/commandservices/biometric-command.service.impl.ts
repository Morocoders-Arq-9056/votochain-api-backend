import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { BiometricProfile } from "../../../domain/model/aggregates/biometric-profile.aggregate.js";
import { VerificationAttempt } from "../../../domain/model/aggregates/verification-attempt.aggregate.js";
import { CompleteLivenessCommand } from "../../../domain/model/commands/complete-liveness.command.js";
import { EnrollBiometricCommand } from "../../../domain/model/commands/enroll-biometric.command.js";
import { RecordVerdictCommand } from "../../../domain/model/commands/record-verdict.command.js";
import { RequestComparisonCommand } from "../../../domain/model/commands/request-comparison.command.js";
import { RevokeBiometricProfileCommand } from "../../../domain/model/commands/revoke-biometric-profile.command.js";
import { EraseBiometricReferenceByPersonCommand } from "../../../domain/model/commands/erase-biometric-reference-by-person.command.js";
import { StartLivenessChallengeCommand } from "../../../domain/model/commands/start-liveness-challenge.command.js";
import { BiometricProfileId } from "../../../domain/model/valueobjects/biometric-profile-id.value-object.js";
import { FailureReason } from "../../../domain/model/valueobjects/failure-reason.value-object.js";
import { FreshnessWindow } from "../../../domain/model/valueobjects/freshness-window.value-object.js";
import { ProfileStanding } from "../../../domain/model/valueobjects/profile-standing.value-object.js";
import { VerificationAttemptId } from "../../../domain/model/valueobjects/verification-attempt-id.value-object.js";
import { AttemptConcludedError } from "../../../domain/exceptions/attempt-concluded.error.js";
import { ConsentRequiredError } from "../../../domain/exceptions/consent-required.error.js";
import { ReferenceAlreadyExistsError } from "../../../domain/exceptions/reference-already-exists.error.js";
import { ReferenceRequiredError } from "../../../domain/exceptions/reference-required.error.js";
import { ATTEMPT_REPOSITORY } from "../../../domain/repositories/attempt.repository.js";
import type { AttemptRepository } from "../../../domain/repositories/attempt.repository.js";
import { PROFILE_REPOSITORY } from "../../../domain/repositories/profile.repository.js";
import type { ProfileRepository } from "../../../domain/repositories/profile.repository.js";
import type { BiometricCommandService } from "../../../domain/services/biometric-command.service.js";
import { ExternalConsentService } from "../outboundservices/acl/external-consent.service.js";
import { ExternalOcrService } from "../outboundservices/acl/external-ocr.service.js";
import { MATCHING_PORT } from "../outboundservices/matching/face-matching.service.js";
import type { FaceMatchingService } from "../outboundservices/matching/face-matching.service.js";

/**
 * Application orchestration for the 6 biometric writes.
 *
 * Consent gates every beginning; the OCR single-use MATCH seeds the
 * reference (R7). The matching vendor (network) runs outside the tx; the BC
 * judges the boolean against its own threshold. UC5 erasure is orchestrated
 * here (`revoke()` + `expire(REFERENCE_ENDED)` per open attempt in one UoW),
 * never by Profile observing Attempts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class BiometricCommandServiceImpl implements BiometricCommandService {
  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
    private readonly consent: ExternalConsentService,
    private readonly ocr: ExternalOcrService,
    @Inject(MATCHING_PORT) private readonly matching: FaceMatchingService,
  ) {}

  async enrollBiometric(command: EnrollBiometricCommand): Promise<BiometricProfileId> {
    if (!(await this.consent.biometricConsentStands(command.personId.value)))
      throw new ConsentRequiredError('consent required');
    if (!(await this.ocr.consumeUsableMatch(command.personId.value)))
      throw new ReferenceRequiredError('single-use MATCH required');
    const profile = await this.uow.run(async () => {
      if (await this.profiles.findLiveByPerson(command.personId))
        throw new ReferenceAlreadyExistsError('one live reference');
      const p = BiometricProfile.enroll({ id: BiometricProfileId.generate(), personId: command.personId });
      await this.profiles.save(p);
      return p;
    });
    this.publish(profile);
    return profile.id;
  }

  async startLivenessChallenge(command: StartLivenessChallengeCommand): Promise<VerificationAttemptId> {
    if (!(await this.consent.biometricConsentStands(command.personId.value)))
      throw new ConsentRequiredError('consent required');
    const personId = command.personId;
    const attempt = await this.uow.run(async () => {
      const ref = await this.profiles.findLiveByPerson(personId);
      if (!ref) throw new ReferenceRequiredError('no live reference');
      const a = VerificationAttempt.start({
        id: VerificationAttemptId.generate(),
        personId,
        profileId: ref.id,
        freshness: FreshnessWindow.singleUse(this.config.get<number>('biometric.freshnessMinutes', 15)),
      });
      await this.attempts.save(a);
      return a;
    });
    this.publish(attempt);
    return attempt.id;
  }

  async completeLiveness(command: CompleteLivenessCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const a = await this.requireAttempt(command.attemptId);
      a.completeLiveness(command.present);
      await this.attempts.save(a);
      return a;
    });
    this.publish(updated);
  }

  async requestComparison(command: RequestComparisonCommand): Promise<void> {
    const updated = await this.uow.run(async () => {
      const a = await this.requireAttempt(command.attemptId);
      const ref = await this.profiles.findById(a.profileId);
      a.requestComparison(ref?.standing === ProfileStanding.ENROLLED);
      await this.attempts.save(a);
      return a;
    });
    this.publish(updated);
  }

  async recordVerdict(command: RecordVerdictCommand): Promise<void> {
    // The vendor reports a score BEFORE the tx; the network never lives
    // inside it. The BC judges the score against its OWN threshold (D4) —
    // the bar never leaves this context.
    const { score } = await this.matching.observeSimilarity({
      attemptId: command.attemptId.value,
      // Sprint-05 ingestion provides the selfie bytes; until then there is
      // nothing to compare and the AWS adapter fails closed.
      selfie: null,
    });
    const threshold = this.config.get<number>('biometric.matchThreshold', 0.82);
    const match = score >= threshold;
    const updated = await this.uow.run(async () => {
      const a = await this.requireAttempt(command.attemptId);
      a.recordVerdict(match, command.now);
      await this.attempts.save(a);
      return a;
    });
    this.publish(updated);
  }

  async revokeBiometricProfile(command: RevokeBiometricProfileCommand): Promise<void> {
    const { profile, expired } = await this.uow.run(async () => {
      const p = await this.profiles.findById(command.profileId);
      if (!p) throw new ReferenceRequiredError('no profile');
      p.revoke();
      const open = await this.attempts.findOpenByProfile(p.id);
      for (const a of open) a.expire(FailureReason.REFERENCE_ENDED);
      await this.profiles.save(p);
      for (const a of open) await this.attempts.save(a);
      return { profile: p, expired: open };
    });
    this.publish(profile);
    for (const a of expired) this.publish(a);
  }

  /**
   * Erasure execution: revokes the live reference by person (same unit of
   * work as `revokeBiometricProfile`: revoke + expire open attempts).
   * Idempotent: no live reference erases zero.
   * @inheritdoc
   */
  async eraseBiometricReferenceByPerson(command: EraseBiometricReferenceByPersonCommand): Promise<number> {
    const erased = await this.uow.run(async () => {
      const p = await this.profiles.findLiveByPerson(command.personId);
      if (!p) return null;
      p.revoke();
      const open = await this.attempts.findOpenByProfile(p.id);
      for (const a of open) a.expire(FailureReason.REFERENCE_ENDED);
      await this.profiles.save(p);
      for (const a of open) await this.attempts.save(a);
      return { profile: p, expired: open };
    });
    if (!erased) return 0;
    this.publish(erased.profile);
    for (const a of erased.expired) this.publish(a);
    return 1;
  }

  private async requireAttempt(id: VerificationAttemptId): Promise<VerificationAttempt> {
    const a = await this.attempts.findById(id);
    if (!a) throw new AttemptConcludedError('attempt not found');
    return a;
  }

  private publish(aggregate: { pullDomainEvents(): { eventName: string }[] }): void {
    for (const e of aggregate.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
