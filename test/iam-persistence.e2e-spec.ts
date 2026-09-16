import { DataSource, type Repository } from 'typeorm';
import { PostgreSQLContainer, type StartedPostgreSQLContainer } from 'testcontainers';
import { UserOrmEntity } from '../src/iam/infrastructure/persistence/typeorm/entities/user.orm-entity.js';
import { SystemRoleAssignmentOrmEntity } from '../src/iam/infrastructure/persistence/typeorm/entities/system-role-assignment.orm-entity.js';
import { UserPersistenceAssembler } from '../src/iam/infrastructure/persistence/typeorm/assemblers/user-persistence.assembler.js';
import { User } from '../src/iam/domain/model/aggregates/user.aggregate.js';
import { ContactAddress } from '../src/iam/domain/model/valueobjects/contact-address.value-object.js';
import { SystemRole } from '../src/iam/domain/model/valueobjects/system-role.value-object.js';

describe('IAM persistence (Testcontainers)', () => {
  let container: StartedPostgreSQLContainer | undefined;
  let ds: DataSource | undefined;
  let repo: Repository<UserOrmEntity> | undefined;
  const assembler = new UserPersistenceAssembler();

  const mail = (tag: string) => `${tag}-${Date.now()}@votachain.dev`;

  beforeAll(async () => {
    container = await new PostgreSQLContainer('postgres:16-alpine').start();
    ds = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [UserOrmEntity, SystemRoleAssignmentOrmEntity],
      synchronize: true,
    });
    await ds.initialize();
    repo = ds.getRepository(UserOrmEntity);
  }, 180000);

  afterAll(async () => {
    await ds?.destroy();
    await container?.stop();
  });

  it('round-trips a user with assignments, preserving grantedAt', async () => {
    if (!repo) throw new Error('repository missing');
    const user = User.signUp({ contact: ContactAddress.create(mail('roundtrip')) });

    await repo.save(assembler.toOrmFromDomain(user));
    const found = await repo.findOne({
      where: { id: user.id.value },
      relations: { assignments: true },
    });
    if (!found) throw new Error('seed missing');

    const rehydrated = assembler.toDomainFromOrm(found);
    expect(rehydrated.roleAssignments).toHaveLength(1);
    expect(rehydrated.roleAssignments[0]?.role).toBe(SystemRole.USER);
    expect(rehydrated.roleAssignments[0]?.grantedAt).toBeInstanceOf(Date);
  });

  it('parseAccessStanding throws on a corrupt row instead of casting', async () => {
    if (!repo || !ds) throw new Error('database missing');
    const user = User.signUp({ contact: ContactAddress.create(mail('corrupt')) });
    await repo.save(assembler.toOrmFromDomain(user));

    await ds.query(`update iam.users set standing = 'BOGUS' where id = $1`, [user.id.value]);
    const found = await repo.findOne({
      where: { id: user.id.value },
      relations: { assignments: true },
    });
    if (!found) throw new Error('seed missing');

    expect(() => assembler.toDomainFromOrm(found)).toThrow();
  });

  it('enforces unique email at the database level', async () => {
    if (!repo) throw new Error('repository missing');
    const address = mail('dupe');

    await repo.save(assembler.toOrmFromDomain(User.signUp({ contact: ContactAddress.create(address) })));
    await expect(
      repo.save(assembler.toOrmFromDomain(User.signUp({ contact: ContactAddress.create(address) }))),
    ).rejects.toThrow();
  });
});
