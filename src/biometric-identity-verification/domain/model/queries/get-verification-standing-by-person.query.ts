import { PersonId } from "../valueobjects/person-id.value-object.js";

export class GetVerificationStandingByPersonQuery {
  constructor(
    public readonly personId: PersonId,
    public readonly now: Date,
  ) {}
}
