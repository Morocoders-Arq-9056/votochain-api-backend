import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SharedModule } from './shared/shared.module.js';
import { IamModule } from './iam/iam.module.js';
import { VerificationModule } from './verification/verification.module.js';
import { CommunityModule } from './community/community.module.js';
import { MembershipModule } from './membership/membership.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { VotingModule } from './voting/voting.module.js';
import { DocumentOcrFaceMatchProviderModule } from './document-ocr-face-match-provider/document-ocr-face-match-provider.module.js';
import { BiometricIdentityVerificationModule } from './biometric-identity-verification/biometric-identity-verification.module.js';
import { CryptographicWalletCustodyModule } from './cryptographic-wallet-custody/cryptographic-wallet-custody.module.js';
import { BlockchainRelayTransactionDeliveryModule } from './blockchain-relay-transaction-delivery/blockchain-relay-transaction-delivery.module.js';
import { ConsentComplianceModule } from './consent-compliance/consent-compliance.module.js';
import appConfig from './shared/infrastructure/application/configuration/app.config.js';
import awsConfig from './shared/infrastructure/aws/configuration/aws.config.js';
import azureConfig from './shared/infrastructure/azure/configuration/azure.config.js';
import databaseConfig from './shared/infrastructure/persistence/configuration/database.config.js';
import idempotencyConfig from './shared/infrastructure/idempotency/configuration/idempotency.config.js';
import swaggerConfig from './shared/infrastructure/documentation/openapi/configuration/openapi.config.js';
import verificationConfig from './shared/infrastructure/verification/configuration/verification.config.js';
import ocrConfig from './shared/infrastructure/ocr/configuration/ocr.config.js';
import biometricConfig from './shared/infrastructure/biometric/configuration/biometric.config.js';
import walletConfig from './shared/infrastructure/wallet/configuration/wallet.config.js';
import relayConfig from './shared/infrastructure/relay/configuration/relay.config.js';
import { validationSchema } from './shared/infrastructure/persistence/configuration/validation.schema.js';
import { buildTypeOrmOptions } from './shared/infrastructure/persistence/typeorm/configuration/typeorm.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, awsConfig, azureConfig, databaseConfig, swaggerConfig, idempotencyConfig, verificationConfig, ocrConfig, biometricConfig, walletConfig, relayConfig],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    EventEmitterModule.forRoot(),
    SharedModule,
    IamModule,
    VerificationModule,
    CommunityModule,
    MembershipModule,
    NotificationsModule,
    VotingModule,
    DocumentOcrFaceMatchProviderModule,
    BiometricIdentityVerificationModule,
    CryptographicWalletCustodyModule,
    BlockchainRelayTransactionDeliveryModule,
    ConsentComplianceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}