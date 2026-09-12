import { UserId } from "../valueobjects/user-id.value-object.js";

export class SuspendAccessCommand {
  constructor(
    public readonly userId: UserId,
    public readonly reason: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!reason?.trim()) throw new Error('reason required');
  }
}
