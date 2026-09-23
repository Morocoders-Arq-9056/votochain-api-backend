import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";

/**
 * Event emitted when a challenge attempt fails for a specific person, with a defined purpose and the number of remaining attempts.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export class ChallengeAttemptFailedEvent implements DomainEvent {
  static readonly eventName = 'ChallengeAttemptFailed';
  readonly eventName = ChallengeAttemptFailedEvent.eventName;
  readonly occurredAt = new Date();

  /**
   * Creates a new instance of ChallengeAttemptFailedEvent.
   * @param challengeId The ID of the failed challenge.
   * @param personId The ID of the person for whom the challenge failed.
   * @param purpose The purpose of the failed challenge.
   * @param remaining The number of remaining attempts.
   */
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
    public readonly remaining: number,
  ) {}
}
