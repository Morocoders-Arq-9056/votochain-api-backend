import { randomUUID } from "node:crypto";

/** Identity of a UserWallet aggregate (`wal-` prefixed). */
export class UserWalletId {
  private constructor(public readonly value: string) {}

  static generate(): UserWalletId { return new UserWalletId(`wal-${randomUUID()}`); }

  static of(v: string): UserWalletId {
    if (!v?.trim()) throw new Error('invalid user wallet id');
    return new UserWalletId(v);
  }

  equals(o: UserWalletId): boolean { return this.value === o.value; }
}
