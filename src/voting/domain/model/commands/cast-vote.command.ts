import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";
import { Choice } from "../valueobjects/choice.value-object.js";

export class CastVoteCommand {
  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly choice: Choice,
  ) {
    if (!authorizationId) throw new Error('authorizationId required');
    if (!choice) throw new Error('choice required');
  }
}
