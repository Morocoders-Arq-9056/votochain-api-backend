import { SystemRole } from "./system-role.value-object.js";

/**
 * Value object that carries the User aggregate's answer to the access
 * standing question: whether the person may act now, with which system
 * roles, and whether a session is open. Derived state — no invariants.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-15
 */
export class AccessStandingAnswer {
  constructor(
    public readonly mayAct: boolean,
    public readonly roles: SystemRole[],
    public readonly sessionOpen: boolean,
  ) {}
}
