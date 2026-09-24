import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";

export class GetChallengeByIdQuery {
  constructor(public readonly challengeId: ChallengeId) {
    if (!challengeId) throw new Error('challengeId required');
  }
}
