## VotaChain API — NestJS | DDD | CQRS | Modular Monolith — Community Management

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
src/community/
├── interfaces/
│   ├── rest/
│   │   ├── community.controller.ts
│   │   ├── resources/
│   │   │   ├── register-community.resource.ts
│   │   │   ├── define-policy.resource.ts
│   │   │   └── community.resource.ts
│   │   ├── transform/
│   │   │   ├── register-command-from-resource.assembler.ts
│   │   │   └── community-resource-from-entity.assembler.ts
│   │   └── filters/
│   │       └── community-exception.filter.ts
│   └── acl/
│       └── community-context.facade.ts   # facade + COMMUNITY_CONTEXT_FACADE
├── application/
│   ├── acl/
│   │   └── community-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   └── community-command.service.impl.ts
│       ├── queryservices/
│       │   └── community-query.service.impl.ts
│       ├── eventhandlers/
│       │   └── community-event-logger.ts (exempt logger)
│       └── outboundservices/acl/
│           └── external-iam.service.ts   # person-existence check (UC5)
├── domain/
│   ├── model/
│   │   ├── aggregates/community.aggregate.ts
│   │   ├── valueobjects/
│   │   ├── commands/                     # 9 commands
│   │   ├── queries/
│   │   └── events/                       # 9 events
│   ├── services/
│   │   ├── community-command.service.ts
│   │   └── community-query.service.ts
│   ├── repositories/
│   │   └── community.repository.ts       # port + COMMUNITY_REPOSITORY
│   └── exceptions/
├── infrastructure/persistence/typeorm/
│   ├── entities/community.orm-entity.ts  # @Entity schema `community`
│   ├── assemblers/community-persistence.assembler.ts
│   └── adapters/community-repository.impl.ts
└── community.module.ts
```

> Domain layer imports ZERO `@nestjs/*`, `typeorm`, `class-validator`.

---

<a name="domain"></a>

## 2. Domain Layer

### 2.1 Aggregate Root: `Community`

**Ubicacion:** `domain/model/aggregates/community.aggregate.ts`

Owns settings, voting policy (supersede-chain), administrator list. Never holds the member list. Machine: `REGISTERED → ACTIVE ↔ SUSPENDED`, `ACTIVE|SUSPENDED → ARCHIVED` terminal.

```typescript
import { AggregateRoot } from '../../../../shared/domain/model/aggregate-root';
export const CommunityStanding = { REGISTERED: 'REGISTERED', ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', ARCHIVED: 'ARCHIVED' } as const;
export type CommunityStanding = typeof CommunityStanding[keyof typeof CommunityStanding];
/** CommunityStatus = CommunityStanding (nombre spec); se conserva CommunityStanding en codigo. */
export type CommunityStatus = CommunityStanding;

/** Standing por composicion: Community extiende AggregateRoot e implementa CommunityStandable; sin base intermedia. */
export interface CommunityStandable {
  activate(): void; suspend(reason: string): void; reactivate(): void; archive(reason: string): void;
}

export class Community extends AggregateRoot implements CommunityStandable {
  private constructor(
    private readonly _id: CommunityId,
    private _standing: CommunityStanding,
    private _settings: CommunitySettings,
    private _policy: VotingPolicy | null,
    private _admins: CommunityAdmin[],
  ) { super(); }

  /** Brand-new community. Always REGISTERED; raises CommunityRegisteredEvent. */
  static register(input: { settings: CommunitySettings; admin: CommunityAdmin }): Community {
    const c = new Community(CommunityId.generate(), CommunityStanding.REGISTERED,
      input.settings, null, [input.admin]);
    c.registerEvent(new CommunityRegisteredEvent(c._id, c._settings));
    return c;
  }

  /** Reloads stored state. No events. */
  static rehydrate(input: { id: CommunityId; standing: CommunityStanding;
    settings: CommunitySettings; policy: VotingPolicy | null;
    admins: CommunityAdmin[] }): Community {
    return new Community(input.id, input.standing, input.settings, input.policy, input.admins);
  }

  activate(): void {
    if (this._standing !== CommunityStanding.REGISTERED) throw new IllegalCommunityTransitionError('not registrable');
    if (!this._policy) throw new PolicyUndefinedError('policy required');
    if (this._admins.length < 1) throw new LastAdministratorError('need >=1 admin');
    this.applyStandingTransition(CommunityStanding.REGISTERED, CommunityStanding.ACTIVE, new CommunityActivatedEvent(this._id));
  }

