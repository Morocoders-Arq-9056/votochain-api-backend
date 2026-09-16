import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { UserResource } from '../resources/user.resource.js';

export class UserResourceFromEntityAssembler {
  static toResourceFromEntity(user: User): UserResource {
    return new UserResource(user.id.value, user.contact.email);
  }
}
