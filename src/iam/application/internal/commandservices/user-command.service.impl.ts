import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserCommandService } from "../../../domain/services/user-command.service.js";
import { USER_REPOSITORY } from "../../../domain/repositories/user.repository.js";
import type { UserRepository } from "../../../domain/repositories/user.repository.js";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { PROOF_VERIFICATION_SERVICE } from "../outboundservices/proof/proof-verification.service.js";
import type { ProofVerificationService } from "../outboundservices/proof/proof-verification.service.js";
import { PASSWORD_HASHER_SERVICE } from "../outboundservices/hashing/password-hasher.service.js";
import type { PasswordHasherService } from "../outboundservices/hashing/password-hasher.service.js";
import { LocalSecret } from "../../../domain/model/valueobjects/local-secret.value-object.js";
import { InvalidCredentialsError } from "../../../domain/exceptions/invalid-credentials.error.js";
import { IllegalUserStateError } from "../../../domain/exceptions/illegal-user-state.error.js";
import { UserId } from "../../../domain/model/valueobjects/user-id.value-object.js";
import { SignUpCommand } from "../../../domain/model/commands/sign-up.command.js";
import { SignInCommand } from "../../../domain/model/commands/sign-in.command.js";
import { SignOutCommand } from "../../../domain/model/commands/sign-out.command.js";
import { ChangeSecretCommand } from "../../../domain/model/commands/change-secret.command.js";
import { ChangeEmailCommand } from "../../../domain/model/commands/change-email.command.js";
import { VerifyEmailCommand } from "../../../domain/model/commands/verify-email.command.js";
import { LinkOutsideIdentityCommand } from "../../../domain/model/commands/link-outside-identity.command.js";
import { UnlinkOutsideIdentityCommand } from "../../../domain/model/commands/unlink-outside-identity.command.js";
import { GrantSystemRoleCommand } from "../../../domain/model/commands/grant-system-role.command.js";
import { RevokeSystemRoleCommand } from "../../../domain/model/commands/revoke-system-role.command.js";
import { SuspendAccessCommand } from "../../../domain/model/commands/suspend-access.command.js";
import { RestoreAccessCommand } from "../../../domain/model/commands/restore-access.command.js";
import { User } from "../../../domain/model/aggregates/user.aggregate.js";
import { AddressAlreadyHeldError } from "../../../domain/exceptions/address-already-held.error.js";
import { OutsideProverRef } from "../../../domain/model/valueobjects/outside-prover-ref.value-object.js";
import { ProofKind } from "../../../domain/model/valueobjects/proof-kind.value-object.js";
import { UserNotFoundError } from "../../../domain/exceptions/user-not-found.error.js";

/**
 * Constant-time dummy hash compared when the address is unknown or the row
 * predates secret_hash, so sign-in timing never reveals existence.
 */
const DUMMY_SECRET_HASH =
  'scrypt$16384$8$1$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

/**
 * Application orchestration for the 12 User write use cases.
 *
 * Holds no business rules: loads the aggregate, invokes its behavior, saves
 * through the repository port. External gates (`proofs.holds()`) run BEFORE
 * `uow.run()` — the transaction groups DB statements only, never network I/O.
 * Domain events are published strictly after the commit resolves.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-09-17
 */
