import { Inject, Injectable } from "@nestjs/common";
import { VoteAuthorization } from "../../../domain/model/aggregates/vote-authorization.aggregate.js";
import { GetAuthorizationByIdQuery } from "../../../domain/model/queries/get-authorization-by-id.query.js";
import { AUTHORIZATION_REPOSITORY } from "../../../domain/repositories/authorization.repository.js";
import type { VoteAuthorizationRepository } from "../../../domain/repositories/authorization.repository.js";
import { VoteAuthorizationQueryService } from "../../../domain/services/authorization-query.service.js";

/**
 * Read-side application service: vote authorization detail for controller
 * requery after a write. No mutations, no events.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Injectable()
export class AuthorizationQueryServiceImpl implements VoteAuthorizationQueryService {
  constructor(@Inject(AUTHORIZATION_REPOSITORY) private readonly auths: VoteAuthorizationRepository) {}

  async getAuthorizationById(query: GetAuthorizationByIdQuery): Promise<VoteAuthorization | null> {
    return this.auths.findById(query.authorizationId);
  }
}
