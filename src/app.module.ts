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
import appConfig from './shared/infrastructure/application/configuration/app.config.js';
import databaseConfig from './shared/infrastructure/persistence/configuration/database.config.js';
import idempotencyConfig from './shared/infrastructure/idempotency/configuration/idempotency.config.js';
import swaggerConfig from './shared/infrastructure/documentation/openapi/configuration/openapi.config.js';
import verificationConfig from './shared/infrastructure/verification/configuration/verification.config.js';
import { validationSchema } from './shared/infrastructure/persistence/configuration/validation.schema.js';
import { buildTypeOrmOptions } from './shared/infrastructure/persistence/typeorm/configuration/typeorm.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, swaggerConfig, idempotencyConfig, verificationConfig],
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}