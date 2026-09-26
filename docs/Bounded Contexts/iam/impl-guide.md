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
  │   │   │   ├── sign-in.resource.ts
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
│       │   └── user-event-logger.ts    # @OnEvent internos, solo log (exempt logger)
│       └── outboundservices/
│           ├── proof/
│           │   └── proof-verification.service.ts        # port + token
│           ├── session/
│           │   └── session-artifact.service.ts          # port + token
│           └── acl/
│               └── external-notifications.service.ts    # consume Notifications facade (avisos)
│                   # R9: IAM no consume Verification — Verification consume IAM (markVerified); sin external-verification aquí
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
export const AccessStanding = { REGISTERED: 'REGISTERED', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;
export type AccessStanding = typeof AccessStanding[keyof typeof AccessStanding];
export const SessionStanding = { CLOSED: 'SESSION_CLOSED', OPEN: 'SESSION_OPEN' } as const;
export type SessionStanding = typeof SessionStanding[keyof typeof SessionStanding];
export const SignOutReason = { ASKED: 'ASKED', SUPERSEDED: 'SUPERSEDED', PROOF_CHANGED: 'PROOF_CHANGED', SUSPENDED: 'SUSPENDED' } as const;
export type SignOutReason = typeof SignOutReason[keyof typeof SignOutReason];

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

  /** Creates a brand-new identity. Mints UserId + PersonId. Always REGISTERED; always raises UserSignedUpEvent. */
  static signup(input: { contact: ContactAddress }): User {
    const user = new User(UserId.generate(), PersonId.generate(),
      AccessStanding.REGISTERED, SessionStanding.CLOSED,
      input.contact, [SystemRole.USER], null);
    user.registerEvent(new UserSignedUpEvent(user._id, user._personId, user._contact));
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
    this.registerEvent(new UserSignedOutEvent(this._id, this._personId, reason) as never);
  }

  signIn(kind: ProofKind): void {
    if (this._standing !== AccessStanding.ACTIVE) throw new SuspendedRefusedError('not active');
    if (this._session === SessionStanding.OPEN)
      this.registerEvent(new UserSignedOutEvent(this._id, this._personId, SignOutReason.SUPERSEDED));
    this._session = SessionStanding.OPEN;
    this.registerEvent(new UserSignedInEvent(this._id, this._personId, kind));
  }

  signOut(): void {
    if (this._session !== SessionStanding.OPEN) throw new NoOpenSessionError('no session');
    this.tearDownSession(SignOutReason.ASKED);
  }

  changeSecret(): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new SuspendedRefusedError('suspended');
    this.tearDownSession(SignOutReason.PROOF_CHANGED);
    this.registerEvent(new SecretChangedEvent(this._id));
  }

  suspend(reason: string): void {
    if (this._standing === AccessStanding.SUSPENDED) throw new IllegalUserStateError('already suspended');
    this.applyStandingTransition(this._standing, AccessStanding.SUSPENDED, new AccessSuspendedEvent(this._id, reason));
    this.tearDownSession(SignOutReason.SUSPENDED);
  }

  restore(): void {
    this.applyStandingTransition(AccessStanding.SUSPENDED, AccessStanding.ACTIVE, new AccessRestoredEvent(this._id));
  }
  // changeEmail(), verifyEmail(), link/unlinkOutsideIdentity(), grant/revokeSystemRole(), answerAccessStanding() igual forma.
}
```

Parsers (`Object.values()` guard, never bare `as` on untrusted input):

```typescript
export function parseAccessStanding(v: string): AccessStanding {
  if (!(Object.values(AccessStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as AccessStanding;
}
export function parseSessionStanding(v: string): SessionStanding {
  if (!(Object.values(SessionStanding) as string[]).includes(v)) throw new Error(`invalid session: ${v}`);
  return v as SessionStanding;
}
export function parseSignOutReason(v: string): SignOutReason {
  if (!(Object.values(SignOutReason) as string[]).includes(v)) throw new Error(`invalid sign-out reason: ${v}`);
  return v as SignOutReason;
}
export function parseSystemRole(v: string): SystemRole {
  if (!(Object.values(SystemRole) as string[]).includes(v)) throw new Error(`invalid system role: ${v}`);
  return v as SystemRole;
}
export function parseProofKind(v: string): ProofKind {
  if (!(Object.values(ProofKind) as string[]).includes(v)) throw new Error(`invalid proof kind: ${v}`);
  return v as ProofKind;
}
```

### 2.2 Value Objects

| VO | Shape | Notes |
|:--|:--|:--|
| `UserId` / `PersonId` | `private ctor + of() + generate()` (`usr-` / `per-` prefix) | Never interchangeable; `equals()` by value |
| `ContactAddress` | `{ email, verified }` immutable class | `change()` → new unverified; `verify()` flips standing |
| `SystemRole` | `ADMIN \| USER` (`as const` union, member access `SystemRole.USER`) | Set never leaves system without a admin (invariant 4) |
| `ProofKind` | `LOCAL \| OUTSIDE` (`as const` union, member access `ProofKind.LOCAL`) | Recorded on sign-in fact |
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

`SignUpCommand(contactAddress)` (IDs minteados en `User.signup()` factory: `UserId.generate() + PersonId.generate()`), `SignInCommand(userId, proofKind)`, `SignOutCommand(userId)`, `ChangeSecretCommand`, `ChangeEmailCommand`, `VerifyEmailCommand`, `LinkOutsideIdentityCommand`, `UnlinkOutsideIdentityCommand`, `GrantSystemRoleCommand`, `RevokeSystemRoleCommand`, `SuspendAccessCommand(userId, reason)`, `RestoreAccessCommand`.

### 2.4 Queries (CQRS — Read)

`GetUserByIdQuery(userId)`, `GetAccessStandingByPersonQuery(personId)`, `GetIdentityHistoryByPersonQuery(personId)`, `GetSystemRolesByPersonQuery(personId)`.

### 2.5 Domain Exceptions (rejections)

`AlreadyRegisteredError`, `ProofNotHeldError`, `SuspendedRefusedError`, `NoOpenSessionError`, `LastProofRefusedError`, `LastAdminRefusedError`, `OutsideProofAlreadyLinkedError`, `AddressAlreadyHeldError`, `RoleAlreadyHeldError/RoleNotHeldError`, `IllegalUserStateError` (standing/session transitions), `UserNotFoundError` (read/update on unknown id) — all `Error` subclasses with `Object.setPrototypeOf`. `IamExceptionFilter` (`interfaces/rest/filters/`, `@UseFilters` on controller) mapea las 11: `UserNotFound → 404`, resto de guards → `409`/`422` según §5 (skill: sin excepción sin entrada `@Catch`).

### 2.6 Domain Events (12)

`UserSignedUpEvent`, `UserSignedInEvent`, `UserSignedOutEvent(reason)`, `SecretChangedEvent`, `EmailChangedEvent`, `EmailVerifiedEvent`, `OutsideIdentityLinkedEvent`, `OutsideIdentityUnlinkedEvent`, `SystemRoleGrantedEvent`, `SystemRoleRevokedEvent`, `AccessSuspendedEvent`, `AccessRestoredEvent` — each `implements DomainEvent` with `static eventName`.

### 2.7 Domain Services (ports)

> **Regla de nombrado (skill ddd-guideliness v1.0.11):** un método por comando/query, `methodName = lowerCamel(ClassName sin sufijo Command|Query)`, que recibe el objeto comando/query — nunca primitivas sueltas ni `handle` sobrecargado.

```typescript
export const USER_COMMAND_SERVICE = Symbol('USER_COMMAND_SERVICE');
export interface UserCommandService {
  signUp(c: SignUpCommand): Promise<UserId>;
  signIn(c: SignInCommand): Promise<void>;
  signOut(c: SignOutCommand): Promise<void>;
  changeSecret(c: ChangeSecretCommand): Promise<void>;
  changeEmail(c: ChangeEmailCommand): Promise<void>;
  verifyEmail(c: VerifyEmailCommand): Promise<void>;
  linkOutsideIdentity(c: LinkOutsideIdentityCommand): Promise<void>;
  unlinkOutsideIdentity(c: UnlinkOutsideIdentityCommand): Promise<void>;
  grantSystemRole(c: GrantSystemRoleCommand): Promise<void>;
  revokeSystemRole(c: RevokeSystemRoleCommand): Promise<void>;
  suspendAccess(c: SuspendAccessCommand): Promise<void>;
  restoreAccess(c: RestoreAccessCommand): Promise<void>;
}
export const USER_QUERY_SERVICE = Symbol('USER_QUERY_SERVICE');
export interface UserQueryService {
  getUserById(q: GetUserByIdQuery): Promise<User | null>;
  getAccessStandingByPerson(q: GetAccessStandingByPersonQuery): Promise<AccessStandingAnswer | null>;
  getIdentityHistoryByPerson(q: GetIdentityHistoryByPersonQuery): Promise<UserHistoryEntry[]>;
  getSystemRolesByPerson(q: GetSystemRolesByPersonQuery): Promise<SystemRole[]>;
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

  async signIn(command: SignInCommand): Promise<void> {
    // Gates externos ANTES del run(): el tx solo agrupa statements DB, nunca I/O de red
    // (skill nestjs.md pitfalls: la transacción no debe abarcar llamadas externas).
    const holds = await this.proofs.holds(command.userId.value); // executor verdict, observed
    if (!holds) throw new ProofNotHeldError('proof does not hold');
    const user = await this.uow.run(async () => {
      const u = await this.users.findById(command.userId);
      if (!u) throw new UserNotFoundError('not found');
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

Read-only, no `UNIT_OF_WORK`: `getUserById()` → `users.findById()`; `getAccessStandingByPerson()` → `users.findByPersonId()` + `answerAccessStanding()`; `getIdentityHistoryByPerson()`, `getSystemRolesByPerson()` similarly.

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
| `UserSignedUpEvent` / `SecretChangedEvent` / `EmailChangedEvent` / `AccessSuspendedEvent` / `AccessRestoredEvent` | facade `ExternalNotificationsService` (welcome/security/suspension) |
| `UserSignedInEvent` / `UserSignedOutEvent` | `session-artifact` `issue()` / `end(reason)` via ejecutor + standing/history |
| `EmailVerifiedEvent` / `SystemRoleGrantedEvent` / `SystemRoleRevokedEvent` | standing/history (lecturas `answerAccessStanding/getSystemRolesByPerson`) |

### 3.5 ACL Facade (application)

`application/acl/iam-context-facade.impl.ts` implements `IamContextFacade`: `answerAccessStanding(personId: string)`, `getSystemRoles(personId: string)`, `markVerified(personId: string)` (R9 reception → dispatches `VerifyEmailCommand` to `verifyEmail()`) — primitives at the boundary.

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
  // Skill v1.0.9: TransactionContext.current es EntityManager, no Repository — se traduce vía getRepository (nunca `?? this.orm`, que es EntityManager | Repository | null y falla en strict:true).
  private get repo(): Repository<UserOrmEntity> {
    const manager = TransactionContext.current;
    return manager ? manager.getRepository(UserOrmEntity) : this.orm;
  }
  async findById(id: UserId): Promise<User | null> { /* findOneBy + toDomain */ }
  async save(user: User): Promise<void> { await this.repo.save(this.assembler.toOrmEntity(user)); }
}
```

### 4.4 Auth0 adapter (Strategy real) + Fake para tests

`infrastructure/auth0/auth0-proof.adapter.ts` implementa `ProofVerificationService` (Auth0 verifica, IAM juzga + historiza). Swap en providers con una linea (`useClass: Auth0ProofAdapter` ↔ `FakeProofVerificationService`); en tests `overrideProvider(PROOF_VERIFICATION_SERVICE)`. Session artifact adapter instruye al ejecutor externo ante `UserSignedInEvent/Out`.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

### 5.1 REST Controller

`@Controller('iam/users')` (global `api/v1` prefix), `@UseFilters(IamExceptionFilter)`, global `ValidationPipe`.

| Method | Endpoint | Command |
|:--|:--|:--|
| `POST` | `/api/v1/iam/users` | `SignUpCommand` → 201 + `Location` |
| `GET` | `/api/v1/iam/users/:id` | `GetUserByIdQuery` |
| `POST` | `/api/v1/iam/users/:id/sessions` | `SignInCommand` → 201 + `Location` |
| `DELETE` | `/api/v1/iam/users/:id/sessions/current` | `SignOutCommand` → 204 |
| `PATCH` | `/api/v1/iam/users/:id/secret` | `ChangeSecretCommand` |
| `PATCH` | `/api/v1/iam/users/:id/email` | `ChangeEmailCommand` |
| `POST` | `/api/v1/iam/users/:id/email/verifications` | `VerifyEmailCommand` → 201 |
| `POST` | `/api/v1/iam/users/:id/outside-identities` | `LinkOutsideIdentityCommand` → 201 + `Location` |
| `DELETE` | `/api/v1/iam/users/:id/outside-identities/:provider` | `UnlinkOutsideIdentityCommand` → 204 |
| `POST` | `/api/v1/iam/users/:id/roles` | `GrantSystemRoleCommand` → 201 + `Location` |
| `DELETE` | `/api/v1/iam/users/:id/roles/:role` | `RevokeSystemRoleCommand` → 204 |
| `PATCH` | `/api/v1/iam/users/:id/standing` | `SuspendAccessCommand` / `RestoreAccessCommand` |

### 5.2 Resources + Transform

Resources carry `class-validator` decorators (`SignupUserResource`, `UserResource`). Assemblers: `SignupCommandFromResourceAssembler.toCommand()`, `UserResourceFromEntityAssembler.toResource()`.

`IamExceptionFilter` (`interfaces/rest/filters/iam-exception.filter.ts`, `@UseFilters` on the controller) maps domain rejections — no exception without a `@Catch` entry:

| Domain error | HTTP |
|:--|:--|
| `UserNotFoundError` | 404 Not Found |
| `IllegalUserStateError` | 422 Unprocessable Entity |
| `AddressAlreadyHeldError`, `AlreadyRegisteredError`, `ProofNotHeldError`, `SuspendedRefusedError`, `NoOpenSessionError`, `LastProofRefusedError`, `LastAdminRefusedError`, `OutsideProofAlreadyLinkedError`, `RoleAlreadyHeldError`, `RoleNotHeldError` | 409 Conflict |

### 5.3 ACL

```typescript
export const IAM_CONTEXT_FACADE = Symbol('IAM_CONTEXT_FACADE');
export interface IamContextFacade {
  answerAccessStanding(personId: string): Promise<{ mayAct: boolean; roles: string[]; sessionOpen: boolean }>;
  getSystemRoles(personId: string): Promise<string[]>;
  markVerified(personId: string): Promise<void>; // R9: Verification's handler calls here; impl dispatches VerifyEmailCommand
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
POST /api/v1/iam/users { email }
 -> ValidationPipe -> SignupCommandFromResourceAssembler.toCommand() (mapea email -> ContactAddress, sin generar IDs)
 -> UserCommandServiceImpl.signUp() inside UNIT_OF_WORK.run()
     -> users.findByEmail() != null else AddressAlreadyHeldError
     -> User.signup({ contact }) (factory mintea UserId + PersonId) -> registerEvent(UserSignedUpEvent)
     -> users.save(user)
 -> after commit: emit(UserSignedUpEvent) -> logger + ExternalNotificationsService.welcome()
 -> 201 + UserResource
```

### 7.2 SignIn anchor (UC2)

```
POST /api/v1/iam/users/:id/sessions { proofKind }
 -> SignInCommand -> UserCommandServiceImpl.signIn()
     -> proofs.holds() BEFORE run() (Auth0 executor verdict, observed never performed; red fuera del tx)
     -> inside UNIT_OF_WORK.run(): findById() else UserNotFoundError
     -> standing ACTIVE? else SuspendedRefusedError
     -> user.signIn(kind): supersede -> UserSignedOutEvent(SUPERSEDED)? + UserSignedInEvent
     -> users.save(user)
  -> after commit: emit both events -> session-artifact.issue() via executor
Concurrency: racing sign-ins serialize; later wins, earlier closes SUPERSEDED.
Fan-out Observer (ver §3.4): publish() solo tras commit; `@OnEvent` in-module; Notifications vs session-artifact/standing segun tabla.
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

- **R9 Verification OTP → IAM (UC6):** Verification's own `ChallengeConfirmedEventHandler` (in-module, Verification side) calls `IamContextFacade.markVerified(personId)` — primitives at the boundary. IAM never subscribes to Verification's event (skill: `@OnEvent` handlers live only in the emitting module). Reception: facade → `VerifyEmailCommand` → `verifyEmail()` records `EmailVerifiedEvent`. The code itself never crosses.
- **R13/R14 IAM → Membership/Community:** `IamContextFacade.answerAccessStanding()` consumed by every gated use case; person identity held by reference only. Suspension here never rewrites membership/community state.
- **IAM → Notifications:** welcome/security/suspension notices via `ExternalNotificationsService` (facade token, primitives).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Direccion | Tipo | Detalle |
|:--|:--|:--|
| IAM → Shared kernel | Legitima | `AggregateRoot`, `DomainEvent`, `UNIT_OF_WORK`, `TransactionContext`, `PersonId` (explicit kernel, context-mapping §Shared Kernel) |
| IAM → Auth0 | Strategy real | `ProofVerificationService` port → `Auth0ProofAdapter`; tests usan `FakeProofVerificationService` (swap una linea / `overrideProvider`) |
| Verification → IAM BC | ACL publicada (R9) | Verification consume `IAM_CONTEXT_FACADE.markVerified` (UC6); IAM no importa modelo de Verification |
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
| 4 | Baja | BaseAssembler / Composite candidatos | Rechazados: sin `BaseAssembler` (assemblers dedicados por BC); sin Composite (VO-sets + ID-ref son correctos); guards compartidos (`applyStandingTransition`/`tearDownSession`) solo aqui por spec — nota: NO es Template Method del catálogo (sin familia de subtipos con hooks; si aparece una segunda variante se extrae Strategy) |
| V1.0.7 | — | Naming: <Stem>Event + <Stem>EventHandler in *.event-handler.ts; as const sets; ambiguous-only command renames | Applied |
| V1.0.11 | Alta | Skill exige métodos derivados + sin `handle` + gates fuera del `run()` | `signUp/signIn/...`, `getUserById/getAccessStandingByPerson/...`; `proofs.holds()` antes del `run()`; R9 movido a Verification (`markVerified` en facade) |
| V1.0.11 | Alta | `IamExceptionFilter` declarado en docs pero `src/iam/interfaces/rest/filters/` vacío y sin `@UseFilters` en código (drift docs-vs-código) | Pendiente código: crear `iam-exception.filter.ts` con `@Catch` de las 11 y cablear `@UseFilters(IamExceptionFilter)` |

Project override: ALL events carry Event suffix (deviates from skill collision-only rule) for grep-ability; wire eventName strings unchanged.

Decisions locked: single Postgres schema-per-BC (`iam.users`); Auth0 as the one outside prover (`OutsideProverRef`); foundation-first (judgment + history here, execution outside).

Open questions carried: supersede-vs-refuse confirmation; failed-proof threshold + reset-on-success; role catalog beyond ADMIN/USER; notice content channel; per-device presence (parked); multi-prover break-point (parked).

## 11. Testing (skill §Testing each layer)

- **domain** (plain unit, sin `Test.createTestingModule`): `User.signup()` → `signIn` (2º supersede `SUPERSEDED`) → `signOut` → `suspend` (cierra sesión) → `restore`; `cancel`-like guards (`NoOpenSessionError`, `LastAdminRefusedError`); eventos drenados vía `pullDomainEvents()`.
- **application**: mocks a mano de `UserRepository`/`ProofVerificationService`, o `overrideProvider(USER_REPOSITORY)` / `overrideProvider(PROOF_VERIFICATION_SERVICE)` (Fake sigue como double de test).
- **infrastructure**: Testcontainers Postgres real — round-trip `iam.users`, `parseAccessStanding()` con fila corrupta (lanza, nunca `as`), `findByEmail` único.
- **interfaces**: supertest (`POST users → POST :id/sessions → DELETE :id/sessions/current → PATCH :id/standing`) o controller con tokens mockeados.
