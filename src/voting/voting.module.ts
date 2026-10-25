import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BiometricIdentityVerificationModule } from "../biometric-identity-verification/biometric-identity-verification.module.js";
import { BlockchainRelayTransactionDeliveryModule } from "../blockchain-relay-transaction-delivery/blockchain-relay-transaction-delivery.module.js";
import { CommunityModule } from "../community/community.module.js";
import { CryptographicWalletCustodyModule } from "../cryptographic-wallet-custody/cryptographic-wallet-custody.module.js";
import { MembershipModule } from "../membership/membership.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { VOTING_CONTEXT_FACADE } from "./interfaces/acl/voting-context.facade.js";
import { VotingContextFacadeImpl } from "./application/acl/voting-context-facade.impl.js";
import { AuthorizationCommandServiceImpl } from "./application/internal/commandservices/authorization-command.service.impl.js";
import { ProposalCommandServiceImpl } from "./application/internal/commandservices/proposal-command.service.impl.js";
import { VoteCommandServiceImpl } from "./application/internal/commandservices/vote-command.service.impl.js";
import { ProposalClosedEventHandler } from "./application/internal/eventhandlers/proposal-closed.event-handler.js";
import { VoteCastEventHandler } from "./application/internal/eventhandlers/vote-cast.event-handler.js";
import { AuthorizationExpireSweepService } from "./application/internal/sweep/authorization-expire-sweep.service.js";
import { ExternalBiometricService } from "./application/internal/outboundservices/acl/external-biometric.service.js";
import { ExternalCommunityService } from "./application/internal/outboundservices/acl/external-community.service.js";
import { ExternalMembershipService } from "./application/internal/outboundservices/acl/external-membership.service.js";
import { ExternalNotificationsService } from "./application/internal/outboundservices/acl/external-notifications.service.js";
import { ExternalRelayService } from "./application/internal/outboundservices/acl/external-relay.service.js";
import { ExternalWalletService } from "./application/internal/outboundservices/acl/external-wallet.service.js";
import { IDEMPOTENCY_KEY_STORE } from "./application/internal/outboundservices/idempotency/idempotency-key-store.service.js";
import { SIGNATURE_POLICY } from "./application/internal/outboundservices/signing/signature-policy.service.js";
import { AuthorizationQueryServiceImpl } from "./application/internal/queryservices/authorization-query.service.impl.js";
import { ProposalQueryServiceImpl } from "./application/internal/queryservices/proposal-query.service.impl.js";
import { VoteQueryServiceImpl } from "./application/internal/queryservices/vote-query.service.impl.js";
import { AUTHORIZATION_COMMAND_SERVICE } from "./domain/services/authorization-command.service.js";
import { AUTHORIZATION_QUERY_SERVICE } from "./domain/services/authorization-query.service.js";
import { PROPOSAL_COMMAND_SERVICE } from "./domain/services/proposal-command.service.js";
import { PROPOSAL_QUERY_SERVICE } from "./domain/services/proposal-query.service.js";
import { VOTE_COMMAND_SERVICE } from "./domain/services/vote-command.service.js";
import { VOTE_QUERY_SERVICE } from "./domain/services/vote-query.service.js";
import { AuthorizationRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/authorization-repository.impl.js";
import { ProposalRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/proposal-repository.impl.js";
import { RequestLogIdempotencyAdapter } from "./infrastructure/persistence/typeorm/adapters/request-log-idempotency.adapter.js";
import { VoteRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/vote-repository.impl.js";
import { ProposalPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/proposal-persistence.assembler.js";
import { VoteAuthorizationPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/vote-authorization-persistence.assembler.js";
import { VotePersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/vote-persistence.assembler.js";
import { ProposalOrmEntity } from "./infrastructure/persistence/typeorm/entities/proposal.orm-entity.js";
import { RequestLogOrmEntity } from "./infrastructure/persistence/typeorm/entities/request-log.orm-entity.js";
import { VoteAuthorizationOrmEntity } from "./infrastructure/persistence/typeorm/entities/vote-authorization.orm-entity.js";
import { VoteOrmEntity } from "./infrastructure/persistence/typeorm/entities/vote.orm-entity.js";
import { EthersSignatureVerificationService } from "./infrastructure/signing/ethers/ethers-signature-verification.service.js";
import { AuthorizationsController } from "./interfaces/rest/controllers/authorizations.controller.js";
import { ProposalsController } from "./interfaces/rest/controllers/proposals.controller.js";
import { VotesController } from "./interfaces/rest/controllers/votes.controller.js";
import { AUTHORIZATION_REPOSITORY } from "./domain/repositories/authorization.repository.js";
import { PROPOSAL_REPOSITORY } from "./domain/repositories/proposal.repository.js";
import { VOTE_REPOSITORY } from "./domain/repositories/vote.repository.js";

/**
 * Voting bounded context (core domain: verifiable intent becomes on-chain
 * fact). Three aggregates by identity reference, never embedded.
 *
 * Sprint-04: real Relay delivery (R5: acceptSigned → deliver → standing;
 * only `DeliveryConfirmed` feeds the tally — TECH-DEBT-01 closed) and real
 * Consent gates via owner modules. Depends one-directionally on Community
 * (policy ACL), Membership (eligibility ACL), Biometric (liveness gate),
 * Wallet (signing), Relay (delivery) and Notifications (vote-cast intents
 * via its published facade): those modules are imported for their published
 * tokens. None of them imports Voting — no cycles.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-28
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ProposalOrmEntity, VoteAuthorizationOrmEntity, VoteOrmEntity, RequestLogOrmEntity]),
    CommunityModule,
    MembershipModule,
    NotificationsModule,
    BiometricIdentityVerificationModule,
    CryptographicWalletCustodyModule,
    BlockchainRelayTransactionDeliveryModule,
  ],
  controllers: [ProposalsController, AuthorizationsController, VotesController],
  providers: [
    ProposalPersistenceAssembler,
    VoteAuthorizationPersistenceAssembler,
    VotePersistenceAssembler,
    RequestLogIdempotencyAdapter,
    VoteCastEventHandler,
    ProposalClosedEventHandler,
    AuthorizationExpireSweepService,
    ExternalBiometricService,
    ExternalWalletService,
    ExternalRelayService,
    ExternalMembershipService,
    ExternalCommunityService,
    ExternalNotificationsService,
    { provide: PROPOSAL_REPOSITORY, useClass: ProposalRepositoryImpl },
    { provide: AUTHORIZATION_REPOSITORY, useClass: AuthorizationRepositoryImpl },
    { provide: VOTE_REPOSITORY, useClass: VoteRepositoryImpl },
    { provide: IDEMPOTENCY_KEY_STORE, useClass: RequestLogIdempotencyAdapter },
    { provide: PROPOSAL_COMMAND_SERVICE, useClass: ProposalCommandServiceImpl },
    { provide: AUTHORIZATION_COMMAND_SERVICE, useClass: AuthorizationCommandServiceImpl },
    { provide: VOTE_COMMAND_SERVICE, useClass: VoteCommandServiceImpl },
    { provide: PROPOSAL_QUERY_SERVICE, useClass: ProposalQueryServiceImpl },
    { provide: AUTHORIZATION_QUERY_SERVICE, useClass: AuthorizationQueryServiceImpl },
    { provide: VOTE_QUERY_SERVICE, useClass: VoteQueryServiceImpl },
    { provide: SIGNATURE_POLICY, useClass: EthersSignatureVerificationService },
    { provide: VOTING_CONTEXT_FACADE, useClass: VotingContextFacadeImpl },
  ],
  exports: [VOTING_CONTEXT_FACADE],
})
export class VotingModule {}
