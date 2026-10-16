import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module.js";
import { CommunityCommandServiceImpl } from "./application/internal/commandservices/community-command.service.impl.js";
import { CommunityQueryServiceImpl } from "./application/internal/queryservices/community-query.service.impl.js";
import { CommunityEventLogger } from "./application/internal/eventhandlers/community-event-logger.js";
import { COMMUNITY_COMMAND_SERVICE } from "./domain/services/community-command.service.js";
import { COMMUNITY_QUERY_SERVICE } from "./domain/services/community-query.service.js";
import { COMMUNITY_REPOSITORY } from "./domain/repositories/community.repository.js";
import { ExternalIamService } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { CommunityRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/community-repository.impl.js";
import { CommunityPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/community-persistence.assembler.js";
import { CommunityOrmEntity } from "./infrastructure/persistence/typeorm/entities/community.orm-entity.js";
import { CommunitiesController } from "./interfaces/rest/controllers/communities.controller.js";
import { PoliciesController } from "./interfaces/rest/controllers/policies.controller.js";
import { AdminsController } from "./interfaces/rest/controllers/admins.controller.js";
import { CommunityContextFacadeImpl } from "./application/acl/community-context-facade.impl.js";
import { COMMUNITY_CONTEXT_FACADE } from "./interfaces/acl/community-context.facade.js";

/**
 * Community Management bounded context module (supporting subdomain:
 * orgs, participation rule, administrators).
 *
 * Wires domain ports to application and infrastructure: command/query
 * services, log-only event fan-out, TypeORM adapter and the UC5 IAM ACL
 * adapter. `IamModule` is imported for the published `IAM_CONTEXT_FACADE`
 * token (ACL direction Community→IAM, identity reference only).
 * Publishes COMMUNITY_CONTEXT_FACADE for policy/standing consumers
 * (Voting per proposal opening, Membership per registration).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Module({
  imports: [TypeOrmModule.forFeature([CommunityOrmEntity]), IamModule],
  controllers: [CommunitiesController, PoliciesController, AdminsController],
  providers: [
    CommunityPersistenceAssembler,
    CommunityEventLogger,
    ExternalIamService,
    { provide: COMMUNITY_REPOSITORY, useClass: CommunityRepositoryImpl },
    { provide: COMMUNITY_COMMAND_SERVICE, useClass: CommunityCommandServiceImpl },
    { provide: COMMUNITY_QUERY_SERVICE, useClass: CommunityQueryServiceImpl },
    { provide: COMMUNITY_CONTEXT_FACADE, useClass: CommunityContextFacadeImpl },
  ],
  exports: [COMMUNITY_CONTEXT_FACADE],
})
export class CommunityModule {}
