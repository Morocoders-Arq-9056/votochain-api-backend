import { UserId } from "../valueobjects/user-id.value-object.js";

export class ChangeSecretCommand {
  constructor(
    public readonly userId: UserId,
    public readonly newSecret: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!newSecret?.trim()) throw new Error('newSecret required');
  }
}
