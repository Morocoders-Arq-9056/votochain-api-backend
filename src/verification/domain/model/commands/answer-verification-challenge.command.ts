import { ChallengeId } from "../valueobjects/challenge-id.value-object.js";

export class AnswerVerificationChallengeCommand {
  constructor(
    public readonly challengeId: ChallengeId,
    public readonly presentedCode: string,
  ) {
    if (!challengeId) throw new Error('challengeId required');
    if (!presentedCode?.trim()) throw new Error('presentedCode required');
  }
}
