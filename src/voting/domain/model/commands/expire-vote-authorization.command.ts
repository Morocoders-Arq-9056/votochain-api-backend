import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";

export class ExpireVoteAuthorizationCommand {
  constructor(public readonly authorizationId: AuthorizationId) {
    if (!authorizationId) throw new Error('authorizationId required');
  }
}
