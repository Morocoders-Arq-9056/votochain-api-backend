import type { EventEmitter2 } from '@nestjs/event-emitter';
import { UserCommandServiceImpl } from './user-command.service.impl.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { IUnitOfWork } from '../../../../shared/domain/repositories/unit-of-work.js';
import type { ProofVerificationService } from '../outboundservices/proof/proof-verification.service.js';
import { SignUpCommand } from '../../../domain/model/commands/sign-up.command.js';
import { ContactAddress } from '../../../domain/model/valueobjects/contact-address.value-object.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { UserSignedUpEvent } from '../../../domain/model/events/user-signed-up.event.js';
import { AddressAlreadyHeldError } from '../../../domain/exceptions/address-already-held.error.js';

/**
 * Signup slice fixture: in-memory repository, passthrough unit of work,
 * always-holding proof port and capturing event bus (Sprint-01 fakes).
 */
function setup(existing: User | null) {
  let saved: User | undefined;
  const emitted: unknown[][] = [];
  const users = {
    findById: async () => null,
    findByEmail: async () => existing,
    findByPersonId: async () => null,
    save: async (u: User) => {
      saved = u;
    },
  } as unknown as UserRepository;
  const unitOfWork = { run: <T>(fn: () => Promise<T>) => fn() } as IUnitOfWork;
  const proofs = { holds: async () => true } as ProofVerificationService;
  const eventEmitter = {
    emit: (...args: unknown[]) => {
      emitted.push(args);
    },
  } as unknown as EventEmitter2;
  const service = new UserCommandServiceImpl(users, unitOfWork, proofs, eventEmitter);
  return { service, saved: () => saved, emitted };
}

describe('UserCommandServiceImpl.signUp', () => {
  it('saves a new user, emits UserSignedUpEvent after commit, and returns its id', async () => {
    const { service, saved, emitted } = setup(null);

    const id = await service.signUp(new SignUpCommand(ContactAddress.create('ada@votachain.dev')));

    expect(id.value.startsWith('usr-')).toBe(true);
    expect(saved()?.contact.email).toBe('ada@votachain.dev');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.[0]).toBe('UserSignedUp');
    expect(emitted[0]?.[1]).toBeInstanceOf(UserSignedUpEvent);
  });

  it('refuses a held address without saving or emitting', async () => {
    const existing = User.signUp({ contact: ContactAddress.create('ada@votachain.dev') });
    const { service, saved, emitted } = setup(existing);

    await expect(
      service.signUp(new SignUpCommand(ContactAddress.create('ada@votachain.dev'))),
    ).rejects.toThrow(AddressAlreadyHeldError);
    expect(saved()).toBeUndefined();
    expect(emitted).toHaveLength(0);
  });
});
