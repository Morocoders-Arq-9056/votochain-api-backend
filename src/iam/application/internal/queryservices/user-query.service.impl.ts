import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetAccessStandingByPersonQuery } from '../../../domain/model/queries/get-access-standing-by-person.query.js';
import { GetSystemRolesByPersonQuery } from '../../../domain/model/queries/get-system-roles-by-person.query.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import type { SystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';
import type { AccessStandingAnswer } from '../../../domain/model/valueobjects/access-standing-answer.value-object.js';

@Injectable()
export class UserQueryServiceImpl implements UserQueryService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async getUserById(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.findById(query.userId);
  }

  async getAccessStandingByPerson(query: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer | null> {
    const user = await this.users.findByPersonId(query.personId);
    return user ? user.answerAccessStanding() : null;
  }

  async getSystemRolesByPerson(query: GetSystemRolesByPersonQuery): Promise<SystemRole[]> {
    const user = await this.users.findByPersonId(query.personId);
    return user ? user.roleAssignments.map((a) => a.role) : [];
  }
}
