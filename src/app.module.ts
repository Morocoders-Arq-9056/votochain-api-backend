import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SharedModule } from './shared/shared.module.js';
import appConfig from './shared/infrastructure/application/configuration/app.config.js';
import databaseConfig from './shared/infrastructure/persistence/configuration/database.config.js';
import idempotencyConfig from './shared/infrastructure/idempotency/configuration/idempotency.config.js';
import swaggerConfig from './shared/infrastructure/documentation/openapi/configuration/openapi.config.js';
import { validationSchema } from './shared/infrastructure/persistence/configuration/validation.schema.js';
import { buildTypeOrmOptions } from './shared/infrastructure/persistence/typeorm/configuration/typeorm.config.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, swaggerConfig, idempotencyConfig],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
    EventEmitterModule.forRoot(),
    SharedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}