@Injectable()
export class UserCommandServiceImpl implements UserCommandService {
  /**
   * Wires the command service over persistence, transactions and verdicts.
   * @param userRepository Repository port for the User aggregate.
   * @param unitOfWork Transaction boundary for writes.
   * @param proofs Executor verdict port, observed never performed.
   * @param eventEmitter In-process bus for in-module handlers only.
   */
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(PROOF_VERIFICATION_SERVICE) private readonly proofs: ProofVerificationService,
    @Inject(PASSWORD_HASHER_SERVICE) private readonly hasher: PasswordHasherService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers a fresh identity with a classic-login secret; refuses
   * addresses held by another identity.
   * @inheritdoc
   */
  async signUp(command: SignUpCommand): Promise<UserId> {
    try {
      LocalSecret.parse(command.plainSecret);
    } catch (e) {
      throw new IllegalUserStateError((e as Error).message);
    }
    const secretHash = await this.hasher.hash(command.plainSecret);
    const user = await this.unitOfWork.run(async () => {
      if (await this.userRepository.findByEmail(command.contactAddress.email))
        throw new AddressAlreadyHeldError('address already held');
      const u = User.signUp({ contact: command.contactAddress, secretHash });
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
    return user.id;
  }

  /**
   * Proves the user in, superseding any open session atomically. LOCAL
   * judges the hashed secret; OUTSIDE judges the linked outside proof.
   * Every LOCAL rejection collapses to invalid credentials (401) so the
   * endpoint never reveals whether the address exists.
   * @inheritdoc
   */
  async signIn(command: SignInCommand): Promise<void> {
    if (command.proofKind === ProofKind.OUTSIDE) {
      const user = await this.unitOfWork.run(async () => {
        const u = await this.userRepository.findByEmail(command.email);
        if (!u) throw new InvalidCredentialsError();
        const holds = await this.proofs.holds(u.id.value);
        if (!holds) throw new InvalidCredentialsError();
        try {
          u.signIn(ProofKind.OUTSIDE);
        } catch {
          throw new InvalidCredentialsError();
        }
        await this.userRepository.save(u);
        return u;
      });
      this.publishDomainEvents(user);
      return;
    }
    if (!command.plainSecret?.trim()) throw new InvalidCredentialsError();
    const user = await this.unitOfWork.run(async () => {
      const u = await this.userRepository.findByEmail(command.email);
      const stored = u?.secretHash ?? DUMMY_SECRET_HASH;
      const holds = await this.hasher.matches(command.plainSecret as string, stored);
      if (!u || !u.secretHash || !holds) throw new InvalidCredentialsError();
      try {
        u.signIn(ProofKind.LOCAL);
      } catch {
        throw new InvalidCredentialsError();
      }
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Closes the open session with reason ASKED.
   * @inheritdoc
   */
  async signOut(command: SignOutCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.signOut();
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Changes the secret after judging the acceptance policy; ends the session.
   * @inheritdoc
   */
  async changeSecret(command: ChangeSecretCommand): Promise<void> {
    try {
      LocalSecret.parse(command.newSecret);
    } catch (e) {
      throw new IllegalUserStateError((e as Error).message);
    }
    const secretHash = await this.hasher.hash(command.newSecret);
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.setSecretHash(secretHash);
      u.changeSecret();
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Changes the contact address after checking freshness against history.
   * @inheritdoc
   */
  async changeEmail(command: ChangeEmailCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const holder = await this.userRepository.findByEmail(command.contact.email);
      if (holder && !holder.id.equals(command.userId)) throw new AddressAlreadyHeldError('address already held');
      const u = await this.require(command.userId);
      u.changeEmail(command.contact);
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Records the observed email confirmation for the recorded address.
   * @inheritdoc
   */
  async verifyEmail(command: VerifyEmailCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.verifyEmail();
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Links the single agreed outside proof to an ACTIVE identity.
   * @inheritdoc
   */
  async linkOutsideIdentity(command: LinkOutsideIdentityCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.linkOutsideIdentity(OutsideProverRef.of(command.provider, command.externalId));
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Unlinks the outside proof; the aggregate refuses the final way to prove.
   * @inheritdoc
   */
  async unlinkOutsideIdentity(command: UnlinkOutsideIdentityCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.unlinkOutsideIdentity(command.provider);
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Grants a global technical role.
   * @inheritdoc
   */
  async grantSystemRole(command: GrantSystemRoleCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.grantSystemRole(command.role);
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Revokes a held role; the aggregate refuses the final ADMIN.
   * @inheritdoc
   */
  async revokeSystemRole(command: RevokeSystemRoleCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.revokeSystemRole(command.role);
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Suspends access with reason and ends the open session (admin decision;
   * failed-proof counting lives outside in Sprint-01).
   * @inheritdoc
   */
  async suspendAccess(command: SuspendAccessCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.suspend(command.reason);
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Restores a SUSPENDED identity to ACTIVE.
   * @inheritdoc
   */
  async restoreAccess(command: RestoreAccessCommand): Promise<void> {
    const user = await this.unitOfWork.run(async () => {
      const u = await this.require(command.userId);
      u.restore();
      await this.userRepository.save(u);
      return u;
    });
    this.publishDomainEvents(user);
  }

  /**
   * Loads the aggregate or raises the read/update rejection for unknown ids.
   * @param id Technical identity id.
   */
  private async require(id: UserId): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new UserNotFoundError('user not found');
    return user;
  }

  /**
   * Drains buffered domain events after commit; never called inside run().
   * @param user Aggregate whose events are published to in-module handlers.
   */
  private publishDomainEvents(user: User): void {
    for (const event of user.pullDomainEvents()) {
      this.eventEmitter.emit(event.eventName, event);
    }
  }
}
