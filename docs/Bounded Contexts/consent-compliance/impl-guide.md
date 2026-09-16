# Consent & Compliance — Guía de Implementación (NestJS + TypeORM + EventEmitter2)

> Supporting Subdomain. Records consent and coordinates erasure. Never owns other contexts' personal data.

## ÍNDICE

1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [Domain Layer](#2-domain-layer)
3. [Application Layer](#3-application-layer)
4. [Infrastructure Layer](#4-infrastructure-layer)
5. [Interfaces Layer](#5-interfaces-layer)
6. [Esquema de Base de Datos](#6-esquema-de-base-de-datos)
7. [Flujos CQRS por Caso de Uso](#7-flujos-cqrs-por-caso-de-uso)
8. [Integración con otros BCs](#8-integración-con-otros-bcs)
9. [Dependencias Externas](#9-dependencias-externas)
10. [Auditoría y Correcciones Aplicadas](#10-auditoría-y-correcciones-aplicadas)

---

<a name="1-estructura-del-proyecto"></a>

## 1. Estructura del Proyecto

```
src/consent-compliance/
├── interfaces/
│   ├── rest/
│   │   ├── consent.controller.ts
│   │   ├── erasure-request.controller.ts
│   │   ├── retention-policy.controller.ts
│   │   ├── resources/                 # grant/revoke/submit/define/state resources
│   │   └── transform/                 # command-from-resource + resource-from-entity
│   ├── acl/
│   │   └── consent-context.facade.ts        # CONSENT_CONTEXT_FACADE + interface
│   └── filters/
│       └── consent-exception.filter.ts
├── application/
│   ├── acl/
│   │   └── consent-context.facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   ├── consent-command.service.impl.ts
│       │   ├── erasure-command.service.impl.ts
│       │   └── retention-command.service.impl.ts
│       ├── queryservices/
│       │   └── consent-query.service.impl.ts
│       ├── eventhandlers/
│       │   ├── erasure-confirmed.event-handler.ts
│       │   └── revocation-confirmed.event-handler.ts
│       └── outboundservices/acl/
│           ├── external-iam.service.ts
│           ├── external-biometric.service.ts   # → BIOMETRIC_CONTEXT_FACADE
│           ├── external-wallet.service.ts      # → WALLET_CONTEXT_FACADE
│           ├── external-membership.service.ts  # → MEMBERSHIP_CONTEXT_FACADE
│           └── external-notifications.service.ts  # → NOTIFICATION_CONTEXT_FACADE
├── domain/
│   ├── model/
│   │   ├── aggregates/
│   │   │   ├── consent-record.aggregate.ts
│   │   │   ├── data-subject-request.aggregate.ts
│   │   │   └── retention-policy.aggregate.ts
│   │   ├── valueobjects/
│   │   ├── commands/ queries/ events/
│   ├── services/                            # ports + tokens
│   ├── repositories/                        # ports + tokens
│   └── exceptions/
├── infrastructure/persistence/typeorm/
│   ├── entities/ assemblers/ adapters/
└── consent-compliance.module.ts
```
> Domain imports zero framework: no `@nestjs/*`, `typeorm`, or `class-validator` in `domain/`.

<a name="2-domain-layer"></a>

## 2. Domain Layer

### 2.1 Aggregate Root: `ConsentRecord`

```typescript
import { AggregateRoot } from '../../../shared/domain/model/aggregate-root';
export const ConsentStanding = { GRANTED: 'GRANTED', REVOKED: 'REVOKED' } as const;
export type ConsentStanding = (typeof ConsentStanding)[keyof typeof ConsentStanding];
export function parseConsentStanding(v: string): ConsentStanding {
  if (!(Object.values(ConsentStanding) as string[]).includes(v)) throw new Error(`invalid consent standing: ${v}`);
  return v as ConsentStanding;
}
// DTOs validan con @IsIn(Object.values(ConsentStanding)) (nunca forma enum clásica / @IsEnum)
export class ConsentRecord extends AggregateRoot {
  private constructor(
    private readonly _id: ConsentRecordId,
    private readonly _personId: PersonId,
    private readonly _scope: ConsentScope,
    private _standing: ConsentStanding,
    private readonly _policyVersion: PolicyVersion,
    private readonly _grantedAt: Date,
  ) { super(); }
  static grant(p: { id: ConsentRecordId; personId: PersonId; scope: ConsentScope; policyVersion: PolicyVersion }): ConsentRecord {
    const r = new ConsentRecord(p.id, p.personId, p.scope, ConsentStanding.GRANTED, p.policyVersion, new Date());
    r.registerEvent(new ConsentGrantedEvent(r._id, r._personId, r._scope, r._policyVersion));
    return r;
  }
  static rehydrate(p: { id: ConsentRecordId; personId: PersonId; scope: ConsentScope; standing: ConsentStanding; policyVersion: PolicyVersion; grantedAt: Date }): ConsentRecord {
    return new ConsentRecord(p.id, p.personId, p.scope, p.standing, p.policyVersion, p.grantedAt);
  }
  revoke(): void {
    if (this._standing !== ConsentStanding.GRANTED) throw new ConsentNotGrantedError('only a granted consent can be revoked');
    this._standing = ConsentStanding.REVOKED;
    this.registerEvent(new ConsentRevokedEvent(this._id, this._personId, this._scope));
  }
  answerState(): { granted: boolean; policyVersion: string; since: Date } {
    return { granted: this._standing === ConsentStanding.GRANTED, policyVersion: this._policyVersion.value, since: this._grantedAt };
  }
}
```

### 2.2 Aggregate Root: `DataSubjectRequest`

> Lifecycle contract `RequestLifecycle` (solo este agregado). `ErasureStanding` es el
> status enum del ciclo `submit → confirm → coordinate → recordConfirmation(×N) → complete`.
> `ConsentRecord.grant/revoke` y `RetentionPolicy.define` quedan como métodos explícitos
> únicos — son transiciones aisladas sin ciclo multi-paso, un skeleton Template-Method
> solo añadiría indirección (documentado, no omitido).

```typescript
export interface RequestLifecycle {
  confirm(): void;
  coordinateRevocation(owners: string[]): void;
  recordConfirmation(owner: string): void;
  complete(): void;
}
export const ErasureStanding = { REQUESTED: 'REQUESTED', CONFIRMED: 'CONFIRMED', COORDINATED: 'COORDINATED', AWAITING_CONFIRMATIONS: 'AWAITING_CONFIRMATIONS', COMPLETED: 'COMPLETED' } as const;
export type ErasureStanding = (typeof ErasureStanding)[keyof typeof ErasureStanding];
export function parseErasureStanding(v: string): ErasureStanding {
  if (!(Object.values(ErasureStanding) as string[]).includes(v)) throw new Error(`invalid erasure standing: ${v}`);
  return v as ErasureStanding;
}
// DTOs validan con @IsIn(Object.values(ErasureStanding))
export class DataSubjectRequest extends AggregateRoot implements RequestLifecycle {
  private constructor(
    private readonly _id: DataSubjectRequestId,
    private readonly _personId: PersonId,
    private _standing: ErasureStanding,
    private readonly _confirmations: RevocationConfirmations,
  ) { super(); }
  static submit(p: { id: DataSubjectRequestId; personId: PersonId }): DataSubjectRequest {
    const r = new DataSubjectRequest(p.id, p.personId, ErasureStanding.REQUESTED, new RevocationConfirmations([]));
    r.registerEvent(new ErasureRequestedEvent(r._id, r._personId));
    return r;
  }
  static rehydrate(p: { id: DataSubjectRequestId; personId: PersonId; standing: ErasureStanding; confirmations: RevocationConfirmations }): DataSubjectRequest {
    return new DataSubjectRequest(p.id, p.personId, p.standing, p.confirmations);
  }
  protected requireStanding(expected: ErasureStanding): void {
    if (this._standing !== expected) throw new ErasureNotConfirmedError(`expected ${expected}, was ${this._standing}`);
  }
  protected moveTo(next: ErasureStanding): void { this._standing = next; }
  confirm(): void {
    this.requireStanding(ErasureStanding.REQUESTED);
    this.moveTo(ErasureStanding.CONFIRMED);
    this.registerEvent(new ErasureConfirmedEvent(this._id, this._personId));
  }
  coordinateRevocation(owners: string[]): void {
    this.requireStanding(ErasureStanding.CONFIRMED);
    this._confirmations.askOwners(owners);
    this.moveTo(ErasureStanding.COORDINATED); // la coordinación queda registrada antes de esperar
    for (const o of owners) this.registerEvent(new RevocationCoordinatedEvent(this._id, this._personId, o));
    this.moveTo(ErasureStanding.AWAITING_CONFIRMATIONS);
  }
  recordConfirmation(owner: string): void {
    if (!this._confirmations.isAsked(owner)) throw new UnknownOwnerConfirmationError(`owner never coordinated: ${owner}`);
    if (this._confirmations.record(owner)) this.registerEvent(new RevocationConfirmedEvent(this._id, this._personId, owner));
  }
  complete(): void {
    if (!this._confirmations.allConfirmed()) throw new ErasureIncompleteError('every coordinated owner must confirm first');
    this._standing = ErasureStanding.COMPLETED;
    this.registerEvent(new ErasureCompletedEvent(this._id, this._personId));
  }
  answerStanding(): { standing: ErasureStanding; pending: string[]; confirmed: string[] } {
    return { standing: this._standing, pending: this._confirmations.pending(), confirmed: this._confirmations.confirmed() };
  }
}
```

### 2.3 Aggregate Root: `RetentionPolicy`

```typescript
export class RetentionPolicy extends AggregateRoot {
  private constructor(private readonly _id: RetentionPolicyId, private readonly _category: DataCategory, private readonly _terms: RetentionTerms, private readonly _supersedes: string | null) { super(); }
  static define(p: { id: RetentionPolicyId; category: DataCategory; terms: RetentionTerms; supersedes: string | null }): RetentionPolicy {
    const r = new RetentionPolicy(p.id, p.category, p.terms, p.supersedes);
    r.registerEvent(new RetentionPolicyDefinedEvent(r._id, r._category, r._terms, r._supersedes));
    return r;
  }
  static rehydrate(p: { id: RetentionPolicyId; category: DataCategory; terms: RetentionTerms; supersedes: string | null }): RetentionPolicy {
    return new RetentionPolicy(p.id, p.category, p.terms, p.supersedes);
  }
  answerTerms(): { category: string; terms: RetentionTerms } { return { category: this._category.value, terms: this._terms }; }
}
```

### 2.4 Value Objects, Commands, Queries, Events

VOs (immutable, `of()`/`generate()` + `equals()`): `ConsentRecordId`, `DataSubjectRequestId`, `RetentionPolicyId`, `PersonId`, `ConsentScope` (`BIOMETRIC_PROCESSING`, `EMAIL_NOTIFICATIONS`), `PolicyVersion`, `DataCategory`, `RetentionTerms`, `RevocationConfirmations`. Commands (sin cambios — ya `Action+Target+Command`): `GrantConsentCommand`, `RevokeConsentCommand`, `SubmitErasureRequestCommand`, `ConfirmErasureRequestCommand`, `RecordRevocationConfirmationCommand`, `DefineRetentionPolicyCommand`. Queries: `GetConsentStateByPersonAndScopeQuery`, `GetErasureStandingByPersonQuery`, `GetRetentionTermsByCategoryQuery` (+ `GetAuditTrailByPersonQuery`, scrutiny).

8 events (past tense, `DomainEvent` + static `eventName` con wire inalterado, VOs in payload): `ConsentGrantedEvent` (wire `'ConsentGranted'`), `ConsentRevokedEvent` (wire `'ConsentRevoked'`), `RetentionPolicyDefinedEvent` (wire `'RetentionPolicyDefined'`), `ErasureRequestedEvent` (wire `'ErasureRequested'`), `ErasureConfirmedEvent` (wire `'ErasureConfirmed'`), `RevocationCoordinatedEvent` (wire `'RevocationCoordinated'`), `RevocationConfirmedEvent` (wire `'RevocationConfirmed'`), `ErasureCompletedEvent` (wire `'ErasureCompleted'`).

Exceptions: `ConsentAlreadyGrantedError`, `ConsentNotGrantedError`, `ErasureAlreadyOpenError`, `ErasureNotConfirmedError`, `UnknownOwnerConfirmationError`, `ErasureIncompleteError`, `RequestNotFoundError` (all `Error` subclasses + `Object.setPrototypeOf`).

---

<a name="3-application-layer"></a>

## 3. Application Layer

Ports in `domain/services/` with tokens (`CONSENT_COMMAND_SERVICE`, `ERASURE_COMMAND_SERVICE`, `RETENTION_COMMAND_SERVICE`, `CONSENT_QUERY_SERVICE`, `ERASURE_QUERY_SERVICE`):

```typescript
export const CONSENT_COMMAND_SERVICE = Symbol('CONSENT_COMMAND_SERVICE');
// Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query)
export interface ConsentCommandService {
  grantConsent(cmd: GrantConsentCommand): Promise<ConsentRecordId>;
  revokeConsent(cmd: RevokeConsentCommand): Promise<void>;
}
export const ERASURE_COMMAND_SERVICE = Symbol('ERASURE_COMMAND_SERVICE');
export interface ErasureCommandService {
  submitErasureRequest(cmd: SubmitErasureRequestCommand): Promise<DataSubjectRequestId>;
  confirmErasureRequest(cmd: ConfirmErasureRequestCommand): Promise<void>;
  recordRevocationConfirmation(cmd: RecordRevocationConfirmationCommand): Promise<void>;
}
export const RETENTION_COMMAND_SERVICE = Symbol('RETENTION_COMMAND_SERVICE');
export interface RetentionCommandService {
  defineRetentionPolicy(cmd: DefineRetentionPolicyCommand): Promise<RetentionPolicyId>;
}
export const CONSENT_QUERY_SERVICE = Symbol('CONSENT_QUERY_SERVICE');
export interface ConsentQueryService {
  getConsentStateByPersonAndScope(q: GetConsentStateByPersonAndScopeQuery): Promise<ConsentStateAnswer>;
  getAuditTrailByPerson(q: GetAuditTrailByPersonQuery): Promise<AuditEntry[]>;
}
export const ERASURE_QUERY_SERVICE = Symbol('ERASURE_QUERY_SERVICE');
export interface ErasureQueryService {
  getErasureStandingByPerson(q: GetErasureStandingByPersonQuery): Promise<ErasureStandingAnswer>;
  getRetentionTermsByCategory(q: GetRetentionTermsByCategoryQuery): Promise<RetentionTermsAnswer>;
}
```

```typescript
@Injectable()
export class ConsentCommandServiceImpl implements ConsentCommandService {
  constructor(
    @Inject(CONSENT_REPOSITORY) private readonly consents: ConsentRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
  ) {}
  async grantConsent(cmd: GrantConsentCommand): Promise<ConsentRecordId> {
    const rec = await this.uow.run(async () => {
      const live = await this.consents.findLive(cmd.personId, cmd.scope);
      if (live) throw new ConsentAlreadyGrantedError('live GRANTED record already covers (person, scope)');
      const created = ConsentRecord.grant({ id: ConsentRecordId.generate(), personId: cmd.personId, scope: cmd.scope, policyVersion: cmd.policyVersion });
      await this.consents.save(created);
      return created;
    });
    for (const e of rec.pullDomainEvents()) this.events.emit(e.eventName, e);
    return rec.id;
  }
}
```

Erasure service follows the same UoW + after-commit publish shape: `submitErasureRequest` rejects open requests; `confirmErasureRequest` then `coordinateRevocation(owners)`; `recordRevocationConfirmation` then always `try complete()` catching `ErasureIncompleteError` while owners remain (no `if allConfirmed` duplication in application — the aggregate owns the rule); publish only after `uow.run()` resolves.

In-module `@OnEvent` handlers (never subscribed cross-module) call `External<Bc>Service` facades (partnership R12):

```typescript
@Injectable()
export class ErasureConfirmedEventHandler {
  constructor(
    private readonly biometric: ExternalBiometricService,
    private readonly wallet: ExternalWalletService,
    private readonly membership: ExternalMembershipService,
    private readonly notifications: ExternalNotificationsService,
  ) {}
  @OnEvent(ErasureConfirmedEvent.eventName, { async: true })
  async handle(event: ErasureConfirmedEvent): Promise<void> {
    const personId = event.personId.value, requestId = event.requestId.value;
    await this.biometric.askOwnerToRevoke(personId, requestId);
    await this.wallet.askOwnerToRevoke(personId, requestId);
    await this.membership.askOwnerToRevoke(personId, requestId);
    await this.notifications.askOwnerToRevoke(personId, requestId);
  }
}
```

`RevocationConfirmedEventHandler` (`revocation-confirmed.event-handler.ts`, in-module): ante cada `RevocationConfirmedEvent` (wire `'RevocationConfirmed'`) recarga el standing vía `ERASURE_QUERY_SERVICE.getErasureStandingByPerson()` (scrutiny/observabilidad del avance por owner); el cierre lo decide el servicio con `try complete()` — nunca el handler.

Un `External{X}Service` por contexto propietario (`ExternalBiometricService`, `ExternalWalletService`, `ExternalMembershipService`, `ExternalNotificationsService` en `outboundservices/acl/`), cada uno inyectando su facade token y exponiendo `askOwnerToRevoke(personId, requestId)` en primitivas; `ExternalIamService` answers person-existence for UC1/UC4. Fan-out de eventos: `ConsentGrantedEvent` / `ConsentRevokedEvent` → gates de Biometric, Notifications, OTP y OCR vía `mayProcessNow()` / `mayContactNow()` (cada BC decide en su borde); `RevocationCoordinatedEvent` (×N, uno por BC propietario) → Biometric, Wallet, Membership, Notifications; `ErasureCompletedEvent` → Notifications (aviso a la persona) + lectura de scrutiny. Coordinar ≠ ejecutar: este BC nunca borra datos ajenos.

---

<a name="4-infrastructure-layer"></a>

## 4. Infrastructure Layer

Schemas (Postgres): `consent.consents`, `consent.requests`, `consent.policies` — one ORM entity per aggregate; `RevocationConfirmations` as `jsonb` (never queried per-owner).

```typescript
@Entity({ schema: 'consent', name: 'consents' })
@Index(['personId', 'scope'], { unique: true, where: '"standing" = \'GRANTED\'' })
export class ConsentOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() personId: string;
  @Column() scope: string;
  @Column() standing: string;
  @Column() policyVersion: string;
  @Column({ type: 'timestamptz' }) grantedAt: Date;
}
@Entity({ schema: 'consent', name: 'requests' })
export class ErasureRequestOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() personId: string;
  @Column() standing: string;
  @Column('jsonb') confirmations: { asked: string[]; confirmed: string[] };
}
```

Assemblers (`consent/erasure-persistence.assembler.ts`) parse via `parseConsentStanding()` / `parseErasureStanding()` + `ConsentScope.of()` — never `as`-cast. Adapters read `TransactionContext.current ?? this.orm` so writes join the UoW; registered with `TypeOrmModule.forFeature([...])` + repository tokens. Fan-out a propietarios vía ACL independientes (un `External{X}Service` por facade propietaria, partnership R12): no hay Strategy de algoritmos — los propietarios no son variantes intercambiables de un mismo algoritmo sino puertos ACL independientes; añadir un owner = añadir un `External{X}Service`, sin cambiar el dominio.

---

<a name="5-interfaces-layer"></a>

## 5. Interfaces Layer

```typescript
@UseFilters(ConsentExceptionFilter)
@Controller('api/v1/consents')
export class ConsentController {
  constructor(@Inject(CONSENT_COMMAND_SERVICE) private readonly commands: ConsentCommandService, @Inject(CONSENT_QUERY_SERVICE) private readonly queries: ConsentQueryService) {}
  @Post() async grant(@Body() r: GrantConsentResource): Promise<ConsentStateResource> { /* assembler -> grantConsent -> re-query getConsentStateByPersonAndScope */ }
  @Post(':scope/revoke') async revoke(@Param('scope') scope: string, @Body() r: RevokeConsentResource): Promise<void> { /* assembler -> revokeConsent */ }
  @Get('state') async state(@Query('personId') p: string, @Query('scope') s: string): Promise<ConsentStateResource> { return this.queries.getConsentStateByPersonAndScope(new GetConsentStateByPersonAndScopeQuery(PersonId.of(p), ConsentScope.of(s))); }
}
```

| Method | Endpoint | Maps to |
|---|---|---|
| `POST` | `/api/v1/consents` | `GrantConsentCommand` (UC1) |
| `POST` | `/api/v1/consents/:scope/revoke` | `RevokeConsentCommand` (UC2) |
| `POST` | `/api/v1/erasure-requests` | `SubmitErasureRequestCommand` (UC4) |
| `POST` | `/api/v1/erasure-requests/:id/confirm` | `ConfirmErasureRequestCommand` (UC5) |
| `POST` | `/api/v1/erasure-requests/:id/confirmations` | `RecordRevocationConfirmationCommand` (UC6) |
| `POST` | `/api/v1/retention-policies` | `DefineRetentionPolicyCommand` (UC3) |
| `GET` | `/api/v1/retention-policies/:category` | `GetRetentionTermsByCategoryQuery` |

Resources use `class-validator`; assemblers translate resource ⇄ command. ACL published:

```typescript
export const CONSENT_CONTEXT_FACADE = Symbol('CONSENT_CONTEXT_FACADE');
export interface ConsentContextFacade {
  mayProcessNow(personId: string, scope: string): Promise<{ granted: boolean; policyVersion: string }>;
  mayContactNow(personId: string): Promise<boolean>;
  getErasureStanding(personId: string): Promise<{ standing: string; pending: string[] }>;
}
```

---

<a name="6-esquema-de-base-de-datos"></a>

## 6. Esquema de Base de Datos

```sql
CREATE SCHEMA IF NOT EXISTS consent;
CREATE TABLE consent.consents (
  id VARCHAR PRIMARY KEY, person_id VARCHAR NOT NULL, scope VARCHAR NOT NULL,
  standing VARCHAR NOT NULL, policy_version VARCHAR NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_consents_live ON consent.consents (person_id, scope) WHERE standing = 'GRANTED';
CREATE TABLE consent.requests (
  id VARCHAR PRIMARY KEY, person_id VARCHAR NOT NULL, standing VARCHAR NOT NULL,
  confirmations JSONB NOT NULL DEFAULT '{"asked":[],"confirmed":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_requests_person ON consent.requests (person_id);
CREATE UNIQUE INDEX uq_requests_open ON consent.requests (person_id) WHERE standing IN ('REQUESTED','CONFIRMED','COORDINATED','AWAITING_CONFIRMATIONS');
CREATE TABLE consent.policies (
  id VARCHAR PRIMARY KEY, category VARCHAR NOT NULL, terms JSONB NOT NULL,
  supersedes VARCHAR NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_policies_category ON consent.policies (category);
```

Partial unique index enforces invariant 2 (at most one live `GRANTED` per person+scope). Partial-unique `uq_requests_open(person_id) WHERE standing NOT IN ('COMPLETED')` enforces at most one open erasure per person at storage level (guarda de aplicación `submit` + red de seguridad en DB; colisión → 409).

---

<a name="7-flujos-cqrs-por-caso-de-uso"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 Grant (UC1)

```
POST /api/v1/consents -> GrantConsentCommandFromResourceAssembler.toCommand()
 -> ConsentCommandServiceImpl.grantConsent() [UoW]
    -> ExternalIamService.assertPersonExists() -> findLive() (409 if live)
     -> ConsentRecord.grant() -> save() -> commit -> emit(ConsentGrantedEvent)
 -> re-query getConsentStateByPersonAndScope() -> 201 ConsentStateResource
```

### 7.2 Revoke (UC2)

```
POST /consents/:scope/revoke -> RevokeConsentCommand
 -> revokeConsent() [UoW]: findLive() ?? throw ConsentNotGrantedError
     -> record.revoke() -> save() -> commit -> emit(ConsentRevokedEvent)
 -> 200; gates refuse from this moment, history untouched
```

### 7.3 Erasure anchor flow (UC4–UC6)

```
SubmitErasureRequestCommand -> submitErasureRequest() [rechaza si hay open: uq_requests_open -> 409] -> emit(ErasureRequestedEvent) -> 202
ConfirmErasureRequestCommand -> confirmErasureRequest() -> emit(ErasureConfirmedEvent)
  + after-commit @OnEvent(ErasureConfirmedEvent) -> External{Biometric,Wallet,Membership,Notifications}Service.askOwnerToRevoke()
    -> one RevocationCoordinatedEvent per owner (Biometric, Wallet, Membership, Notifications; standing=AWAITING_CONFIRMATIONS)
    -> each owner deletes own data -> POST .../confirmations (RecordRevocationConfirmationCommand)
      -> recordConfirmation() -> emit(RevocationConfirmedEvent) per owner
      -> tras cada confirmación: try complete() (cierra solo cuando el agregado lo permite; si no, ErasureIncompleteError) -> emit(ErasureCompletedEvent) -> Notifications (person notice) + scrutiny read
  Gates reactivos: ConsentGrantedEvent/ConsentRevokedEvent no se emiten a owners — Biometric/Notifications/OTP/OCR consultan mayProcessNow()/mayContactNow() en su borde.
```

---

<a name="8-integración-con-otros-bcs"></a>

## 8. Integración con otros BCs

R12 partnership/coordination: this BC coordinates, never executes. `RevocationCoordinatedEvent` (wire `'RevocationCoordinated'`, one per owning BC: Biometric, Wallet, Membership, Notifications) asks each owner to revoke its own data; each answers with `RecordRevocationConfirmationCommand` (comando sin cambios). Gates: Biometric/Notifications/OTP/OCR call `ConsentContextFacade.mayProcessNow()` / `mayContactNow()` (UC7) before running — granted-only processing, revoked refuses from that moment. Erasure completion notifies the person via Notifications; IAM is consulted for person-existence (UC1/UC4). Correlation by `personId` / category strings only — no embedded models.

---

<a name="9-dependencias-externas"></a>

## 9. Dependencias Externas

| Direction | Mechanism | Detail |
|---|---|---|
| Consumes IAM | `ExternalIamService` → `IAM_CONTEXT_FACADE` | `assertPersonExists(personId)` (UC1, UC4) |
| Consumes owners | `External{Biometric,Wallet,Membership,Notifications}Service` → owner facades | `askOwnerToRevoke(personId, requestId)` per owner, partnership R12 |
| Publishes ACL | `CONSENT_CONTEXT_FACADE` (`exports`) | `mayProcessNow`, `mayContactNow`, `getErasureStanding` |
| Events | `EventEmitter2` in-module only | 8 events; `forRoot()` once in `AppModule` |
| Infra | TypeORM + UoW | `TypeOrmUnitOfWork`, `TransactionContext`; no Redis — expiry/standing judged in domain |

---

<a name="10-auditoría-y-correcciones-aplicadas"></a>

## 10. Auditoría y Correcciones Aplicadas

| # | Severity | Finding (D5) | Fix |
|---|---|---|---|
| D5-1 | Alta | Re-opening a revoked record for a later grant | New record per grant; partial unique index on live `GRANTED` |
| D5-2 | Alta | Coordinating before confirmation | `coordinateRevocation()` guards `CONFIRMED`; `ErasureNotConfirmedError` |
| D5-3 | Media | Partial completion | `complete()` requires `allConfirmed()`; `ErasureIncompleteError` |
| D5-4 | Media | Silent duplicate confirmations | `RevocationConfirmations.record()` idempotent; unknown owners rejected |
| D5-5 | Media | Publishing before commit | Publish drained events only after `uow.run()` resolves |
| D5-6 | Baja | Cross-module `@OnEvent` subscription | Handlers in-module; cross-BC via `External{Bc}Service` facades |
| D5-7 | Baja | Nomenclatura ddd-guideliness v1.0.7 | Enums → as const + type union + parser `Object.values` + `@IsIn` (`ConsentStanding`, `ErasureStanding`); 8 eventos → sufijo `Event` (wire `eventName` inalterado: `'ConsentGranted'`, `'ConsentRevoked'`, `'RetentionPolicyDefined'`, `'ErasureRequested'`, `'ErasureConfirmed'`, `'RevocationCoordinated'`, `'RevocationConfirmed'`, `'ErasureCompleted'`); handlers → `ErasureConfirmedEventHandler` + `erasure-confirmed.event-handler.ts`, `RevocationConfirmedEventHandler` + `revocation-confirmed.event-handler.ts`, `@OnEvent(XEvent.eventName)`; comandos sin cambios |

> Override proyecto (skill ddd-guideliness v1.0.7, CHANGELOG líneas 7-18): closed sets como `as const` (sin enum clásico ni `@IsEnum`); comandos `Action+Target+Command` (consent ya conforme, sin cambios), queries `Action+Target+Criteria+Query`, eventos `Target+PastAction` + sufijo `Event` solo en clase (wire inalterado), handlers `<EventName>EventHandler`.

Sin Composite: las confirmaciones son el VO `RevocationConfirmations` (listas asked/confirmed + `allConfirmed()`) persistido como `jsonb` — no hay árbol de componentes que lo justifique. Sin base assembler: un assembler por agregado (`consent` / `erasure-persistence`) con `parse*Standing()` + `of()` explícitos; una clase base solo ocultaría el parseo estricto.

Open questions (from domain-model.md): scope catalog ownership; who confirms/refuses erasure; legal-hold form and expiry; in-flight votes at erasure time; whether refusal reasons are told to the person. Defaults: confirmed erasure beats retention; per-scope revocation allowed; history append-only and auditable.
