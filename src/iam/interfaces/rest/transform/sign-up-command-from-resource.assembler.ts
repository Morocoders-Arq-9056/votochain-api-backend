import { SignUpCommand } from '../../../domain/model/commands/sign-up.command.js';
import { ContactAddress } from '../../../domain/model/valueobjects/contact-address.value-object.js';
import { SignUpResource } from '../resources/sign-up.resource.js';

export class SignUpCommandFromResourceAssembler {
  static toCommandFromResource(resource: SignUpResource): SignUpCommand {
    return new SignUpCommand(ContactAddress.create(resource.email));
  }
}