  definePolicy(next: VotingPolicy): void {
    if (this._standing === CommunityStanding.ARCHIVED) throw new ArchivedIsTerminalError('terminal');
    const supersedes = this._policy;
    this._policy = next; // supersede-chain: history kept, past never edited
    this.registerEvent(new VotingPolicyDefinedEvent(this._id, next, supersedes));
  }

  removeAdmin(person: PersonId): void {
    if (this._standing === CommunityStanding.ARCHIVED) throw new ArchivedIsTerminalError('terminal');
    if (!this._admins.some((a) => a.personId.equals(person))) throw new AdminNotHeldError('not admin');
    if (this._standing === CommunityStanding.ACTIVE && this._admins.length === 1)
      throw new LastAdministratorError('last admin while active');
    this._admins = this._admins.filter((a) => !a.personId.equals(person));
    this.registerEvent(new CommunityAdminRemovedEvent(this._id, person));
  }

  /** Template de transicion de standing; skeleton reusado por activate/suspend/reactivate/archive. */
  protected applyStandingTransition(from: CommunityStanding, to: CommunityStanding, event: { eventName: string }): void {
    if (this._standing !== from) throw new IllegalCommunityTransitionError(`standing ${this._standing} != ${from}`);
    this._standing = to;
    this.registerEvent(event as never);
  }

  /** Skeleton: toda mutacion salvo rehydrate exige no-ARCHIVED. */
  protected assertMutable(): void {
    if (this._standing === CommunityStanding.ARCHIVED) throw new ArchivedIsTerminalError('terminal');
  }

  suspend(reason: string): void {
    this.assertMutable();
    this.applyStandingTransition(CommunityStanding.ACTIVE, CommunityStanding.SUSPENDED, new CommunitySuspendedEvent(this._id, reason));
  }

  reactivate(): void {
    this.applyStandingTransition(CommunityStanding.SUSPENDED, CommunityStanding.ACTIVE, new CommunityReactivatedEvent(this._id));
  }

