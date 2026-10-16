import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommunityModule } from "../community/community.module.js";
import { IamModule } from "../iam/iam.module.js";
import { MembershipContextFacadeImpl } from "./application/acl/membership-context-facade.impl.js";
import { MembershipCommandServiceImpl } from "./application/internal/commandservices/membership-command.service.impl.js";
import { EligibilityJudgedEventHandler } from "./application/internal/eventhandlers/eligibility-judged.event-handler.js";
import { MembershipEventLogger } from "./application/internal/eventhandlers/membership-event-logger.js";
import { ELIGIBILITY_POLICY } from "./application/internal/outboundservices/eligibility/eligibility-policy.service.js";
import { ExternalCommunityService } from "./application/internal/outboundservices/acl/external-community.service.js";
import { ExternalIamService } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { ExternalVotingService } from "./application/internal/outboundservices/acl/external-voting.service.js";
import { MembershipQueryServiceImpl } from "./application/internal/queryservices/membership-query.service.impl.js";
import { MEMBERSHIP_COMMAND_SERVICE } from "./domain/services/membership-command.service.js";
import { MEMBERSHIP_QUERY_SERVICE } from "./domain/services/membership-query.service.js";
import { MEMBERSHIP_REPOSITORY } from "./domain/repositories/membership.repository.js";
import { DefaultEligibilityPolicyService } from "./infrastructure/eligibility/default/default-eligibility-policy.service.js";
import { MembershipRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/membership-repository.impl.js";
import { MembershipPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/membership-persistence.assembler.js";
import { MembershipOrmEntity } from "./infrastructure/persistence/typeorm/entities/membership.orm-entity.js";
import { MEMBERSHIP_CONTEXT_FACADE } from "./interfaces/acl/membership-context.facade.js";
import { MembershipController } from "./interfaces/rest/controllers/membership.controller.js";

/**
 * Membership bounded context module (supporting subdomain: pair lifecycle,
 * standing, eligibility anchor).
 *
 * Wires domain ports to application and infrastructure: command/query
 * services, the in-module eligibility fan-out, TypeORM adapter, the
 * ELIGIBILITY_POLICY strategy (default `status === ACTIVE`) and the three
 * ACL services (IAM existence, Community acceptance, Voting log-only until
 * Voting lands). `IamModule` and `CommunityModule` are imported for their
 * published facade tokens (ACL direction Membership→IAM/Community).
 * Publishes MEMBERSHIP_CONTEXT_FACADE for eligibility/roster consumers
 * (Voting per authorization, OCR per belonging precondition).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Module({
  imports: [TypeOrmModule.forFeature([MembershipOrmEntity]), IamModule, CommunityModule],
  controllers: [MembershipController],
  providers: [
    MembershipPersistenceAssembler,
    EligibilityJudgedEventHandler,
    MembershipEventLogger,
    ExternalIamService,
    ExternalCommunityService,
    ExternalVotingService,
    { provide: MEMBERSHIP_REPOSITORY, useClass: MembershipRepositoryImpl },
    { provide: MEMBERSHIP_COMMAND_SERVICE, useClass: MembershipCommandServiceImpl },
    { provide: MEMBERSHIP_QUERY_SERVICE, useClass: MembershipQueryServiceImpl },
    { provide: ELIGIBILITY_POLICY, useClass: DefaultEligibilityPolicyService },
    { provide: MEMBERSHIP_CONTEXT_FACADE, useClass: MembershipContextFacadeImpl },
  ],
  exports: [MEMBERSHIP_CONTEXT_FACADE],
})
export class MembershipModule {}
