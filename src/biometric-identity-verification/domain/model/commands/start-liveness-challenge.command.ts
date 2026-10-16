import { PersonId } from "../valueobjects/person-id.value-object.js";

export class StartLivenessChallengeCommand {
  constructor(public readonly personId: PersonId) {
    if (!personId) throw new Error('personId required');
  }
}
