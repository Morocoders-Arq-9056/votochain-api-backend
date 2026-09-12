import { ContactAddress } from "../valueobjects/contact-address.value-object.js";
import { PersonId } from "../valueobjects/person-id.value-object.js";

export class SignUpCommand {
  constructor(
    public readonly personId: PersonId,
    public readonly contactAddress: ContactAddress,
  ) {
    if (!personId) throw new Error('personId required');
    if (!contactAddress) throw new Error('contactAddress required');
  }
}
