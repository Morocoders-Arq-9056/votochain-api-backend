import { ContactAddress } from "../valueobjects/contact-address.value-object.js";

export class SignUpCommand {
  constructor(public readonly contactAddress: ContactAddress) {
    if (!contactAddress) throw new Error('contactAddress required');
  }
}
