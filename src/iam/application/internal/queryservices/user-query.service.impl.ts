import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetAccessStandingByPersonQuery } from '../../../domain/model/queries/get-access-standing-by-person.query.js';
import { GetSystemRolesByPersonQuery } from '../../../domain/model/queries/get-system-roles-by-person.query.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { SystemRoleAssignment } from '../../../domain/model/entities/system-role-assignment.entity.js';
import { AccessStandingAnswer } from '../../../domain/model/valueobjects/access-standing-answer.value-object.js';

@Injectable()
export class UserQueryServiceImpl implements UserQueryService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async handle(query: GetUserByIdQuery): Promise<User | null>;
  async handle(query: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer | null>;
  async handle(query: GetSystemRolesByPersonQuery): Promise<SystemRoleAssignment[]>;

  async handle(query: GetSystemRolesByPersonQuery): Promise<SystemRoleAssignment[]> {
    const user = await this.users.findByPersonId(query.personId);
    return user ? user.roleAssignments : [];
  }
}
