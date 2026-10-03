import { randomUUID } from "node:crypto";

/**
 * Identity of a vote authorization. Generated as `auth-<uuid>`.
 */
export class AuthorizationId {
  private constructor(public readonly value: string) {}

  static generate(): AuthorizationId { return new AuthorizationId(`auth-${randomUUID()}`); }

  static of(v: string): AuthorizationId {
    if (!v?.trim()) throw new Error('invalid authorization id');
    return new AuthorizationId(v);
  }

  equals(o: AuthorizationId): boolean { return this.value === o.value; }
}
