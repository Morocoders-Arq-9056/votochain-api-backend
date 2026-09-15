import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { AuthenticatedUserResource } from '../resources/authenticated-user.resource.js';

export class AuthenticatedUserResourceFromEntityAssembler {
  static toResourceFromEntity(user: User, token: string): AuthenticatedUserResource {
    return new AuthenticatedUserResource(user.id.value, user.contact.email, token);
  }
}
