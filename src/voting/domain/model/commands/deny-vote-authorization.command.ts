import { AuthorizationDenialReason } from "../valueobjects/authorization-denial-reason.value-object.js";
import { AuthorizationId } from "../valueobjects/authorization-id.value-object.js";

export class DenyVoteAuthorizationCommand {
  constructor(
    public readonly authorizationId: AuthorizationId,
    public readonly reason: AuthorizationDenialReason,
  ) {
    if (!authorizationId) throw new Error('authorizationId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