  archive(reason: string): void {
    this.assertMutable();
    if (this._standing !== CommunityStanding.ACTIVE && this._standing !== CommunityStanding.SUSPENDED)
      throw new IllegalCommunityTransitionError('archive only from ACTIVE/SUSPENDED');
    this.applyStandingTransition(this._standing, CommunityStanding.ARCHIVED, new CommunityArchivedEvent(this._id, reason));
  }
  // updateSettings(), appointAdmin(),
  // answerStanding(), answerPolicy() follow same shape (mutadores llaman assertMutable() primero).
}
```

### 2.2 Value Objects

| VO | Shape | Notes |
|:--|:--|:--|
| `CommunityId` | `private ctor + of() + generate()` (`com-` prefix) | `equals()` by value |
| `PersonId` | reference-only id VO | Existence judged in IAM |
| `CommunitySettings` | `{ name, domicile, contact }` immutable | Well-formed = present + distinguishable |
| `VotingPolicy` | `{ threshold, basis, majorityRule, supersedes }` | Each `definePolicy` supersedes; frozen copies elsewhere untouched |
| `QuorumConfig` | `{ threshold, basis }` | Part Voting freezes as `QuorumSnapshot` |
| `CommunityAdmin` | `{ personId, entrustedAt }` | Set never empty while ACTIVE |

### 2.3 Commands

`RegisterCommunityCommand`, `ActivateCommunityCommand`, `UpdateCommunitySettingsCommand`, `DefineVotingPolicyCommand(communityId, threshold, basis, majorityRule)`, `AppointCommunityAdminCommand`, `RemoveCommunityAdminCommand`, `SuspendCommunityCommand(communityId, reason)`, `ReactivateCommunityCommand`, `ArchiveCommunityCommand(communityId, reason)` — plain classes, self-validating.

### 2.4 Queries

`GetCommunityByIdQuery`, `GetVotingPolicyByCommunityQuery`, `GetStandingByCommunityQuery`, `GetAdministratorsByCommunityQuery`.

### 2.5 Domain Exceptions

`CommunityAlreadyExistsError`, `PolicyUndefinedError`, `CommunityNotActiveError`, `LastAdministratorError`, `AdminAlreadyAppointedError/AdminNotHeldError`, `ArchivedIsTerminalError`, `IllegalCommunityTransitionError`, `CommunityNotFoundError` — `Error` subclasses.

### 2.6 Domain Events (9)

`CommunityRegisteredEvent`, `CommunityActivatedEvent`, `CommunitySettingsUpdatedEvent`, `VotingPolicyDefinedEvent(supersedes)`, `CommunityAdminAppointedEvent`, `CommunityAdminRemovedEvent`, `CommunitySuspendedEvent(reason)`, `CommunityReactivatedEvent`, `CommunityArchivedEvent(reason)` — `implements DomainEvent`, `static eventName`.

### 2.7 Domain Services (ports)

```typescript
export const COMMUNITY_COMMAND_SERVICE = Symbol('COMMUNITY_COMMAND_SERVICE');
export interface CommunityCommandService {
  register(c: RegisterCommunityCommand): Promise<CommunityId>;
  activate(c: ActivateCommunityCommand): Promise<void>;
  updateSettings(c: UpdateCommunitySettingsCommand): Promise<void>;
  definePolicy(c: DefineVotingPolicyCommand): Promise<void>;
  appointAdmin(c: AppointCommunityAdminCommand): Promise<void>;
  removeAdmin(c: RemoveCommunityAdminCommand): Promise<void>;
  suspend(c: SuspendCommunityCommand): Promise<void>;
  reactivate(c: ReactivateCommunityCommand): Promise<void>;
  archive(c: ArchiveCommunityCommand): Promise<void>;
}
export const COMMUNITY_QUERY_SERVICE = Symbol('COMMUNITY_QUERY_SERVICE');
export interface CommunityQueryService {
  getById(q: GetCommunityByIdQuery): Promise<Community | null>;
  getPolicy(q: GetVotingPolicyByCommunityQuery): Promise<VotingPolicy>; // throws PolicyUndefinedError when none defined
  getStanding(q: GetStandingByCommunityQuery): Promise<StandingAnswer>;
  getAdmins(q: GetAdministratorsByCommunityQuery): Promise<CommunityAdmin[]>;
}
export const COMMUNITY_REPOSITORY = Symbol('COMMUNITY_REPOSITORY');
export interface CommunityRepository {
  findById(id: CommunityId): Promise<Community | null>;
  findByName(name: string): Promise<Community | null>; // UC1 uniqueness guard (§7.1)
  save(community: Community): Promise<void>;
}
```

---

<a name="application"></a>

## 3. Application Layer

### 3.1 Command Services

```typescript
@Injectable()
export class CommunityCommandServiceImpl implements CommunityCommandService {
  constructor(
    @Inject(COMMUNITY_REPOSITORY) private readonly communities: CommunityRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}

