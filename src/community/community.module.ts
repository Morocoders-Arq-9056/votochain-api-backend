import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module.js";
import { CommunityCommandServiceImpl } from "./application/internal/commandservices/community-command.service.impl.js";
import { CommunityQueryServiceImpl } from "./application/internal/queryservices/community-query.service.impl.js";
import { CommunityEventLogger } from "./application/internal/eventhandlers/community-event-logger.js";
import { COMMUNITY_COMMAND_SERVICE } from "./domain/services/community-command.service.js";
import { COMMUNITY_QUERY_SERVICE } from "./domain/services/community-query.service.js";
import { COMMUNITY_REPOSITORY } from "./domain/repositories/community.repository.js";
import { EXTERNAL_IAM_SERVICE } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { CommunityRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/community-repository.impl.js";
import { CommunityPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/community-persistence.assembler.js";
import { CommunityOrmEntity } from "./infrastructure/persistence/typeorm/entities/community.orm-entity.js";
import { ExternalIamServiceImpl } from "./infrastructure/iam/external-iam.service.js";
import { CommunityController } from "./interfaces/rest/controllers/community.controller.js";

/**
 * Community Management bounded context module (supporting subdomain:
 * orgs, participation rule, administrators).
 *
 * Wires domain ports to application and infrastructure: command/query
 * services, log-only event fan-out, TypeORM adapter and the UC5 IAM ACL
 * adapter. `IamModule` is imported for the published `IAM_CONTEXT_FACADE`
 * token (ACL direction Community→IAM, identity reference only).
 * No controllers and no published facade yet — both land with the
 * interfaces slice.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-24
 */
@Module({
  imports: [TypeOrmModule.forFeature([CommunityOrmEntity]), IamModule],
  controllers: [CommunityController],
  providers: [
    CommunityPersistenceAssembler,
    CommunityCommandServiceImpl,
    CommunityQueryServiceImpl,
    CommunityEventLogger,
    ExternalIamServiceImpl,
    { provide: COMMUNITY_REPOSITORY, useClass: CommunityRepositoryImpl },
    { provide: COMMUNITY_COMMAND_SERVICE, useClass: CommunityCommandServiceImpl },
    { provide: COMMUNITY_QUERY_SERVICE, useClass: CommunityQueryServiceImpl },
    { provide: EXTERNAL_IAM_SERVICE, useClass: ExternalIamServiceImpl },
  ],
})
export class CommunityModule {}
