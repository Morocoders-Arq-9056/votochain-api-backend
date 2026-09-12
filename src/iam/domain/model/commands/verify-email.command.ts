import { UserId } from "../valueobjects/user-id.value-object.js";

export class VerifyEmailCommand {
  constructor(
    public readonly userId: UserId,
    public readonly email: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!email?.trim()) throw new Error('email required');
  }
}
