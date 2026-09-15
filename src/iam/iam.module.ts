import { Module } from "@nestjs/common";
import { UserCommandServiceImpl } from "./application/internal/commandservices/user-command.service.impl.js";
import { UserQueryServiceImpl } from "./application/internal/queryservices/user-query.service.impl.js";
import { USER_COMMAND_SERVICE } from "./domain/services/user-command.service.js";
import { USER_QUERY_SERVICE } from "./domain/services/user-query.service.js";
import { USER_REPOSITORY } from "./domain/repositories/user.repository.js";
import { AuthenticationController } from "./interfaces/rest/controllers/authentication.controller.js";
import { UserRepositoryImpl } from "./infrastructure/persistence/typeorm/adapters/user-repository.impl.js";
import { UserPersistenceAssembler } from "./infrastructure/persistence/typeorm/assemblers/user-persistence.assembler.js";
import { SystemRoleAssignmentOrmEntity } from "./infrastructure/persistence/typeorm/entities/system-role-assignment.orm-entity.js";
import { UserOrmEntity } from "./infrastructure/persistence/typeorm/entities/user.orm-entity.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Auth0ProofService } from "./infrastructure/proof/auth0/service/auth0-proof.service.js";
import { PROOF_VERIFICATION_SERVICE } from "./application/internal/outboundservices/proof/proof-verification.service.js";
import auth0Config from './infrastructure/proof/auth0/configuration/auth0.config.js';
import { ConfigModule } from "@nestjs/config";
@Module({
  imports: [
  TypeOrmModule.forFeature([UserOrmEntity, SystemRoleAssignmentOrmEntity]),
  ConfigModule.forFeature(auth0Config),
  ],
  controllers: [AuthenticationController], 
  providers: [
    UserPersistenceAssembler,
    UserCommandServiceImpl,
    UserQueryServiceImpl,
    { provide: USER_REPOSITORY, useClass: UserRepositoryImpl },
    { provide: USER_COMMAND_SERVICE, useClass: UserCommandServiceImpl },
    { provide: USER_QUERY_SERVICE, useClass: UserQueryServiceImpl },
    { provide: PROOF_VERIFICATION_SERVICE, useClass: Auth0ProofService }
  ],
})
export class IamModule {}