import { DomainEvent } from "../../../../shared/domain/model/domain-event.js";
import { PersonId } from "../../../../shared/domain/model/valueobjects/person-id.value-object.js";
import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";
import { Purpose } from "../valueobjects/purpose.value-object.js";
import { ValidityWindow } from "../valueobjects/validity-window.value-object.js";

/**
 * Event emitted when a challenge is requested for a specific person, with a defined purpose.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-22
 */
export class ChallengeRequestedEvent implements DomainEvent {
  static readonly eventName = 'ChallengeRequested';
  readonly eventName = ChallengeRequestedEvent.eventName;
  readonly occurredAt = new Date();

  /***
   * Creates a new instance of ChallengeRequestedEvent.
   * @param challengeId The ID of the requested challenge.
   * @param personId The ID of the person for whom the challenge is requested.
   * @param purpose The purpose of the requested challenge.
   * @param window The validity window of the requested challenge.
   */
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly personId: PersonId,
    public readonly purpose: Purpose,
    public readonly window: ValidityWindow,
  ) {}
}
