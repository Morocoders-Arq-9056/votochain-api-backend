import { DataSource, type Repository } from 'typeorm';
import { UserOrmEntity } from '../src/iam/infrastructure/persistence/typeorm/entities/user.orm-entity.js';import { UserPersistenceAssembler } from '../src/iam/infrastructure/persistence/typeorm/assemblers/user-persistence.assembler.js';
import { User } from '../src/iam/domain/model/aggregates/user.aggregate.js';
import { SnakeNamingStrategy } from '../src/shared/infrastructure/persistence/typeorm/configuration/strategy/snake-naming.strategy.js';
import { ContactAddress } from '../src/iam/domain/model/valueobjects/contact-address.value-object.js';
import { SystemRole } from '../src/iam/domain/model/valueobjects/system-role.value-object.js';

describe('IAM persistence (compose postgres)', () => {
  let ds: DataSource | undefined;
  let repo: Repository<UserOrmEntity> | undefined;
  const assembler = new UserPersistenceAssembler();
  const createdUserIds = new Set<string>();

  const mail = (tag: string) => `${tag}-${Date.now()}@votachain.dev`;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'matias2oo6',
      database: process.env.DB_NAME ?? 'votachain',
      entities: [UserOrmEntity],
      namingStrategy: new SnakeNamingStrategy(),
      // The schema is prepared by the project's migrations. Synchronizing this
      // partial entity set can attempt to rewrite the shared IAM table.
      synchronize: false,
    });
    await ds.initialize();
    repo = ds.getRepository(UserOrmEntity);
  }, 180000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  afterEach(async () => {
    if (repo && createdUserIds.size > 0) {
      await repo.delete([...createdUserIds]);
      createdUserIds.clear();
    }
  });

  it('round-trips a user with roles, preserving the granted set', async () => {
    if (!repo) throw new Error('repository missing');
    const user = User.signUp({ contact: ContactAddress.create(mail('roundtrip')), secretHash: 'scrypt$test' });
    createdUserIds.add(user.id.value);

    await repo.save(assembler.toOrmFromDomain(user));
    const found = await repo.findOne({ where: { id: user.id.value } });
    if (!found) throw new Error('seed missing');

    const rehydrated = assembler.toDomainFromOrm(found);
    expect(rehydrated.roles).toEqual([SystemRole.USER]);
    expect(rehydrated.contact.email).toBe(user.contact.email);
    expect(rehydrated.personId.value).toBe(user.personId.value);
    expect(rehydrated.secretHash).toBe('scrypt$test');
  });

  it('parseAccessStanding throws on a corrupt row instead of casting', async () => {
    if (!repo || !ds) throw new Error('database missing');
    const user = User.signUp({ contact: ContactAddress.create(mail('corrupt')), secretHash: 'scrypt$test' });
    createdUserIds.add(user.id.value);
    await repo.save(assembler.toOrmFromDomain(user));

    await ds.query(`update iam.users set standing = 'BOGUS' where id = $1`, [user.id.value]);
    const found = await repo.findOne({ where: { id: user.id.value } });
    if (!found) throw new Error('seed missing');

    expect(() => assembler.toDomainFromOrm(found)).toThrow();
  });

  it('enforces unique email at the database level', async () => {
    if (!repo) throw new Error('repository missing');
    const address = mail('dupe');
    const first = User.signUp({ contact: ContactAddress.create(address), secretHash: 'scrypt$test' });
    const duplicate = User.signUp({ contact: ContactAddress.create(address), secretHash: 'scrypt$test' });
    createdUserIds.add(first.id.value);
    createdUserIds.add(duplicate.id.value);

    await repo.save(assembler.toOrmFromDomain(first));
    await expect(
      repo.save(assembler.toOrmFromDomain(duplicate)),
    ).rejects.toThrow();
  });
});
