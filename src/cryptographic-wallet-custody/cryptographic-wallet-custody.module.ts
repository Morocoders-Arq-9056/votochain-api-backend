import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module.js";
import { WalletContextFacadeImpl } from "./application/acl/wallet-context-facade.impl.js";
import { WalletCommandServiceImpl } from "./application/internal/commandservices/wallet-command.service.impl.js";
import { WalletEventLogger } from "./application/internal/eventhandlers/wallet-event.logger.js";
import { WalletRetiredEventHandler } from "./application/internal/eventhandlers/wallet-retired.event-handler.js";
import { ExternalConsentService } from "./application/internal/outboundservices/acl/external-consent.service.js";
import { ExternalIamService } from "./application/internal/outboundservices/acl/external-iam.service.js";
import { WALLET_DERIVATION_STRATEGY, type KeyDerivationStrategy } from "./application/internal/outboundservices/key-derivation/key-derivation.service.js";
import { KEY_CUSTODY_SERVICE } from "./application/internal/outboundservices/kms/key-custody.service.js";
import { WALLET_SIGNING_POLICY, type SigningPolicy } from "./application/internal/outboundservices/signing-policy/signing-policy.service.js";
import { WalletQueryServiceImpl } from "./application/internal/queryservices/wallet-query.service.impl.js";
import { WALLET_COMMAND_SERVICE } from "./domain/services/wallet-command.service.js";
import { WALLET_QUERY_SERVICE } from "./domain/services/wallet-query.service.js";
import { WALLET_REPOSITORY } from "./domain/repositories/wallet.repository.js";
import { HdKeyDerivationService } from "./infrastructure/kms/derivation/hd/hd-key-derivation.service.js";
import { TestKeyDerivationService } from "./infrastructure/kms/derivation/test/test-key-derivation.service.js";
import { HdKeyCustodyService } from "./infrastructure/kms/hd-wallet/hd-key-custody.service.js";
import { HsmSigningPolicyService } from "./infrastructure/kms/signing/hsm/hsm-signing-policy.service.js";
import { MemorySigningPolicyService } from "./infrastructure/kms/signing/memory/memory-signing-policy.service.js";
import { WalletRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/wallet-repository.impl.js";
import { WalletPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/wallet-persistence.assembler.js";
import { WalletEventOrmEntity } from "./infrastructure/persistence/typeorm/entities/wallet-event.orm-entity.js";
import { WalletOrmEntity } from "./infrastructure/persistence/typeorm/entities/wallet.orm-entity.js";
import { WALLET_CONTEXT_FACADE } from "./interfaces/acl/wallet-context.facade.js";
import { WalletController } from "./interfaces/rest/controllers/wallet.controller.js";

/**
 * Cryptographic Wallet Custody bounded context (supporting subdomain: one
 * person's signing capability; reconstruct transiently, then forget).
 * Strategy swaps via `WALLET_DERIVATION_STRATEGY` (hd/test) and
 * `WALLET_SIGNING_POLICY` (hsm/memory): prod `hd+hsm`, dev/test
 * `test+memory`. Imports IamModule for the provision existence gate.
 * Publishes WALLET_CONTEXT_FACADE for Voting (R4).
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WalletOrmEntity, WalletEventOrmEntity]),
    ConfigModule,
    IamModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletPersistenceAssembler,
    WalletEventLogger,
    WalletRetiredEventHandler,
    ExternalIamService,
    ExternalConsentService,
    HdKeyDerivationService,
    TestKeyDerivationService,
    MemorySigningPolicyService,
    HsmSigningPolicyService,
    { provide: WALLET_REPOSITORY, useClass: WalletRepositoryImpl },
    { provide: WALLET_COMMAND_SERVICE, useClass: WalletCommandServiceImpl },
    { provide: WALLET_QUERY_SERVICE, useClass: WalletQueryServiceImpl },
    {
      provide: WALLET_DERIVATION_STRATEGY,
      inject: [ConfigService, HdKeyDerivationService, TestKeyDerivationService],
      useFactory: (
        config: ConfigService,
        hd: HdKeyDerivationService,
        test: TestKeyDerivationService,
      ): KeyDerivationStrategy =>
        config.get<string>('wallet.derivationStrategy', 'test') === 'hd' ? hd : test,
    },
    {
      provide: WALLET_SIGNING_POLICY,
      inject: [ConfigService, HsmSigningPolicyService, MemorySigningPolicyService],
      useFactory: (
        config: ConfigService,
        hsm: HsmSigningPolicyService,
        memory: MemorySigningPolicyService,
      ): SigningPolicy =>
        config.get<string>('wallet.signingPolicy', 'memory') === 'hsm' ? hsm : memory,
    },
    { provide: KEY_CUSTODY_SERVICE, useClass: HdKeyCustodyService },
    { provide: WALLET_CONTEXT_FACADE, useClass: WalletContextFacadeImpl },
  ],
  exports: [WALLET_CONTEXT_FACADE],
})
export class CryptographicWalletCustodyModule {}
