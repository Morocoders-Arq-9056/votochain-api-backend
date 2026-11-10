import { ContactAddress } from "../valueobjects/contact-address.value-object.js";

export class SignUpCommand {
  constructor(
    public readonly contactAddress: ContactAddress,
    public readonly plainSecret: string,
  ) {
    if (!contactAddress) throw new Error('contactAddress required');
    if (!plainSecret?.trim()) throw new Error('plainSecret required');
  }
}
