import { UserId } from "../valueobjects/user-id.js";

export class UnlinkOutsideIdentityCommand {
  constructor(
    public readonly userId: UserId,
    public readonly provider: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!provider?.trim()) throw new Error('provider required');
  }
}
