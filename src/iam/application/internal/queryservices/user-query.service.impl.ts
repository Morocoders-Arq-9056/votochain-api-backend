import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import { UserQueryService } from '../../../domain/services/user-query.service.js';
import { GetAccessStandingByPersonQuery } from '../../../domain/model/queries/get-access-standing-by-person.query.js';
import { GetSystemRolesByPersonQuery } from '../../../domain/model/queries/get-system-roles-by-person.query.js';
import { GetUserByEmailQuery } from '../../../domain/model/queries/get-user-by-email.query.js';
import { GetUserByIdQuery } from '../../../domain/model/queries/get-user-by-id.query.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import type { SystemRole } from '../../../domain/model/valueobjects/system-role.value-object.js';
import type { AccessStandingAnswer } from '../../../domain/model/valueobjects/access-standing-answer.value-object.js';

/**
 * Read-only query service for User standing, roles and identity lookup.
 * No unit of work, no mutations, no events: pure orchestration over the
 * repository port plus the aggregate's answering operation.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class UserQueryServiceImpl implements UserQueryService {
  /**
   * Wires the query service over the repository port.
   * @param users Repository port for the User aggregate.
   */
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  /**
   * Returns the user for the given id, or null when unknown.
   * @inheritdoc
   */
  async getUserById(query: GetUserByIdQuery): Promise<User | null> {
    return this.users.findById(query.userId);
  }

  /**
   * Returns the user holding the given address, or null when nobody does.
   * @inheritdoc
   */
  async getUserByEmail(query: GetUserByEmailQuery): Promise<User | null> {
    return this.users.findByEmail(query.email);
  }

  /**
   * Answers access standing via the aggregate's answering operation.
   * @inheritdoc
   */
  async getAccessStandingByPerson(query: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer | null> {
    const user = await this.users.findByPersonId(query.personId);
    return user ? user.answerAccessStanding() : null;
  }

  /**
   * Lists the system roles held, or empty when the person is unknown.
   * @inheritdoc
   */
  async getSystemRolesByPerson(query: GetSystemRolesByPersonQuery): Promise<SystemRole[]> {
    const user = await this.users.findByPersonId(query.personId);
    return user ? [...user.roles] : [];
  }
}