  async definePolicy(command: DefineVotingPolicyCommand): Promise<void> {
    const community = await this.uow.run(async () => {
      const c = await this.communities.findById(command.communityId);
      if (!c) throw new CommunityNotFoundError('not found');
      c.definePolicy(new VotingPolicy(command.threshold, command.basis, command.majorityRule));
      await this.communities.save(c);
      return c;
    });
    for (const e of community.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
```

Racing definitions serialize into a supersede-chain: later wins as current, earlier stays history.

### 3.2 Query Services

Read-only: `getById`, `getPolicy` (throws `PolicyUndefinedError` when none defined), `getStanding` (derives acceptance), `getAdmins`.

### 3.3 Outbound (ACL consumer)

`ExternalIamService` (`outboundservices/acl/`) injects `IAM_CONTEXT_FACADE`, exposes `personExists(personId: string): Promise<boolean>` for UC5 — primitives in, boolean out.

### 3.4 Event Handlers (Observer, solo in-module)

`community-event-logger.ts` (exempt logger) — `@OnEvent(...)` solo dentro del modulo; ningun BC foraneo suscribe directo. `publish()` unicamente despues de `uow.run()`. Fan-out:

| Evento | Reaccion |
|:--|:--|
| `CommunityActivatedEvent` / `CommunitySuspendedEvent` / `CommunityReactivatedEvent` | gates Membership (altas) + Voting (aperturas) via `answerStanding()` |
| `VotingPolicyDefinedEvent(supersedes)` | Voting congela `QuorumSnapshot` en cada apertura (pull, nunca push mid-vote) |
| `CommunityArchivedEvent` | cierre terminal observado via ACL por Membership/Voting/Notifications |

### 3.5 ACL Facade (application)

`community-context-facade.impl.ts` implements `CommunityContextFacade`: `answerPolicy(communityId)`, `answerStanding(communityId)` — primitives at the boundary.

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 ORM entity (`community` schema)

```typescript
@Entity('communities', { schema: 'community' })
export class CommunityOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() standing: string;
  @Column() name: string;
  @Column() domicile: string;
  @Column() contact: string;
  @Column({ type: 'jsonb', nullable: true })
  policy: { threshold: number; basis: string; majorityRule: string } | null;
  @Column('simple-json') admins: { personId: string; entrustedAt: string }[];
}
```

Admins as `simple-json` (small, always loaded with root, never queried per-child); policy queryable fields stay real columns if a finder needs them.

### 4.2 Assembler + Adapter

`community-persistence.assembler.ts` — `toDomain()` via `CommunityId.of/parseCommunityStanding` (never `as`); `toOrmEntity()` reads state off the aggregate. `CommunityRepositoryImpl` uses `TransactionContext.current ?? this.orm` getter; `save()` is translate-and-persist.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

### 5.1 REST Controller

`@Controller('api/v1/communities')`, `@UseFilters(CommunityExceptionFilter)`.

| Method | Endpoint | Command |
|:--|:--|:--|
| `POST` | `/api/v1/communities` | `RegisterCommunityCommand` |
| `POST` | `/api/v1/communities/:id/activate` | `ActivateCommunityCommand` |
| `PATCH` | `/api/v1/communities/:id/settings` | `UpdateCommunitySettingsCommand` |
| `PUT` | `/api/v1/communities/:id/policy` | `DefineVotingPolicyCommand` |
| `POST` | `/api/v1/communities/:id/admins` | `AppointCommunityAdminCommand` |
| `DELETE` | `/api/v1/communities/:id/admins/:personId` | `RemoveCommunityAdminCommand` |
| `POST` | `/api/v1/communities/:id/suspend` | `SuspendCommunityCommand` |
| `POST` | `/api/v1/communities/:id/reactivate` | `ReactivateCommunityCommand` |
| `POST` | `/api/v1/communities/:id/archive` | `ArchiveCommunityCommand` |
| `GET` | `/api/v1/communities/:id` (+ `/policy`, `/standing`, `/admins`) | queries |

### 5.2 Resources + Transform

`class-validator` DTOs (`RegisterCommunityResource`, `DefinePolicyResource`, `CommunityResource`); assemblers `RegisterCommandFromResourceAssembler`, `CommunityResourceFromEntityAssembler`.

### 5.3 ACL

```typescript
export const COMMUNITY_CONTEXT_FACADE = Symbol('COMMUNITY_CONTEXT_FACADE');
export interface CommunityContextFacade {
  answerPolicy(communityId: string): Promise<{ threshold: number; basis: string; majorityRule: string } | null>;
  answerStanding(communityId: string): Promise<{ standing: string; acceptsMembers: boolean; acceptsProposals: boolean }>;
}
```

Primitives-only; Voting/Membership `ExternalCommunityService` translates into their own VOs. `community.module.ts` `exports: [COMMUNITY_CONTEXT_FACADE]`.

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Single Postgres, schema-per-BC (locked). Schema `community`, table `community.communities`:

```sql
CREATE SCHEMA IF NOT EXISTS community;
CREATE TABLE community.communities (
  id VARCHAR(64) PRIMARY KEY,
  standing VARCHAR(16) NOT NULL,   -- REGISTERED | ACTIVE | SUSPENDED | ARCHIVED
  name VARCHAR(255) NOT NULL,
  domicile VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  policy JSONB NULL,               -- { threshold, basis, majorityRule, supersedes }
  admins JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_communities_standing ON community.communities (standing);
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 RegisterCommunity (UC1)

```
POST /api/v1/communities { name, domicile, contact, adminPersonId }
 -> RegisterCommandFromResourceAssembler.toCommand()
 -> CommunityCommandServiceImpl.register() inside UNIT_OF_WORK.run()
     -> findByName? else CommunityAlreadyExistsError
     -> Community.register({ settings, admin }) -> CommunityRegisteredEvent
     -> communities.save()
 -> after commit: emit(CommunityRegisteredEvent) -> 201 + CommunityResource
```

### 7.2 DefineVotingPolicy anchor (UC4)

```
PUT /api/v1/communities/:id/policy { threshold, basis, majorityRule }
 -> DefineVotingPolicyCommand -> definePolicy() inside UNIT_OF_WORK.run()
     -> not ARCHIVED? coherent threshold+basis? else rejection
     -> community.definePolicy(next) -> VotingPolicyDefinedEvent(supersedes)
     -> communities.save()
  -> after commit: emit(VotingPolicyDefinedEvent)
Voting pulls at each opening via answerPolicy [R1]; frozen QuorumSnapshot stays untouched.
Fan-out Observer (ver §3.4): Activated/Suspended/Reactivated → gates Membership+Voting; PolicyDefined → quorum freeze en Voting.
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

- **Out — R1 Voting (OHS `answerPolicy` → Voting):** Voting calls `CommunityContextFacade.answerPolicy()` at each proposal opening and freezes its own `QuorumSnapshot`. Never pushed; never re-read mid-vote.
- **Out — `answerStanding`:** Voting (proposals allowed?) + Membership (registrations allowed?) consume `answerStanding()`. Suspended refuses beginnings; in-flight votes close under frozen rule (default).
- **In — IAM → Community (UC5):** `ExternalIamService` checks person existence via `IAM_CONTEXT_FACADE`; only the reference is stored.
- **Out — lifecycle facts:** Community only emits. Membership, Voting, Notifications observe via *their own* in-module handlers, which pull `answerStanding()`/`answerPolicy()` or react through *their own* `ExternalCommunityService` ACL calls — Community holds no `ExternalMembership/ExternalVotingService` (pull is one-directional).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Direccion | Tipo | Detalle |
|:--|:--|:--|
| Community → Shared kernel | Legitima | `AggregateRoot`, `DomainEvent`, `UNIT_OF_WORK`, `TransactionContext` |
| Community → IAM | ACL consumida | `ExternalIamService` → `IAM_CONTEXT_FACADE` (UC5 only) |
| `COMMUNITY_CONTEXT_FACADE` | ACL publicada (OHS) | Primitives-only `answerPolicy/answerStanding` |
| Events | `EventEmitter2` | Publish after `uow.run()`; `forRoot()` once in `AppModule` |
| Infra | Sin Strategy | Sin Strategy aqui por spec: la evaluacion de policy vive en Voting; Community solo versiona (`definePolicy` supersede-chain) y publica `VotingPolicyDefinedEvent`. No Auth0/OTP/mail; policy math es dominio puro |

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| 1 | Alta | Member list embedded in Community candidate | Rejected: members live only in Membership (H1); Community holds admins only |
| 2 | Media | Policy edit-in-place would rewrite frozen Voting copies | Supersede-chain: `definePolicy` versions history, Voting freezes per opening (H2) |
| 3 | Media | `ARCHIVED` transition left open | Terminal guard on every mutator (`ArchivedIsTerminalError`) |
| 4 | Media | Last-admin removal while ACTIVE | `LastAdministratorError` invariant; ≥1 admin enforced in `activate/removeAdmin` |
| 5 | Baja | Facade typed with consumer VOs candidate | Primitives-only facade; translation in consumer `ExternalCommunityService` |
| 6 | Baja | BaseAssembler / Composite candidatos | Rechazados: sin assembler base (assembler dedicado); sin Composite (admins como VO-set `simple-json` es correcto) |
| V1.0.7 | — | Naming: <Stem>Event + <Stem>EventHandler in *.event-handler.ts; as const sets; ambiguous-only command renames | Applied |

Project override: ALL events carry Event suffix (deviates from skill collision-only rule) for grep-ability; wire eventName strings unchanged.

Decisions locked: single Postgres schema-per-BC (`community.communities`); VotingPolicy supersede-chain with future-openings-only reads; ≥1 admin while ACTIVE.

Open questions carried: who may define policy/suspend (product+legal); suspension vs in-flight votes (product); fixed vs custom role/majority catalog (product); allowed quorum bases (constrains policy shape); dissolved/merged handling (parked, product+legal).
