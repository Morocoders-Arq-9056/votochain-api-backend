import { UserId } from "../valueobjects/user-id.js";

export class LinkOutsideIdentityCommand {
  constructor(
    public readonly userId: UserId,
    public readonly provider: string,
    public readonly externalId: string,
  ) {
    if (!userId) throw new Error('userId required');
    if (!provider?.trim()) throw new Error('provider required');
    if (!externalId?.trim()) throw new Error('externalId required');
  }
}
