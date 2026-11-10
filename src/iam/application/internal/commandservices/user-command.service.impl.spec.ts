import type { EventEmitter2 } from '@nestjs/event-emitter';
import { UserCommandServiceImpl } from './user-command.service.impl.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { IUnitOfWork } from '../../../../shared/domain/repositories/unit-of-work.js';
import type { ProofVerificationService } from '../outboundservices/proof/proof-verification.service.js';
import { FakePasswordHasherService } from '../../../infrastructure/hashing/fake/fake-password-hasher.service.js';
import { SignInCommand } from '../../../domain/model/commands/sign-in.command.js';
import { SignUpCommand } from '../../../domain/model/commands/sign-up.command.js';
import { ContactAddress } from '../../../domain/model/valueobjects/contact-address.value-object.js';
import { User } from '../../../domain/model/aggregates/user.aggregate.js';
import { UserSignedUpEvent } from '../../../domain/model/events/user-signed-up.event.js';
import { AddressAlreadyHeldError } from '../../../domain/exceptions/address-already-held.error.js';
import { InvalidCredentialsError } from '../../../domain/exceptions/invalid-credentials.error.js';

/**
 * Classic-login fixture: in-memory repository, passthrough unit of work,
 * fake hasher and capturing event bus.
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
  const unitOfWork = {
    run: <T>(fn: () => Promise<T>) => fn(),
    runWithAfterCommit: async <T>(fn: () => Promise<T>, afterCommit: (r: T) => Promise<void> | void) => {
      const result = await fn();
      await afterCommit(result);
      return result;
    },
  } as IUnitOfWork;
  const proofs = { holds: async () => true } as ProofVerificationService;
  const hasher = new FakePasswordHasherService();
  const eventEmitter = {
    emit: (...args: unknown[]) => {
      emitted.push(args);
    },
  } as unknown as EventEmitter2;
  const service = new UserCommandServiceImpl(users, unitOfWork, proofs, hasher, eventEmitter);
  return { service, saved: () => saved, emitted };
}

const SECRET = 'S3gura-2026';

describe('UserCommandServiceImpl.signUp', () => {
  it('saves a new user, emits UserSignedUpEvent after commit, and returns its id', async () => {
    const { service, saved, emitted } = setup(null);

    const id = await service.signUp(new SignUpCommand(ContactAddress.create('ada@votachain.dev'), SECRET));

    expect(id.value.startsWith('usr-')).toBe(true);
    expect(saved()?.contact.email).toBe('ada@votachain.dev');
    expect(saved()?.secretHash).toBe(`fake$${SECRET}`);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.[0]).toBe('UserSignedUp');
    expect(emitted[0]?.[1]).toBeInstanceOf(UserSignedUpEvent);
  });

  it('refuses a held address without saving or emitting', async () => {
    const existing = User.signUp({ contact: ContactAddress.create('ada@votachain.dev'), secretHash: `fake$${SECRET}` });
    const { service, saved, emitted } = setup(existing);

    await expect(
      service.signUp(new SignUpCommand(ContactAddress.create('ada@votachain.dev'), SECRET)),
    ).rejects.toThrow(AddressAlreadyHeldError);
    expect(saved()).toBeUndefined();
    expect(emitted).toHaveLength(0);
  });
});

describe('UserCommandServiceImpl.signIn', () => {
  it('rejects an unknown address with invalid credentials', async () => {
    const { service } = setup(null);

    await expect(
      service.signIn(new SignInCommand('nadie@votachain.dev', SECRET)),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rejects a wrong secret with invalid credentials', async () => {
    const existing = User.signUp({ contact: ContactAddress.create('ada@votachain.dev'), secretHash: `fake$${SECRET}` });
    existing.verifyEmail();
    const { service } = setup(existing);

    await expect(
      service.signIn(new SignInCommand('ada@votachain.dev', 'Otra-Clave-0000')),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});
