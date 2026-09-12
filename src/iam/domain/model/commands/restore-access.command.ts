import { UserId } from "../valueobjects/user-id.value-object.js";

export class RestoreAccessCommand {
  constructor(public readonly userId: UserId) {
    if (!userId) throw new Error('userId required');
  }
}
