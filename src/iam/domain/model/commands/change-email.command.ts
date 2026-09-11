import { UserId } from "../valueobjects/user-id.js";

export class ChangeEmailCommand {
  constructor(
    public readonly userId: UserId,
    public readonly newEmail: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!newEmail?.trim()) throw new Error('newEmail required');
  }
}
