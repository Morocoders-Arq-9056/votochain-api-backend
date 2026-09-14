import { Inject, Injectable } from "@nestjs/common";
import { UserCommandService } from "../../../domain/services/user-command.service.js";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.js";
import type { UserRepository } from "../../../domain/repositories/user.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserId } from "../../../domain/model/valueobjects/user-id.value-object.js";
import { SignUpCommand } from "../../../domain/model/commands/sign-up.command.js";
import { SignOutCommand } from "../../../domain/model/commands/sign-out.command.js";
import { SignInCommand } from "../../../domain/model/commands/sign-in.command.js";
import { ChangeSecretCommand } from "../../../domain/model/commands/change-secret.command.js";
import { VerifyEmailCommand } from "../../../domain/model/commands/verify-email.command.js";
import { LinkOutsideIdentityCommand } from "../../../domain/model/commands/link-outside-identity.command.js";
import { ChangeEmailCommand } from "../../../domain/model/commands/change-email.command.js";
import { UnlinkOutsideIdentityCommand } from "../../../domain/model/commands/unlink-outside-identity.command.js";
import { GrantSystemRoleCommand } from "../../../domain/model/commands/grant-system-role.command.js";
import { RevokeSystemRoleCommand } from "../../../domain/model/commands/revoke-system-role.command.js";
import { SuspendAccessCommand } from "../../../domain/model/commands/suspend-access.command.js";
import { User } from "../../../domain/model/aggregates/user.aggregate.js";
import { AddressAlreadyHeldError } from "../../../domain/exceptions/address-already-held.error.js";

@Injectable()
export class UserCommandServiceImpl implements UserCommandService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository, 
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly eventEmitter: EventEmitter2
  ) {}
  
  async handle(command: SignUpCommand): Promise<UserId>;
  //async handle(command: SignInCommand): Promise<void>;
  //async handle(command: SignOutCommand): Promise<void>;
  //async handle(command: ChangeSecretCommand): Promise<any>;
  //async handle(command: ChangeEmailCommand): Promise<void>;
  //async handle(command: VerifyEmailCommand): Promise<void>;
  //async handle(command: LinkOutsideIdentityCommand): Promise<any>;
  //async handle(command: UnlinkOutsideIdentityCommand): Promise<void>;
  //async handle(command: GrantSystemRoleCommand): Promise<void>;
  //async handle(command: RevokeSystemRoleCommand): Promise<any>;
  //async handle(command: SuspendAccessCommand): Promise<any>;


  async handle(command: SignUpCommand): Promise<UserId> {
    const user = await this.unitOfWork.run(async() => {
        if (await this.userRepository.findByEmail(command.contactAddress.email))
          throw new AddressAlreadyHeldError('address already held');
        const u = User.signUp({ contact: command.contactAddress});
        await this.userRepository.save(u);
        return u;
    });
    this.publishDomainEvents(user);
    return user.id;
  }

  private publishDomainEvents(user: User): void {
    for(const event of user.pullDomainEvents()) {
        this.eventEmitter.emit(event.eventName, event);
    }
  }
}