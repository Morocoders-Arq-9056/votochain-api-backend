import { Inject, Injectable } from "@nestjs/common";
import { UserCommandService } from "../../../domain/services/user-command.service.js";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.js";
import type { UserRepository } from "../../../domain/repositories/user.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserId } from "../../../domain/model/valueobjects/user-id.value-object.js";
import { SignUpCommand } from "../../../domain/model/commands/sign-up.command.js";
import { User } from "../../../domain/model/aggregates/user.aggregate.js";
import { AddressAlreadyHeldError } from "../../../domain/exceptions/address-already-held.error.js";

@Injectable()
export class UserCommandServiceImpl implements UserCommandService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository, 
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly eventEmitter: EventEmitter2
  ) {}
  
  async signUp(command: SignUpCommand): Promise<UserId> {
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