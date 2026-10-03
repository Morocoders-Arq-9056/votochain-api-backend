import { UserId } from "../valueobjects/user-id.value-object.js";
import { ContactAddress } from "../valueobjects/contact-address.value-object.js";

export class ChangeEmailCommand {
  constructor(
    public readonly userId: UserId,
    public readonly contact: ContactAddress,
  ) {
    if (!userId) throw new Error('userId required');
    if (!contact) throw new Error('contact required');
  }
}
