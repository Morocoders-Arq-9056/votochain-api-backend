import { SystemRole } from "../valueobjects/system-role.value-object.js";
import { UserId } from "../valueobjects/user-id.value-object.js";

export class RevokeSystemRoleCommand {
  constructor(
    public readonly userId: UserId,
    public readonly role: SystemRole,
  ) {
    if (!userId) throw new Error('userId required');
    if (!role) throw new Error('role required');
  }
}
