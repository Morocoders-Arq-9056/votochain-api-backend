import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { UserResource } from '../resources/user.resource.js';

export class UserResourceFromEntityAssembler {
  static toResourceFromEntity(user: User): UserResource {
    return new UserResource(
      user.id.value,
      user.personId.value,
      user.contact.email,
      user.contact.verified,
      user.standing,
      user.session,
      [...user.roles],
      user.outsideProver ? user.outsideProver.provider : null,
    );
  }
}
