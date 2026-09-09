## VotaChain API — NestJS | DDD | CQRS | Modular Monolith — IAM

---

## INDICE

1. [Estructura del Proyecto](#estructura)
2. [Domain Layer](#domain)
3. [Application Layer](#application)
4. [Infrastructure Layer](#infrastructure)
5. [Interfaces Layer](#interfaces)
6. [Esquema de Base de Datos](#database)
7. [Flujos CQRS por Caso de Uso](#flujos)
8. [Integracion con otros BCs](#integracion)
9. [Dependencias Externas](#dependencias)
10. [Auditoria y Correcciones Aplicadas](#auditoria)

---

<a name="estructura"></a>

## 1. Estructura del Proyecto

```
src/iam/
├── interfaces/
│   ├── rest/
│   │   ├── iam.controller.ts
│   │   ├── resources/                  # DTOs con class-validator
│   │   │   ├── signup-user.resource.ts
│   │   │   ├── signin-user.resource.ts
│   │   │   ├── change-email.resource.ts
│   │   │   └── user.resource.ts
│   │   ├── transform/                  # assemblers resource <-> command
│   │   │   ├── signup-command-from-resource.assembler.ts
│   │   │   └── user-resource-from-entity.assembler.ts
│   │   └── filters/
│   │       └── iam-exception.filter.ts
│   └── acl/
│       └── iam-context.facade.ts       # facade + IAM_CONTEXT_FACADE token
├── application/
│   ├── acl/
│   │   └── iam-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   └── user-command.service.impl.ts
│       ├── queryservices/
│       │   └── user-query.service.impl.ts
│       ├── eventhandlers/
│       │   └── user-event-logger.ts    # @OnEvent internos, solo log
│       └── outboundservices/
│           ├── proof/
│           │   └── proof-verification.service.ts        # port + token
│           ├── session/
│           │   └── session-artifact.service.ts          # port + token
│           └── acl/
│               ├── external-verification.service.ts     # consume Verification facade (UC6)
│               └── external-notifications.service.ts    # consume Notifications facade (avisos)
├── domain/
│   ├── model/
│   │   ├── aggregates/
│   │   │   └── user.aggregate.ts
│   │   ├── valueobjects/
│   │   ├── commands/                   # 12 commands (clases)
│   │   ├── queries/
│   │   └── events/                     # 12 events
│   ├── services/
│   │   ├── user-command.service.ts     # interface + token
│   │   └── user-query.service.ts
│   ├── repositories/
│   │   └── user.repository.ts          # port + USER_REPOSITORY token
│   └── exceptions/                     # 9 rejections como Error subclasses
├── infrastructure/
│   ├── persistence/typeorm/
│   │   ├── entities/user.orm-entity.ts # @Entity schema `iam`
│   │   ├── assemblers/user-persistence.assembler.ts
│   │   └── adapters/user-repository.impl.ts
│   └── auth0/auth0-proof.adapter.ts    # adapter del puerto proof
└── iam.module.ts
```

> Domain layer imports ZERO `@nestjs/*`, `typeorm`, `class-validator`.

---

<a name="domain"></a>

## 2. Domain Layer

### 2.1 Aggregate Root: `User`

**Ubicacion:** `domain/model/aggregates/user.aggregate.ts`

Single aggregate. Session is a standing facet (open/closed, at most one open), outside proof is a linked facet — not separate lifecycles. State machine: `REGISTERED → ACTIVE ↔ SUSPENDED`; session facet `SESSION_CLOSED ↔ SESSION_OPEN` (supersede re-enters OPEN).

```typescript
import { AggregateRoot } from '../../../../shared/domain/model/aggregate-root';
export enum AccessStanding { REGISTERED = 'REGISTERED', ACTIVE = 'ACTIVE', SUSPENDED = 'SUSPENDED' }
export enum SessionStanding { CLOSED = 'SESSION_CLOSED', OPEN = 'SESSION_OPEN' }
export enum SignOutReason { ASKED = 'ASKED', SUPERSEDED = 'SUPERSEDED', PROOF_CHANGED = 'PROOF_CHANGED', SUSPENDED = 'SUSPENDED' }

/** Template+State por composicion: User extiende AggregateRoot e implementa AccessStandable; sin clase base intermedia. */
export interface AccessStandable {
  signIn(kind: ProofKind): void; signOut(): void; changeSecret(): void;
  suspend(reason: string): void; restore(): void;
}

export class User extends AggregateRoot implements AccessStandable {
  private constructor(
    private readonly _id: UserId,
    private readonly _personId: PersonId,
    private _standing: AccessStanding,
    private _session: SessionStanding,
    private _contact: ContactAddress,
    private _roles: SystemRole[],
    private _outsideProver: OutsideProverRef | null,
  ) { super(); }

  /** Creates a brand-new identity. Always REGISTERED; always raises UserSignedUp. */
  static signup(input: { personId: PersonId; contact: ContactAddress }): User {
    const user = new User(UserId.generate(), input.personId,
      AccessStanding.REGISTERED, SessionStanding.CLOSED,
      input.contact, [new SystemRole('PLAIN')], null);
    user.registerEvent(new UserSignedUp(user._id, user._personId, user._contact));
    return user;
  }

  /** Reconstructs a stored identity. No events, no status assumptions. */
  static rehydrate(input: { id: UserId; personId: PersonId; standing: AccessStanding;
    session: SessionStanding; contact: ContactAddress; roles: SystemRole[];
    outsideProver: OutsideProverRef | null }): User {
    return new User(input.id, input.personId, input.standing,
      input.session, input.contact, input.roles, input.outsideProver);
  }

  /** Template: valida origen, muta standing y publica evento. Reusado por suspend/restore. */
  protected applyStandingTransition(from: AccessStanding, to: AccessStanding, event: { eventName: string }): void {
    if (this._standing !== from) throw new IllegalUserStateError(`standing ${this._standing} != ${from}`);
    this._standing = to;
    this.registerEvent(event as never);
  }

  /** Skeleton de cierre de sesion; invocado por signOut/suspend/changeSecret. */
  private tearDownSession(reason: SignOutReason): void {
    if (this._session !== SessionStanding.OPEN) return;
    this._session = SessionStanding.CLOSED;
    this.registerEvent(new UserSignedOut(this._id, this._personId, reason) as never);
  }

  signIn(kind: ProofKind): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._session === SessionStanding.OPEN)
      this.registerEvent(new UserSignedOut(this._id, this._personId, SignOutReason.SUPERSEDED));
    this._session = SessionStanding.OPEN;
    this.registerEvent(new UserSignedIn(this._id, this._personId, kind));
  }

  signOut(): void {
    if (this._session !== SessionStanding.OPEN) throw new NoOpenSessionError('no session');
    this.tearDownSession(SignOutReason.ASKED);
  }

  changeSecret(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    this.tearDownSession(SignOutReason.PROOF_CHANGED);
    this.registerEvent(new SecretChanged(this._id));
  }

  suspend(reason: string): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new IllegalUserStateError('already suspended');
    this.applyStandingTransition(this._standing, AccessStanding.SUSPENDED, new AccessSuspended(this._id, reason));
    this.tearDownSession(SignOutReason.SUSPENDED);
  }

  restore(): void {
    this.applyStandingTransition(AccessStanding.SUSPENDED, AccessStanding.ACTIVE, new AccessRestored(this._id));
  }
  // changeEmail(), verifyEmail(), link/unlinkOutsideIdentity(), grant/revokeSystemRole(), answerAccessStanding() igual forma.
}
export function parseAccessStanding(v: string): AccessStanding { /* explicit parser, never `as` */ }
```

### 2.2 Value Objects

| VO | Shape | Notes |
|:--|:--|:--|
| `UserId` / `PersonId` | `private ctor + of() + generate()` (`usr-` / `per-` prefix) | Never interchangeable; `equals()` by value |
| `ContactAddress` | `{ email, verified }` immutable class | `change()` → new unverified; `verify()` flips standing |
| `SystemRole` | `{ value: STEWARD \| PLAIN }` | Set never leaves system without a steward (invariant 4) |
| `ProofKind` | enum `LOCAL \| OUTSIDE` | Recorded on sign-in fact |
| `OutsideProverRef` | `{ prover: 'auth0' }` class, `of()` validated | At most one linked; Auth0 is the single agreed prover |

```typescript
export class UserId {
  private constructor(public readonly value: string) {}
  static generate(): UserId { return new UserId(`usr-${randomUUID()}`); }
  static of(v: string): UserId { if (!v?.trim()) throw new Error('invalid user id'); return new UserId(v); }
  equals(o: UserId): boolean { return this.value === o.value; }
}
// PersonId identical with `per-` prefix. OutsideProverRef.of() rejects non-auth0.
```

### 2.3 Commands (CQRS — Write)

`domain/model/commands/` — plain classes, self-validating ctor:

`SignUpCommand(personId, contactAddress)`, `SignInCommand(userId, proofKind)`, `SignOutCommand(userId)`, `ChangeSecretCommand`, `ChangeEmailCommand`, `VerifyEmailCommand`, `LinkOutsideIdentityCommand`, `UnlinkOutsideIdentityCommand`, `GrantSystemRoleCommand`, `RevokeSystemRoleCommand`, `SuspendAccessCommand(userId, reason)`, `RestoreAccessCommand`.

### 2.4 Queries (CQRS — Read)

`GetAccessStandingByPersonQuery(personId)`, `GetIdentityHistoryByPersonQuery(personId)`, `GetSystemRolesByPersonQuery(personId)`.

### 2.5 Domain Exceptions (rejections)

`AlreadyRegisteredError`, `ProofNotHeldError`, `SuspendedRefusedError`, `NoOpenSessionError`, `LastProofRefusedError`, `LastStewardRefusedError`, `OutsideProofAlreadyLinkedError`, `AddressAlreadyHeldError`, `RoleAlreadyHeldError/RoleNotHeldError` — all `Error` subclasses with `Object.setPrototypeOf`.

### 2.6 Domain Events (12)

`UserSignedUp`, `UserSignedIn`, `UserSignedOut(reason)`, `SecretChanged`, `EmailChanged`, `EmailVerified`, `OutsideIdentityLinked`, `OutsideIdentityUnlinked`, `SystemRoleGranted`, `SystemRoleRevoked`, `AccessSuspended`, `AccessRestored` — each `implements DomainEvent` with `static eventName`.

### 2.7 Domain Services (ports)

```typescript
export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');
export interface UserCommandService {
  signup(c: SignUpCommand): Promise<UserId>;
  signin(c: SignInCommand): Promise<void>;
  signout(c: SignOutCommand): Promise<void>;
  // ... one method per command
}
export const USER_QUERY_SERVICE = Symbol('USER_QUERY_SERVICE');
export interface UserQueryService {
  getStanding(q: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer>;
  getHistory(q: GetIdentityHistoryByPersonQuery): Promise<UserHistoryEntry[]>;
  getRoles(q: GetSystemRolesByPersonQuery): Promise<SystemRole[]>;
}
```

---

<a name="application"></a>

## 3. Application Layer

### 3.1 Command Services

**Ubicacion:** `application/internal/commandservices/user-command.service.impl.ts`

```typescript
@Injectable()
export class UserCommandServiceImpl implements UserCommandService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(PROOF_VERIFICATION_SERVICE) private readonly proofs: ProofVerificationService,
    private readonly events: EventEmitter2,
  ) {}

  async signin(command: SignInCommand): Promise<void> {
    const user = await this.uow.run(async () => {
      const u = await this.users.findById(command.userId);
      if (!u) throw new UserNotFoundError('not found');
      const holds = await this.proofs.holds(command.userId.value); // executor verdict, observed
      if (!holds) throw new ProofNotHeldError('proof does not hold');
      u.signIn(command.proofKind);
      await this.users.save(u);
      return u;
    });
    this.publish(user); // after commit only — never inside run()
  }
  private publish(u: User): void {
    for (const e of u.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
```

### 3.2 Query Services

Read-only, no `UNIT_OF_WORK`: `getStanding()` → `users.findByPersonId()` + `answerAccessStanding()`; `getHistory()`, `getRoles()` similarly.

### 3.3 Outbound Ports (Strategy)

Puerto `ProofVerification` (Strategy): contrato en `application/internal/outboundservices/proof/proof-verification.service.ts`. El caso de uso observa el veredicto (`holds()`), nunca ejecuta la prueba. `Auth0ProofAdapter` implementa este puerto directamente — no existe servicio intermedio `external-auth0`: `acl/` reserva exclusivamente para `External{Bc}Service` que consumen facades de otros BCs (`external-verification`, `external-notifications`).

```typescript
export const PROOF_VERIFICATION_SERVICE = Symbol('PROOF_VERIFICATION_SERVICE');
export interface ProofVerificationService { holds(userId: string): Promise<boolean>; }
export const SESSION_ARTIFACT_SERVICE = Symbol('SESSION_ARTIFACT_SERVICE');
export interface SessionArtifactService {
  issue(userId: string): Promise<void>; end(userId: string, reason: string): Promise<void>;
}
```

### 3.4 Event Handlers (Observer, solo in-module)

`user-event-logger.ts` — `@OnEvent(...)` vive solo dentro del modulo IAM; ningun BC foraneo suscribe directo. Regla: `publish()` unicamente despues de que `uow.run()` resuelve. Fan-out:

| Evento | Reaccion |
|:--|:--|
| `UserSignedUp` / `SecretChanged` / `EmailChanged` / `AccessSuspended` / `AccessRestored` | facade `ExternalNotificationsService` (welcome/security/suspension) |
| `UserSignedIn` / `UserSignedOut` | `session-artifact` `issue()` / `end(reason)` via ejecutor + standing/history |
| `EmailVerified` / `SystemRoleGranted` / `SystemRoleRevoked` | standing/history (lecturas `answerAccessStanding/getRoles`) |

### 3.5 ACL Facade (application)

`application/acl/iam-context-facade.impl.ts` implements `IamContextFacade`: `answerAccessStanding(personId: string)`, `getSystemRoles(personId: string)` — primitives at the boundary.

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 ORM entity (`iam` schema)

```typescript
@Entity('users', { schema: 'iam' })
export class UserOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column({ unique: true }) personId: string;
  @Column() standing: string;
  @Column() session: string;
  @Column() email: string;
  @Column() emailVerified: boolean;
  @Column('simple-array') roles: string[];
  @Column({ nullable: true }) outsideProver: string | null;
}
```

### 4.2 Assembler

`user-persistence.assembler.ts` — `toDomain()` parses via `UserId.of/PersonId.of/parseAccessStanding` (never `as`); `toOrmEntity()` reads all state off the aggregate.

### 4.3 Adapter with TransactionContext

```typescript
@Injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(@InjectRepository(UserOrmEntity) private readonly orm: Repository<UserOrmEntity>,
    private readonly assembler: UserPersistenceAssembler) {}
  private get repo(): Repository<UserOrmEntity> { return TransactionContext.current ?? this.orm; }
  async findById(id: UserId): Promise<User | null> { /* findOneBy + toDomain */ }
  async save(user: User): Promise<void> { await this.repo.save(this.assembler.toOrmEntity(user)); }
}
```

### 4.4 Auth0 adapter (Strategy real) + Fake para tests

`infrastructure/auth0/auth0-proof.adapter.ts` implementa `ProofVerificationService` (Auth0 verifica, IAM juzga + historiza). Swap en providers con una linea (`useClass: Auth0ProofAdapter` ↔ `FakeProofVerificationService`); en tests `overrideProvider(PROOF_VERIFICATION_SERVICE)`. Session artifact adapter instruye al ejecutor externo ante `UserSignedIn/Out`.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

### 5.1 REST Controller

`@Controller('api/v1/iam/users')`, `@UseFilters(IamExceptionFilter)`, global `ValidationPipe`.

| Method | Endpoint | Command |
|:--|:--|:--|
| `POST` | `/api/v1/iam/users/signup` | `SignUpCommand` |
| `POST` | `/api/v1/iam/users/signin` | `SignInCommand` |
| `POST` | `/api/v1/iam/users/signout` | `SignOutCommand` |
| `PATCH` | `/api/v1/iam/users/email` | `ChangeEmailCommand` |
| `POST` | `/api/v1/iam/users/email/verify` | `VerifyEmailCommand` |
| `POST` | `/api/v1/iam/users/roles` | `GrantSystemRoleCommand` |
| `DELETE` | `/api/v1/iam/users/roles` | `RevokeSystemRoleCommand` |
| `POST` | `/api/v1/iam/users/suspend` | `SuspendAccessCommand` |
| `POST` | `/api/v1/iam/users/restore` | `RestoreAccessCommand` |

### 5.2 Resources + Transform

Resources carry `class-validator` decorators (`SignupUserResource`, `UserResource`). Assemblers: `SignupCommandFromResourceAssembler.toCommand()`, `UserResourceFromEntityAssembler.toResource()`.

### 5.3 ACL

```typescript
export const IAM_CONTEXT_FACADE = Symbol('IAM_CONTEXT_FACADE');
export interface IamContextFacade {
  answerAccessStanding(personId: string): Promise<{ mayAct: boolean; roles: string[]; sessionOpen: boolean }>;
  getSystemRoles(personId: string): Promise<string[]>;
}
```

Primitives-only; consumer `ExternalIamService` translates strings into its own VOs. `iam.module.ts` `exports: [IAM_CONTEXT_FACADE]`.

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Single Postgres, schema-per-BC (locked). Schema `iam`, table `iam.users`:

```sql
CREATE SCHEMA IF NOT EXISTS iam;
CREATE TABLE iam.users (
  id VARCHAR(64) PRIMARY KEY,
  person_id VARCHAR(64) NOT NULL UNIQUE,
  standing VARCHAR(16) NOT NULL,        -- REGISTERED | ACTIVE | SUSPENDED
  session VARCHAR(16) NOT NULL,         -- SESSION_CLOSED | SESSION_OPEN
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  roles TEXT NOT NULL,                  -- simple-array, comma separated
  outside_prover VARCHAR(64) NULL,      -- 'auth0' | NULL
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_standing ON iam.users (standing);
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 SignUp (UC1)

```
POST /api/v1/iam/users/signup { personId, email }
 -> ValidationPipe -> SignupCommandFromResourceAssembler.toCommand()
 -> UserCommandServiceImpl.signup() inside UNIT_OF_WORK.run()
     -> users.findByPersonId() == null else AlreadyRegisteredError
     -> User.signup({ personId, contact }) -> registerEvent(UserSignedUp)
     -> users.save(user)
 -> after commit: emit(UserSignedUp) -> logger + ExternalNotificationsService.welcome()
 -> 201 + UserResource
```

### 7.2 SignIn anchor (UC2)

```
POST /api/v1/iam/users/signin { userId, proofKind }
 -> SignInCommand -> UserCommandServiceImpl.signin() inside UNIT_OF_WORK.run()
     -> findById() else UserNotFoundError
     -> standing ACTIVE? else SuspendedRefusedError
     -> proofs.holds() (Auth0 executor verdict, observed never performed)
     -> user.signIn(kind): supersede -> UserSignedOut(SUPERSEDED)? + UserSignedIn
     -> users.save(user)
  -> after commit: emit both events -> session-artifact.issue() via executor
Concurrency: racing sign-ins serialize; later wins, earlier closes SUPERSEDED.
Fan-out Observer (ver §3.4): publish() solo tras commit; `@OnEvent` in-module; Notifications vs session-artifact/standing segun tabla.
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

- **R9 Verification OTP → IAM (UC6):** `ChallengeConfirmed` observed via in-module `@OnEvent` handler → `ExternalVerificationService` ACL call returns primitives → `VerifyEmailCommand` records `EmailVerified`. The code itself never crosses.
- **R13/R14 IAM → Membership/Community:** `IamContextFacade.answerAccessStanding()` consumed by every gated use case; person identity held by reference only. Suspension here never rewrites membership/community state.
- **IAM → Notifications:** welcome/security/suspension notices via `ExternalNotificationsService` (facade token, primitives).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Direccion | Tipo | Detalle |
|:--|:--|:--|
| IAM → Shared kernel | Legitima | `AggregateRoot`, `DomainEvent`, `UNIT_OF_WORK`, `TransactionContext` |
| IAM → Auth0 | Strategy real | `ProofVerificationService` port → `Auth0ProofAdapter`; tests usan `FakeProofVerificationService` (swap una linea / `overrideProvider`) |
| IAM → Verification BC | ACL consumida | `ExternalVerificationService` → Verification facade (UC6) |
| `IAM_CONTEXT_FACADE` | ACL publicada | Primitives-only, `exports` from `IamModule` |
| Events | `EventEmitter2`, `forRoot()` once in `AppModule` | Publish after `uow.run()` resolves; async handlers need own error handling |

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| D4 | Media | Reference demanded local proof mechanics | Deviation locked: executor-first — Auth0 executes, IAM judges + owns history (foundation-first, Supporting/Low-investment) |
| 1 | Alta | Session modeled as separate aggregate candidate | Kept as facet of `User`; supersede atomic in `signIn()` |
| 2 | Media | Bare-string ids across boundaries | Typed VOs `UserId/PersonId/ContactAddress/SystemRole/OutsideProverRef` everywhere in domain |
| 3 | Media | Risk of publishing before commit | `publish()` strictly after `UNIT_OF_WORK.run()` resolves |
| 4 | Baja | BaseAssembler / Composite candidatos | Rechazados: sin `BaseAssembler` (assemblers dedicados por BC); sin Composite (VO-sets + ID-ref son correctos); skeleton (`applyStandingTransition`/`tearDownSession`) solo aqui por spec |

Decisions locked: single Postgres schema-per-BC (`iam.users`); Auth0 as the one outside prover (`OutsideProverRef`); foundation-first (judgment + history here, execution outside).

Open questions carried: supersede-vs-refuse confirmation; failed-proof threshold + reset-on-success; role catalog beyond STEWARD/PLAIN; notice content channel; per-device presence (parked); multi-prover break-point (parked).
