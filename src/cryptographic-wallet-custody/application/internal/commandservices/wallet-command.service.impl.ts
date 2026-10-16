import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UNIT_OF_WORK } from "../../../../shared/domain/repositories/unit-of-work.js";
import type { IUnitOfWork } from "../../../../shared/domain/repositories/unit-of-work.js";
import { UserWallet } from "../../../domain/model/aggregates/user-wallet.aggregate.js";
import { ProvisionWalletCommand } from "../../../domain/model/commands/provision-wallet.command.js";
import { RetireWalletCommand } from "../../../domain/model/commands/retire-wallet.command.js";
import { RotateWalletCommand } from "../../../domain/model/commands/rotate-wallet.command.js";
import { SignVoteContentCommand } from "../../../domain/model/commands/sign-vote-content.command.js";
import { SuspendWalletCommand } from "../../../domain/model/commands/suspend-wallet.command.js";
import { DerivationPosition } from "../../../domain/model/valueobjects/derivation-position.value-object.js";
import { UserWalletId } from "../../../domain/model/valueobjects/user-wallet-id.value-object.js";
import { WalletStanding } from "../../../domain/model/valueobjects/wallet-standing.value-object.js";
import { CapabilityAlreadyExistsError } from "../../../domain/exceptions/capability-already-exists.error.js";
import { CapabilityNotFoundError } from "../../../domain/exceptions/capability-not-found.error.js";
import { WALLET_REPOSITORY } from "../../../domain/repositories/wallet.repository.js";
import type { WalletRepository } from "../../../domain/repositories/wallet.repository.js";
import type { WalletCommandService } from "../../../domain/services/wallet-command.service.js";
import { ExternalIamService } from "../outboundservices/acl/external-iam.service.js";
import { KEY_CUSTODY_SERVICE } from "../outboundservices/kms/key-custody.service.js";
import type { KeyCustodyService } from "../outboundservices/kms/key-custody.service.js";

/**
 * Application orchestration for the 5 wallet writes.
 *
 * Anchor UC2 `signVoteContent` is atomic in intent across two units of
 * work: `[uow#1: reconstructForSigning → save]` → `custody.signTransient`
 * (outside the tx, memory-only, discarded the same tick) → `[uow#2,
 * finally: forget → save]` (closes even when signing fails). A second
 * concurrent sign fails with `ReconstructionAlreadyOpen`. Retries never
 * reuse a reconstruction.
 *
 * @author Ethan Matias Aliaga Aguirre
 * @since 2026-10-05
 */
@Injectable()
export class WalletCommandServiceImpl implements WalletCommandService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
    @Inject(KEY_CUSTODY_SERVICE) private readonly custody: KeyCustodyService,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly iam: ExternalIamService,
    private readonly events: EventEmitter2,
  ) {}

  async provisionWallet(command: ProvisionWalletCommand): Promise<UserWalletId> {
    if (!(await this.iam.personExists(command.personId.value)))
      throw new CapabilityNotFoundError('person unknown');
    const wallet = await this.uow.run(async () => {
      const live = await this.wallets.findLiveByPerson(command.personId);
      if (live) throw new CapabilityAlreadyExistsError('capability already exists');
      const position = DerivationPosition.of(await this.wallets.nextPosition());
      const w = UserWallet.provision(UserWalletId.generate(), command.personId, position);
      await this.wallets.save(w);
      return w;
    });
    this.publish(wallet);
    return wallet.id;
  }

  async signVoteContent(command: SignVoteContentCommand): Promise<string> {
    const opened = await this.uow.run(async () => {
      const w = await this.require(command.walletId);
      w.reconstructForSigning(command.contentRef);
      await this.wallets.save(w);
      return w;
    });
    this.publish(opened);
    let signed: string;
    try {
      signed = await this.custody.signTransient(
        opened.personId.value,
        opened.position.value,
        command.contentRef.value,
      );
    } finally {
      const closed = await this.uow.run(async () => {
        const w = await this.require(command.walletId);
        if (w.standing === WalletStanding.SIGNING_OPEN) {
          w.forget();
          await this.wallets.save(w);
        }
        return w;
      });
      this.publish(closed);
    }
    return signed!;
  }

  async rotateWallet(command: RotateWalletCommand): Promise<void> {
    const { old, successor } = await this.uow.run(async () => {
      const w = await this.require(command.walletId);
      if (await this.wallets.existsPosition(command.newPosition))
        throw new CapabilityAlreadyExistsError('position already taken');
      const s = w.rotate(command.newPosition);
      await this.wallets.save(w);
      await this.wallets.save(s);
      return { old: w, successor: s };
    });
    this.publish(old);
    this.publish(successor);
  }

  async suspendWallet(command: SuspendWalletCommand): Promise<void> {
    const wallet = await this.uow.run(async () => {
      const w = await this.require(command.walletId);
      w.suspend(command.reason);
      await this.wallets.save(w);
      return w;
    });
    this.publish(wallet);
  }

  async retireWallet(command: RetireWalletCommand): Promise<void> {
    const wallet = await this.uow.run(async () => {
      const w = await this.require(command.walletId);
      w.retire();
      await this.wallets.save(w);
      return w;
    });
    this.publish(wallet);
  }

  private async require(id: UserWalletId): Promise<UserWallet> {
    const w = await this.wallets.findById(id);
    if (!w) throw new CapabilityNotFoundError('wallet not found');
    return w;
  }

  private publish(w: UserWallet): void {
    for (const e of w.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
