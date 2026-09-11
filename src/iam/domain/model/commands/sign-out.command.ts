import { UserId } from "../valueobjects/user-id.js";

export class SignOutCommand {
  constructor(public readonly userId: UserId) {
    if (!userId) throw new Error('userId required');
  }
}
