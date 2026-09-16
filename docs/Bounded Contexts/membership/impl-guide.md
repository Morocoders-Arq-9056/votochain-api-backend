# Membership — Guía de Implementación (NestJS + TypeORM + EventEmitter2)

> BC de soporte. Fuente de negocio: `domain-model.md`, `use-case.md`, `event-storming.md` (v0.1.0). Forma: `docs/References/impl-guide.md` (10 secciones). Idioms: `references/nestjs.md` del skill DDD.

## ÍNDICE

1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [Capa de Dominio](#2-capa-de-dominio)
3. [Capa de Aplicación](#3-capa-de-aplicación)
4. [Capa de Infraestructura](#4-capa-de-infraestructura)
5. [Capa de Interfaces](#5-capa-de-interfaces)
6. [Esquema de Base de Datos](#6-esquema-de-base-de-datos)
7. [Flujos CQRS por Caso de Uso](#7-flujos-cqrs-por-caso-de-uso)
8. [Integración con otros BCs](#8-integración-con-otros-bcs)
9. [Dependencias Externas](#9-dependencias-externas)
10. [Auditoría y Preguntas Abiertas](#10-auditoría-y-preguntas-abiertas)

---

## 1. Estructura del Proyecto

```
src/membership/
├── interfaces/
│   ├── rest/
│   │   ├── membership.controller.ts
│   │   ├── resources/                        # DTOs con class-validator
│   │   │   ├── register-membership.resource.ts
│   │   │   ├── assign-unit.resource.ts
│   │   │   ├── assign-role.resource.ts
│   │   │   ├── membership.resource.ts
│   │   │   └── judge-eligibility.resource.ts
│   │   └── transform/                        # assemblers estáticos
│   │       ├── register-membership-command-from-resource.assembler.ts
│   │       └── membership-resource-from-entity.assembler.ts
│   ├── acl/
│   │   └── membership-context.facade.ts      # interfaz + token (primitivas)
│   └── filters/
│       └── membership-exception.filter.ts
├── application/
│   ├── acl/
│   │   └── membership-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   └── membership-command.service.impl.ts
│       ├── queryservices/
│       │   └── membership-query.service.impl.ts
│       ├── eventhandlers/
│       │   └── eligibility-judged.event-handler.ts # solo dentro del módulo
│       └── outboundservices/
│           ├── eligibility/eligibility-policy.service.ts   # port Strategy judge(status,snapshot)
│           └── acl/
│               ├── external-iam.service.ts
│               ├── external-community.service.ts
│               └── external-voting.service.ts    # EligibilityJudgedEvent → Voting facade (UC10)
├── domain/
│   ├── model/
│   │   ├── aggregates/membership.aggregate.ts
│   │   ├── valueobjects/                     # membership-id, person-id, community-id, unit, community-role, eligibility-snapshot + enums
│   │   ├── commands/                         # 10 commands (ver §2.3)
│   │   ├── queries/                          # 4 queries (ver §2.4)
│   │   └── events/                           # 10 eventos (ver §2.6)
│   ├── services/                             # ports + tokens (command/query)
│   ├── repositories/membership.repository.ts # port + MEMBERSHIP_REPOSITORY
│   └── exceptions/                           # 6 errores de dominio
├── infrastructure/
│   └── persistence/typeorm/
│       ├── entities/membership.orm-entity.ts
│   ├── assemblers/membership-persistence.assembler.ts
│   │   └── adapters/membership-repository.impl.ts
│   └── eligibility/default/default-eligibility-policy.service.ts  # Strategy default (ACTIVE); fake en test/fakes
└── membership.module.ts
```

Regla de dependencias: `interfaces` → `application` → `domain` ← `infrastructure`. Dominio sin imports de `@nestjs/*`, `typeorm` ni `class-validator`.

## 2. Capa de Dominio

### 2.1 Agregado raíz: `Membership` — `MembershipStandable` + `MembershipStatus`

Un agregado = exactamente un par (persona, comunidad). El roster es una pregunta, no un objeto. Solo `ACTIVE` cuenta al roster. `TERMINATED` es terminal. `EligibilitySnapshot` se congela al instante preguntado; cambios posteriores solo afectan juicios futuros.

Contrato de standing (sin esqueleto): `MembershipStandable` declara `activate / markDelinquent / clearDelinquency / suspend / reinstate / terminate`. NO hay clase base ni template-method — los guards difieren demasiado por transición (`REQUESTED→ACTIVE` vs `ACTIVE→DELINQUENT` vs `ACTIVE|DELINQUENT→SUSPENDED` vs `SUSPENDED→ACTIVE`), así que solo se comparte el helper `assertNotTerminated()`. Cada método mantiene su propio guard + evento.

```typescript
// domain/model/aggregates/membership.aggregate.ts — cero imports de framework
export const MembershipStatus = { REQUESTED: 'REQUESTED', ACTIVE: 'ACTIVE', DELINQUENT: 'DELINQUENT', SUSPENDED: 'SUSPENDED', TERMINATED: 'TERMINATED' } as const;
export type MembershipStatus = typeof MembershipStatus[keyof typeof MembershipStatus];
export function parseMembershipStatus(v: string): MembershipStatus {
  if (!(Object.values(MembershipStatus) as string[]).includes(v)) throw new Error(`invalid membership status: ${v}`);
  return v as MembershipStatus;
}

/** Contrato de standing. Sin esqueleto: solo firmas + helper assertNotTerminated(); guards por método. */
export interface MembershipStandable {
  activate(): void;
  markDelinquent(reason: string): void;
  clearDelinquency(): void;
  suspend(reason: string): void;
  reinstate(): void;
  terminate(reason: string): void;
}

export class Membership extends AggregateRoot implements MembershipStandable {
  private constructor(
    private readonly _id: MembershipId,
    private readonly _personId: PersonId,
    private readonly _communityId: CommunityId,
    private _status: MembershipStatus,
    private _role: CommunityRole,
    private _unit: Unit | null,
    private _lastEligibility: EligibilitySnapshot | null,
  ) { super(); }

  static register(p: PersonId, c: CommunityId, unit: Unit | null): Membership {
    const m = new Membership(MembershipId.generate(), p, c, MembershipStatus.REQUESTED, CommunityRole.owner(), unit, null);
    m.registerEvent(new MembershipRegisteredEvent(m._id, p, c));
    return m;
  }
  static rehydrate(i: { id: MembershipId; personId: PersonId; communityId: CommunityId; status: MembershipStatus; role: CommunityRole; unit: Unit | null; lastEligibility: EligibilitySnapshot | null }): Membership {
    return new Membership(i.id, i.personId, i.communityId, i.status, i.role, i.unit, i.lastEligibility);
  }

  activate(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.REQUESTED) throw new IllegalMembershipTransitionError('solo REQUESTED activa');
    this._status = MembershipStatus.ACTIVE;
    this.registerEvent(new MembershipActivatedEvent(this._id, this._personId, this._communityId));
  }
  assignUnit(unit: Unit): void { this.assertNotTerminated(); this._unit = unit; this.registerEvent(new UnitAssignedEvent(this._id, unit)); }
  assignRole(role: CommunityRole): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE) throw new RoleRequiresActiveError('rol exige ACTIVE');
    this._role = role; this.registerEvent(new CommunityRoleAssignedEvent(this._id, role));
  }
  markDelinquent(reason: string): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE) throw new IllegalMembershipTransitionError('mora exige ACTIVE');
    this._status = MembershipStatus.DELINQUENT;
    this.registerEvent(new MemberMarkedDelinquentEvent(this._id, reason));
  }
  clearDelinquency(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.DELINQUENT) throw new IllegalMembershipTransitionError('sin mora que limpiar');
    this._status = MembershipStatus.ACTIVE;
    this.registerEvent(new DelinquencyClearedEvent(this._id));
  }
  suspend(reason: string): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.ACTIVE && this._status !== MembershipStatus.DELINQUENT) throw new IllegalMembershipTransitionError('suspender exige ACTIVE o DELINQUENT');
    this._status = MembershipStatus.SUSPENDED; this.registerEvent(new MembershipSuspendedEvent(this._id, reason));
  }
  reinstate(): void {
    this.assertNotTerminated();
    if (this._status !== MembershipStatus.SUSPENDED) throw new IllegalMembershipTransitionError('reintegrar exige SUSPENDED');
    this._status = MembershipStatus.ACTIVE; this.registerEvent(new MembershipReinstatedEvent(this._id));
  }
  terminate(reason: string): void {
    this.assertNotTerminated();
    this._status = MembershipStatus.TERMINATED; this.registerEvent(new MembershipTerminatedEvent(this._id, reason));
  }
  /** Ancla: siempre responde; congela snapshot; nunca reescribe el pasado.
   *  El veredicto lo juzga la Strategy EligibilityPolicyService (inyectada, ver §4);
   *  aquí solo se congela + registra el hecho. */
  judgeEligibility(policy: EligibilityPolicyService): EligibilitySnapshot {
    const draft = EligibilitySnapshot.now(this._personId, this._communityId, this._status);
    const eligible = policy.judge(this._status, draft);
    const snap = draft.withVerdict(eligible);
    this._lastEligibility = snap;
    this.registerEvent(new EligibilityJudgedEvent(this._personId, this._communityId, snap));
    return snap;
  }
  /** Fábrica fantasma única: ausencia responde NOT_A_MEMBER, nunca 404. Sin persistir.
   * Desviación intencional documentada (Factories deben producir identidades persistibles):
   * el `MembershipId` mintado se descarta —nunca se guarda ni se publica como identidad—;
   * solo el `EligibilitySnapshot` del juicio se consume (`judgeEligibility` hace save solo si found).
   * Alternativa (snapshot huérfano sin agregado) rechazada: el juicio vive en el agregado por spec. */
  static ghost(p: PersonId, c: CommunityId): Membership {
    return new Membership(MembershipId.generate(), p, c, MembershipStatus.REQUESTED, CommunityRole.owner(), null,
      EligibilitySnapshot.now(p, c, MembershipStatus.REQUESTED).withVerdict(false));
  }
  private assertNotTerminated(): void { if (this._status === MembershipStatus.TERMINATED) throw new TerminationIsTerminalError('TERMINATED es terminal'); }
  get id(): MembershipId { return this._id; } get status(): MembershipStatus { return this._status; }
  get personId(): PersonId { return this._personId; } get communityId(): CommunityId { return this._communityId; }
}
```

### 2.2 Value Objects

Identidades con constructor `private` + `of()`/`generate()` + `equals()`; atributos con constructor público validado. `PersonId`/`CommunityId` son solo referencias (la existencia se juzga fuera).

```typescript
export class MembershipId { private constructor(public readonly value: string) {}
  static generate(): MembershipId { return new MembershipId(randomUUID()); }
  static of(v: string): MembershipId { if (!v?.trim()) throw new Error('membership id requerido'); return new MembershipId(v); }
  equals(o: MembershipId): boolean { return this.value === o.value; } }
// PersonId, CommunityId: misma forma. Unit: constructor público (code, communityName?) valida pertenencia a nivel agregado. CommunityRole: kind PRESIDENT|BOARD_MEMBER|OWNER + equals(). EligibilitySnapshot: constructor público (personId, communityId, standingObserved, verdict, reference, judgedAt) con static now(); inmutable; nunca se edita.
```

### 2.3 Commands — `domain/model/commands/`

`RegisterMembershipCommand(personId, communityId, unit?)`, `ActivateMembershipCommand(membershipId)`, `AssignUnitCommand(membershipId, unit)`, `AssignCommunityRoleCommand(membershipId, role)`, `MarkDelinquentCommand(membershipId, reason)`, `ClearDelinquencyCommand(membershipId)`, `SuspendMembershipCommand(membershipId, reason)`, `ReinstateMembershipCommand(membershipId)`, `TerminateMembershipCommand(membershipId, reason)`, `JudgeEligibilityCommand(personId, communityId)`. Clases planas, validan en constructor. UC10 es command (no query) porque produce el hecho congelado `EligibilityJudgedEvent`.

### 2.4 Queries — `domain/model/queries/`

`GetMembershipByIdQuery(membershipId)`, `GetMembershipByPersonAndCommunityQuery(personId, communityId)`, `GetRosterByCommunityQuery(communityId)`, `GetMembershipsByPersonQuery(personId)`. Retornan agregados o `null`; el roster filtra `status === ACTIVE`.

### 2.5 Excepciones — `domain/exceptions/`

`MembershipNotFoundError`, `MembershipAlreadyExistsError`, `CommunityNotAcceptingMembersError`, `RoleRequiresActiveError`, `IllegalMembershipTransitionError`, `TerminationIsTerminalError` — subclases de `Error` con `Object.setPrototypeOf`. `NotEligible` NO es excepción: es veredicto dentro de `EligibilitySnapshot`/`EligibilityJudgedEvent`.

### 2.6 Eventos (10)

`MembershipRegisteredEvent`, `MembershipActivatedEvent`, `UnitAssignedEvent`, `CommunityRoleAssignedEvent`, `MemberMarkedDelinquentEvent`, `DelinquencyClearedEvent`, `MembershipSuspendedEvent`, `MembershipReinstatedEvent`, `MembershipTerminatedEvent` (payload: ids tipados como VO + `reason` donde aplica) y `EligibilityJudgedEvent(personId, communityId, snapshot)` con referencia de snapshot que Voting congela. Todos implementan `DomainEvent` con `static eventName`; nunca `constructor.name`.

## 3. Capa de Aplicación

### 3.1 Puertos — `domain/services/`

```typescript
export const MEMBERSHIP_COMMAND_SERVICE = Symbol('MEMBERSHIP_COMMAND_SERVICE');
// Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query)
export interface MembershipCommandService {
  registerMembership(c: RegisterMembershipCommand): Promise<MembershipId>;
  activateMembership(c: ActivateMembershipCommand): Promise<void>;
  assignUnit(c: AssignUnitCommand): Promise<void>;
  assignCommunityRole(c: AssignCommunityRoleCommand): Promise<void>;
  markDelinquent(c: MarkDelinquentCommand): Promise<void>;
  clearDelinquency(c: ClearDelinquencyCommand): Promise<void>;
  suspendMembership(c: SuspendMembershipCommand): Promise<void>;
  reinstateMembership(c: ReinstateMembershipCommand): Promise<void>;
  terminateMembership(c: TerminateMembershipCommand): Promise<void>;
  judgeEligibility(c: JudgeEligibilityCommand): Promise<EligibilitySnapshot>;
}
export const MEMBERSHIP_QUERY_SERVICE = Symbol('MEMBERSHIP_QUERY_SERVICE');
export interface MembershipQueryService {
  getMembershipById(q: GetMembershipByIdQuery): Promise<Membership | null>;
  getMembershipByPersonAndCommunity(q: GetMembershipByPersonAndCommunityQuery): Promise<Membership | null>;
  getRosterByCommunity(q: GetRosterByCommunityQuery): Promise<Membership[]>;
  getMembershipsByPerson(q: GetMembershipsByPersonQuery): Promise<Membership[]>;
}
```

### 3.2 Command service — UoW + publicar después del commit

```typescript
@Injectable()
export class MembershipCommandServiceImpl implements MembershipCommandService {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY) private readonly repo: MembershipRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    private readonly iam: ExternalIamService,                 // ACL → IAM_CONTEXT_FACADE
    private readonly communities: ExternalCommunityService,  // ACL → COMMUNITY_CONTEXT_FACADE
    @Inject(ELIGIBILITY_POLICY) private readonly policy: EligibilityPolicyService, // Strategy §4
  ) {}
  async registerMembership(c: RegisterMembershipCommand): Promise<MembershipId> {
    // Gates ACL ANTES del run(): el tx solo agrupa statements DB, nunca llamadas a otros BCs
    // (skill nestjs.md pitfalls). El chequeo DB + índice parcial uq_live_pair siguen dentro: la constraint es la autoridad.
    if (!(await this.iam.personExists(c.personId.value))) throw new Error('persona desconocida');
    if (!(await this.communities.acceptsMembers(c.communityId.value))) throw new CommunityNotAcceptingMembersError('comunidad no acepta');
    const m = await this.uow.run(async () => {
      if (await this.repo.findLiveByPersonAndCommunity(c.personId, c.communityId)) throw new MembershipAlreadyExistsError('par ya cubierto');
      const created = Membership.register(c.personId, c.communityId, c.unit ?? null);
      await this.repo.save(created); return created;
    });
    this.publish(m); return m.id;   // run() resolvió ⇒ commit hecho
  }
  async judgeEligibility(c: JudgeEligibilityCommand): Promise<EligibilitySnapshot> {
    // Contrato fantasma único: Membership.ghost() si no hay viva; save solo si found.
    let snap!: EligibilitySnapshot;
    const target = await this.uow.run(async () => {
      const found = await this.repo.findLiveByPersonAndCommunity(c.personId, c.communityId);
      const t = found ?? Membership.ghost(c.personId, c.communityId); // ausencia → NOT_A_MEMBER, no error
      snap = t.judgeEligibility(this.policy);
      if (found) await this.repo.save(t); return t; // fantasma nunca persiste
    });
    this.publish(target); // EligibilityJudgedEvent tras commit (también del fantasma: el juicio ocurrió)
    return snap;
  }
  private publish(m: Membership): void { for (const e of m.pullDomainEvents()) this.events.emit(e.eventName, e); }
}
```

Nota: la unicidad "≤1 viva por par" se sostiene en dos niveles: chequeo `findLiveByPersonAndCommunity` + índice parcial en DDL (§6). `judgeEligibility` nunca lanza `MembershipNotFound`: la ausencia es `NOT_ELIGIBLE/NOT_A_MEMBER`.

### 3.3 Query service

Solo lee vía `MembershipRepository` (`getById`, `findLiveByPersonAndCommunity`, `findActiveByCommunity`, `findLiveByPerson`). Sin transacciones de escritura, sin eventos.

### 3.4 Puertos ACL de salida — `outboundservices/acl/`

`ExternalIamService.personExists(personId: PersonId): Promise<boolean>` (traduce `string` del facade a VO aquí) y `ExternalCommunityService.acceptsMembers(communityId)`. Firmas del facade en primitivas; la traducción a VO es del consumidor. Libros de la asociación (mora) se observan como verdad externa que UC5/UC6 espejan, nunca se inventan.

### 3.5 Event handlers

`EligibilityJudgedEventHandler` con `@OnEvent(EligibilityJudgedEvent.eventName)` vive en ESTE módulo e inyecta `ExternalVotingService` (ACL → facade de Voting) con primitivas (`personId.value`, `communityId.value`, `snapshot.reference`). Ningún otro módulo se suscribe a eventos de Membership (bus único sin aislamiento).

## 4. Capa de Infraestructura

### 4.1 Regla de elegibilidad — Strategy `EligibilityPolicyService`

Puerto en `application/internal/outboundservices/eligibility/eligibility-policy.service.ts` (Strategy, no ACL externa):

```typescript
export const ELIGIBILITY_POLICY = Symbol('ELIGIBILITY_POLICY');
export interface EligibilityPolicyService {
  judge(status: MembershipStatus, snapshot: EligibilitySnapshot): boolean; // default: status === ACTIVE
}
```

Default en `infrastructure/eligibility/default/default-eligibility-policy.service.ts` (`eligible = status === ACTIVE`); fake en `test/fakes/fake-eligibility-policy.service.ts` (veredicto configurable) para unit tests del agregado/servicio. Se inyecta en `MembershipCommandServiceImpl` y se pasa a `target.judgeEligibility(this.policy)` (§3.2). Cambiar la regla no toca el agregado.

### 4.2 Persistencia

ORM entity = forma de persistencia, nunca el agregado. `status` y `role` son columnas reales (los finders filtran sobre ellas, no sobre JSON).

```typescript
@Entity('memberships') @Index(['communityId', 'status']
) export class MembershipOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; @Column() personId: string; @Column() communityId: string;
  @Column() status: string; @Column() role: string; @Column({ nullable: true }) unitCode: string | null;
  @Column({ nullable: true }) lastVerdict: string | null; @Column({ nullable: true }) lastSnapshotRef: string | null;
}
// Assembler: toDomain usa Membership.rehydrate + of()/parseMembershipStatus()/parseRole(); toOrmEntity lee todo del agregado.
// Adapter: repo getter = TransactionContext.current ?? this.orm; findLiveByPersonAndCommunity filtra status != TERMINATED; save traduce y persiste. providers: TypeOrmModule.forFeature([MembershipOrmEntity]), MEMBERSHIP_REPOSITORY → impl, UNIT_OF_WORK → TypeOrmUnitOfWork.
```

## 5. Capa de Interfaces

Controller delgado: resource → assembler → command → servicio (token) → re-leer → resource. Filtro BC con `@UseFilters`.

| Método | Endpoint | Descripción |
|:--|:--|:--|
| `POST` | `/api/v1/memberships` | Registrar (`RegisterMembershipCommand`) → 201 + `Location` |
| `POST` | `/api/v1/memberships/:id/activate` | Activar |
| `PATCH` | `/api/v1/memberships/:id/unit` | Asignar unidad |
| `PATCH` | `/api/v1/memberships/:id/role` | Asignar rol (exige ACTIVE) |
| `POST` | `/api/v1/memberships/:id/mark-delinquent` | Mora |
| `POST` | `/api/v1/memberships/:id/clear-delinquency` | Limpia mora |
| `POST` | `/api/v1/memberships/:id/suspend` | Suspender |
| `POST` | `/api/v1/memberships/:id/reinstate` | Reintegrar |
| `POST` | `/api/v1/memberships/:id/terminate` | Terminar (terminal) |
| `POST` | `/api/v1/memberships/judge-eligibility` | Ancla UC10 → `EligibilityJudgedEvent` + snapshot |
| `GET` | `/api/v1/memberships/:id` | Detalle |
| `GET` | `/api/v1/memberships?communityId=&status=ACTIVE` | Roster (solo ACTIVE) |
| `GET` | `/api/v1/memberships?personId=` | Membresías de la persona |

ACL publicada (`interfaces/acl/membership-context.facade.ts`, primitivas):

```typescript
export const MEMBERSHIP_CONTEXT_FACADE = Symbol('MEMBERSHIP_CONTEXT_FACADE');
export interface MembershipContextFacade {
  judgeEligibility(personId: string, communityId: string): Promise<{ eligible: boolean; reason: string; snapshotRef: string }>;
  getRoster(communityId: string): Promise<string[]>; // personIds ACTIVE
}
```

`membership.module.ts` `exports: [MEMBERSHIP_CONTEXT_FACADE]`.

Resources con `class-validator`; assemblers estáticos (`XxxCommandFromResourceAssembler`, `MembershipResourceFromEntityAssembler`). `MembershipExceptionFilter` mapea los 6 errores (`NotFound` → 404, transiciones/rol/terminal → 409, comunidad cerrada → 422).

## 6. Esquema de Base de Datos

Schema `membership`, tabla `memberships`:

```sql
CREATE SCHEMA IF NOT EXISTS membership;
CREATE TABLE membership.memberships (
  id VARCHAR(36) PRIMARY KEY,
  person_id VARCHAR(36) NOT NULL,
  community_id VARCHAR(36) NOT NULL,
  status VARCHAR(12) NOT NULL,            -- REQUESTED|ACTIVE|DELINQUENT|SUSPENDED|TERMINATED
  role VARCHAR(16) NOT NULL DEFAULT 'OWNER',
  unit_code VARCHAR(32) NULL,
  last_verdict VARCHAR(16) NULL,          -- ELIGIBLE|NOT_ELIGIBLE
  last_snapshot_ref VARCHAR(64) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_live_pair ON membership.memberships (person_id, community_id)
  WHERE status <> 'TERMINATED';           -- ≤1 viva por par
CREATE INDEX ix_roster ON membership.memberships (community_id, status) WHERE status = 'ACTIVE';
```

## 7. Flujos CQRS por Caso de Uso

**UC1 Registrar:** `POST /memberships` → `RegisterMembershipCommand` → `ExternalIamService.personExists` + `ExternalCommunityService.acceptsMembers` → `findLiveByPersonAndCommunity` (409 si vive) → `Membership.register()` → `save` (UoW) → publicar `MembershipRegisteredEvent` tras commit → 201 + re-leer detalle.
**UC2–UC9:** cargar por id (404) → método del agregado (rechazos §2.5) → `save` → publicar tras commit. `assignUnit/assignCommunityRole` no tocan el historial de standing (invariante 5).
**UC10 Juzgar (ancla):** `POST /judge-eligibility(personId, communityId)` → `findLiveByPersonAndCommunity` → `judgeEligibility(policy)` (ausencia = fantasma `ghost()`, nunca 404; save solo si found) → publicar `EligibilityJudgedEvent` tras commit → **Voting** consume el hecho + pull `judgeEligibility()` para la puerta de autorización → responder `{ eligible, reason, snapshotRef }`. Juzgar dos veces seguidas produce dos snapshots (correcto: cada uno responde "¿elegible ahora?").
**Standing → roster/aviso:** `MembershipActivatedEvent / MembershipSuspendedEvent` (+ mora/reintegro) se publican como eventos y los consumidores hacen pull del roster (`getRosterByCommunity`, solo ACTIVE) o emiten aviso vía Notifications; el agregado nunca empuja el roster.

## 8. Integración con otros BCs

- **R2 → Voting (OHS + ACL):** `EligibilityJudgedEvent` + `getRosterByCommunity` alimentan puerta de autorización y base de participación. Voting congela copia del snapshot; cambios posteriores no reescriben grants (H3).
- **R8 → Document OCR:** precondición de pertenencia; OCR rechaza con `NoEligibleMembership` cuando la persona no pertenece en ningún lado. OCR nunca juzga elegibilidad.
- **R13 (avisos/standing):** `MemberMarkedDelinquentEvent`, `MembershipSuspendedEvent`, `MembershipReinstatedEvent`, … los consume Notifications vía su propio handler interno (pull del hecho + aviso); el roster se recalcula (solo ACTIVE). Ningún módulo externo se suscribe al bus de Membership.
- Consumidas: IAM (existencia, UC1), Community (acepta/standing, UC1–UC2), libros (UC5–UC6, verdad observada), Consent (may-process + revocaciones, coordinación).

## 9. Dependencias Externas

| Dirección | Tipo | Detalle |
|:--|:--|:--|
| Membership → Shared Kernel | Legítima | `AggregateRoot`, `DomainEvent`, `IUnitOfWork`/`UNIT_OF_WORK`, `AuditableOrmEntity` |
| Membership → IAM / Community | ACL consumida (sync, in-process) | `ExternalIamService`/`ExternalCommunityService` → facades con primitivas |
| Membership → Voting/OCR/Notifications | ACL publicada / eventos | `MembershipContextFacade` + `EligibilityJudgedEvent` (handler interno llama al facade de Voting) |
| `EventEmitterModule.forRoot()` | Una sola vez en `AppModule` | Módulos consumen `EventEmitter2`; sin bus CQRS externo (`@nestjs/cqrs` no se usa) |

## 10. Auditoría y Preguntas Abiertas

Decisiones: roster como query (no embebido, H1) — por eso **sin Composite** (el roster no es un objeto-parte, es `findActiveByCommunity`); snapshots nunca reescritos (H3); membresía sigue a la persona, unidad es atributo (H4); autoridad disciplinaria en Community Management, aquí solo `reason` (H5); `judge` como command por el hecho congelado; HMAC/secretos no aplican (sin códigos aquí); `TERMINATED` exige índice parcial + chequeo. **Sin assembler base**: cada assembler de persistencia/interfaces es estático y específico (`MembershipPersistenceAssembler`, `XxxCommandFromResourceAssembler`); heredarlos acoplaría shapes distintos.
Abiertas (de `domain-model.md`): inmediatez de mora (#1), venta de unidad (#2), quién suspende/termina (#3), frescura del roster (#4), catálogo de roles (#5), notificación de exclusión (#6).

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| V1.0.7 | — | Naming: <Stem>Event + <Stem>EventHandler in *.event-handler.ts; as const sets; ambiguous-only command renames | Applied |

Project override: ALL events carry Event suffix (deviates from skill collision-only rule) for grep-ability; wire eventName strings unchanged.

## Testing (skill §Testing each layer)

- **domain** (plain unit): `register()` → `activate`/`suspend`/`reinstate`/`terminate` (terminal); `judgeEligibility(policy)` congela snapshot + emite; ghost responde `NOT_A_MEMBER` sin persistir.
- **application**: mocks de repo + `ExternalIamService`/`ExternalCommunityService` + `ELIGIBILITY_POLICY` (Fake veredicto configurable), o `overrideProvider(...)`.
- **infrastructure**: Testcontainers Postgres — `uq_live_pair` parcial, `ix_roster`, round-trip + parsers corruptos.
- **interfaces**: supertest (`POST memberships → 201; duplicado vivo → 409; POST judge-eligibility`).
