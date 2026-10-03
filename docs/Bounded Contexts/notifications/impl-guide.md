# Notifications — Guía de Implementación (NestJS + TypeORM + EventEmitter2)

> Generic Subdomain, receiver and actuator. Judges delivery standing, owns outcome history. Email-only MVP; sending executed outside.

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
src/notifications/
├── interfaces/
│   ├── rest/
│   │   ├── notification-dispatch.controller.ts
│   │   ├── resources/
│   │   │   ├── request-delivery.resource.ts
│   │   │   ├── delivery-standing.resource.ts
│   │   │   └── delivery-history.resource.ts
│   │   └── transform/
│   │       ├── request-delivery-command-from-resource.assembler.ts
│   │       └── delivery-standing-resource-from-entity.assembler.ts
│   ├── acl/
│   │   └── notification-context.facade.ts   # NOTIFICATION_CONTEXT_FACADE
│   └── filters/
│       └── notification-exception.filter.ts
├── application/
│   ├── acl/
│   │   └── notification-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   └── notification-dispatch-command.service.impl.ts
│       ├── queryservices/
│       │   └── notification-dispatch-query.service.impl.ts
│       ├── eventhandlers/
│       │   └── delivery-requested.event-handler.ts (DeliveryRequestedEventHandler)  # in-module: instruye al ejecutor tras commit (los fallos vuelven por webhook UC3, no por handler)
│       └── outboundservices/
│           ├── email/email-sending.service.ts        # EMAIL_SENDING_SERVICE port
│           ├── template/template-resolver.service.ts # TEMPLATE_RESOLVER port
│           └── acl/external-consent.service.ts       # may-contact gate
├── domain/
│   ├── model/
│   │   ├── aggregates/notification-dispatch.aggregate.ts
│   │   ├── valueobjects/  # dispatch-id, idempotency-key, delivery-address, resolved-template, refusal/failure-reason
│   │   ├── commands/ queries/ events/
│   ├── services/          # ports + tokens
│   ├── repositories/      # NOTIFICATION_DISPATCH_REPOSITORY + token
│   └── exceptions/
├── infrastructure/
│   ├── persistence/typeorm/
│   │   ├── entities/dispatch.orm-entity.ts
│   │   ├── assemblers/dispatch-persistence.assembler.ts
│   │   └── adapters/dispatch-repository.impl.ts
│   ├── email/{ses,sendgrid,logonly}/  # Ses | Sendgrid | LogOnly adapters (swap una línea)
│   └── template/catalog/              # TemplateResolverAdapter (catálogo de plantillas)
└── notifications.module.ts
```

`domain/` has zero imports from `@nestjs/*`, `typeorm`, `class-validator`.

---

<a name="2-domain-layer"></a>

## 2. Domain Layer

### 2.1 Aggregate Root: `NotificationDispatch`

Single aggregate; history belongs to the dispatch. Email-only; retries append on the same dispatch.

```typescript
import { AggregateRoot } from '../../../shared/domain/model/aggregate-root';
export const DispatchStanding = { REQUESTED: 'REQUESTED', REFUSED: 'REFUSED', CONFIRMED: 'CONFIRMED', FAILED: 'FAILED' } as const;
export type DispatchStanding = (typeof DispatchStanding)[keyof typeof DispatchStanding];
export function parseDispatchStanding(v: string): DispatchStanding {
  if (!(Object.values(DispatchStanding) as string[]).includes(v)) throw new Error(`invalid dispatch standing: ${v}`);
  return v as DispatchStanding;
}
// DTOs: @IsIn(Object.values(DispatchStanding)) (nunca forma enum clásica / `@IsEnum` / `as`)
export interface Dispatchable {
  confirmDelivered(): void;
  recordDeliveryFailure(reason: FailureReason): void;
  requestRetry(): void;
}
export class NotificationDispatch extends AggregateRoot implements Dispatchable {
  private constructor(
    private readonly _id: DispatchId,
    private readonly _key: IdempotencyKey,
    private readonly _address: DeliveryAddress,
    private readonly _template: ResolvedTemplate,
    private readonly _reason: string,
    private _standing: DispatchStanding,
    private readonly _history: DeliveryAttempt[],
    private _refusal: RefusalReason | null,
  ) { super(); }
  static requestDelivery(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: string }): NotificationDispatch {
    const d = new NotificationDispatch(p.id, p.key, p.address, p.template, p.reason, DispatchStanding.REQUESTED, [{ at: new Date(), outcome: 'REQUESTED' }], null);
    d.registerEvent(new DeliveryRequestedEvent(d._id, d._key, d._address, d._template, d._reason));
    return d;
  }
  static refuse(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: RefusalReason }): NotificationDispatch {
    const d = new NotificationDispatch(p.id, p.key, p.address, p.template, '', DispatchStanding.REFUSED, [{ at: new Date(), outcome: 'REFUSED' }], p.reason);
    d.registerEvent(new DeliveryRefusedEvent(d._id, d._key, p.reason));
    return d;
  }
  static rehydrate(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reason: string; standing: DispatchStanding; history: DeliveryAttempt[]; refusal: RefusalReason | null }): NotificationDispatch {
    return new NotificationDispatch(p.id, p.key, p.address, p.template, p.reason, p.standing, [...p.history], p.refusal);
  }
  protected requireRequested(err: Error): void {
    if (this._standing !== DispatchStanding.REQUESTED) throw err;
  }
  protected appendOutcome(outcome: string, detail?: string): void {
    this._history.push({ at: new Date(), outcome, ...(detail ? { detail } : {}) });
  }
  static refuseAndThrow(p: { id: DispatchId; key: IdempotencyKey; address: DeliveryAddress; template: ResolvedTemplate; reasonCode: 'DUPLICATE' | 'CONTACT_NOT_ALLOWED' }): { dispatch: NotificationDispatch; error: Error } {
    // Las ramas DUPLICATE / CONTACT_NOT_ALLOWED quedan separadas en el service (distinto RefusalReason + distinto error 409/403);
    // el helper solo centraliza construcción del REFUSED para no duplicar el literal.
    const dispatch = NotificationDispatch.refuse({ id: p.id, key: p.key, address: p.address, template: p.template, reason: new RefusalReason(p.reasonCode) });
    const error = p.reasonCode === 'DUPLICATE' ? new DuplicateIntentError('idempotency key already seen') : new ContactNotAllowedError('contact not allowed now');
    return { dispatch, error };
  }
  confirmDelivered(): void {
    this.requireRequested(new AlreadyConfirmedError('only a requested dispatch can be confirmed'));
    this._standing = DispatchStanding.CONFIRMED;
    this.appendOutcome('CONFIRMED');
    this.registerEvent(new DeliveryConfirmedEvent(this._id, this._key));
  }
  recordDeliveryFailure(reason: FailureReason): void {
    this.requireRequested(new NoSendInstructedError('no send instructed for the current attempt'));
    this._standing = DispatchStanding.FAILED;
    this.appendOutcome('FAILED', reason.value);
    this.registerEvent(new DeliveryFailedEvent(this._id, this._key, reason));
  }
  requestRetry(): void {
    if (this._standing !== DispatchStanding.FAILED) throw new RetryNotAllowedError('only a failed dispatch can retry');
    this._standing = DispatchStanding.REQUESTED;
    this.appendOutcome('REQUESTED');
    this.registerEvent(new DeliveryRetriedEvent(this._id, this._key, this._history.length));
  }
  answerDeliveryStanding(): { standing: DispatchStanding; attempts: number; refusal: string | null } {
    return { standing: this._standing, attempts: this._history.length, refusal: this._refusal?.value ?? null };
  }
}
```

### 2.2 Value Objects, Commands, Queries, Events

VOs (immutable + `equals()`): `DispatchId`, `IdempotencyKey` (requester-supplied), `DeliveryAddress` (email shape), `ResolvedTemplate` (unknown keys rejected), `RefusalReason` (`DUPLICATE` | `CONTACT_NOT_ALLOWED`), `FailureReason`, `DeliveryAttempt` (append-only). Commands: `RequestNotificationDeliveryCommand` (`request-notification-delivery.command.ts`), `ConfirmNotificationDeliveryCommand` (`confirm-notification-delivery.command.ts`), `RecordNotificationDeliveryFailureCommand` (`record-notification-delivery-failure.command.ts`), `RetryNotificationDeliveryCommand` (`retry-notification-delivery.command.ts`). Queries: `GetDeliveryStandingByDispatchQuery`, `GetDeliveryStandingByKeyQuery`, `GetDeliveryHistoryQuery`.

5 events: `DeliveryRequestedEvent`, `DeliveryRefusedEvent`, `DeliveryConfirmedEvent`, `DeliveryFailedEvent`, `DeliveryRetriedEvent` (all `DomainEvent` + static `eventName`; wire `eventName` inalterado `'DeliveryRequested'`, `'DeliveryRefused'`, `'DeliveryConfirmed'`, `'DeliveryFailed'`, `'DeliveryRetried'`; payloads carry dispatch id, key, template/address/reason — never person identity).

Exceptions: `DuplicateIntentError`, `ContactNotAllowedError`, `TemplateUnknownError`, `AddressMalformedError`, `AlreadyConfirmedError`, `NoSendInstructedError`, `RetryNotAllowedError`.

---

<a name="3-application-layer"></a>

## 3. Application Layer

Ports in `domain/services/` (`NOTIFICATION_COMMAND_SERVICE`, `NOTIFICATION_QUERY_SERVICE`).

> **Regla de nombrado (skill ddd-guideliness v1.0.11):** un método por comando/query, `methodName = lowerCamel(ClassName sin sufijo Command|Query)`, que recibe el objeto comando/query — nunca primitivas sueltas ni `handle` sobrecargado.

```typescript
export const NOTIFICATION_COMMAND_SERVICE = Symbol('NOTIFICATION_COMMAND_SERVICE');
export interface NotificationDispatchCommandService {
  requestNotificationDelivery(cmd: RequestNotificationDeliveryCommand): Promise<DispatchId>;
  confirmNotificationDelivery(cmd: ConfirmNotificationDeliveryCommand): Promise<void>;
  recordNotificationDeliveryFailure(cmd: RecordNotificationDeliveryFailureCommand): Promise<void>;
  retryNotificationDelivery(cmd: RetryNotificationDeliveryCommand): Promise<void>;
}
export const NOTIFICATION_QUERY_SERVICE = Symbol('NOTIFICATION_QUERY_SERVICE');
export interface NotificationDispatchQueryService {
  getDeliveryStandingByDispatch(q: GetDeliveryStandingByDispatchQuery): Promise<DeliveryStandingAnswer | null>;
  getDeliveryStandingByKey(q: GetDeliveryStandingByKeyQuery): Promise<DeliveryStandingAnswer | null>;
  getDeliveryHistory(q: GetDeliveryHistoryQuery): Promise<DeliveryHistoryAnswer>;
}
```

```typescript
@Injectable()
export class NotificationDispatchCommandServiceImpl implements NotificationDispatchCommandService {
  constructor(
    @Inject(NOTIFICATION_DISPATCH_REPOSITORY) private readonly dispatches: NotificationDispatchRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(EMAIL_SENDING_SERVICE) private readonly sender: EmailSendingService,
    @Inject(TEMPLATE_RESOLVER) private readonly templates: TemplateResolverService,
    private readonly consent: ExternalConsentService,
    private readonly events: EventEmitter2,
  ) {}
  async requestNotificationDelivery(cmd: RequestNotificationDeliveryCommand): Promise<DispatchId> {
    const seen = await this.dispatches.findByKey(cmd.key); // fast-path fuera del tx; la UNIQUE es la autoridad
    const template = await this.templates.resolve(cmd.templateKey, cmd.templateValues); // catálogo ANTES del run (throws TemplateUnknownError); el tx solo agrupa DB
    if (seen) {
      const refused = await this.uow.run(async () => {
        const r = NotificationDispatch.refuse({ id: DispatchId.generate(), key: cmd.key, address: cmd.address, template, reason: new RefusalReason('DUPLICATE') });
        await this.dispatches.save(r);
        return r;
      });
      for (const e of refused.pullDomainEvents()) this.events.emit(e.eventName, e);
      throw new DuplicateIntentError('idempotency key already seen');
    }
    const allowed = await this.consent.mayContactNow(cmd.address.value); // gate ANTES del run
    if (!allowed) {
      const refused = await this.uow.run(async () => {
        const r = NotificationDispatch.refuse({ id: DispatchId.generate(), key: cmd.key, address: cmd.address, template, reason: new RefusalReason('CONTACT_NOT_ALLOWED') });
        await this.dispatches.save(r);
        return r;
      });
      for (const e of refused.pullDomainEvents()) this.events.emit(e.eventName, e);
      throw new ContactNotAllowedError('contact not allowed now');
    }
    const created = await this.uow.run(async () => {
      const d = NotificationDispatch.requestDelivery({ id: DispatchId.generate(), key: cmd.key, address: cmd.address, template, reason: cmd.reason });
      await this.dispatches.save(d);
      return d;
    });
    for (const e of created.pullDomainEvents()) this.events.emit(e.eventName, e);
    return created.id;
  }
}
```

In-module handlers instruct the outside world after commit (executor stays outside the boundary):

```typescript
@Injectable()
export class DeliveryRequestedEventHandler {
  constructor(@Inject(EMAIL_SENDING_SERVICE) private readonly sender: EmailSendingService) {}
  @OnEvent(DeliveryRequestedEvent.eventName, { async: true })
  async handle(event: DeliveryRequestedEvent): Promise<void> {
    try { await this.sender.send(event.address.value, event.template.key, event.template.values); }
    catch (err) { /* observed back via UC3; never throws to the bus */ }
  }
}
```

`ExternalConsentService` wraps `CONSENT_CONTEXT_FACADE.mayContactNow()` (primitives at the boundary, translation here). Confirm/failure/retry run inside `uow.run()` + publish after commit.

---

<a name="4-infrastructure-layer"></a>

## 4. Infrastructure Layer

ORM entity = persistence shape; history as `jsonb` (single detail, always loaded with root, never queried per-attempt).

```typescript
@Entity({ schema: 'notifications', name: 'dispatches' })
@Index(['idempotencyKey'], { unique: true })
export class DispatchOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() idempotencyKey: string;
  @Column() address: string;
  @Column() channel: string; // 'EMAIL' — parked SMS/push never modeled
  @Column() templateKey: string;
  @Column('jsonb') templateValues: Record<string, string>;
  @Column() reason: string;
  @Column() standing: string;
  @Column('jsonb') history: { at: string; outcome: string; detail?: string }[];
  @Column({ nullable: true }) refusal: string | null;
}
```

Assembler parses standing via `parseDispatchStanding()` and rebuilds VOs (`DispatchId.of()`, `IdempotencyKey.of()`, `DeliveryAddress.of()`); adapter uses `TransactionContext.current ?? this.orm` for UoW participation and exposes `findByKey()`, `findById()`, `save()`. `EmailSendingService` es familia Strategy (port en `application/internal/outboundservices/email/` + token `EMAIL_SENDING_SERVICE`): `SesEmailSendingAdapter` | `SendgridEmailSendingAdapter` | `LogOnlyEmailSendingAdapter` (tests/local); el handler solo conoce el port. `TemplateResolverService` port en `application/internal/outboundservices/template/` (`TEMPLATE_RESOLVER`, `resolve(key, values): ResolvedTemplate`) aísla el catálogo de plantillas del agregado y del service (ver §3). Gate `ExternalConsentService.mayContactNow()` → `CONSENT_CONTEXT_FACADE` se juzga antes de `requestDelivery()` (ver §3):

```typescript
@Injectable()
export class SesEmailSendingAdapter implements EmailSendingService {
  async send(to: string, templateKey: string, values: Record<string, string>): Promise<void> {
    // SES / SendGrid client; render templateKey + values; outcome observed back via UC2/UC3 webhooks
  }
}
```

Swap SES ↔ SendGrid ↔ LogOnly by changing one provider line; application code unchanged.

---

<a name="5-interfaces-layer"></a>

## 5. Interfaces Layer

```typescript
@UseFilters(NotificationExceptionFilter) // interfaces/rest/filters/, @Catch de las 7 de §2.2 (skill: sin excepción sin entrada)
@Controller('notifications/dispatches')
export class NotificationDispatchController {
  constructor(
    @Inject(NOTIFICATION_COMMAND_SERVICE) private readonly commands: NotificationDispatchCommandService,
    @Inject(NOTIFICATION_QUERY_SERVICE) private readonly queries: NotificationDispatchQueryService,
  ) {}
  @Post() async request(@Body() r: RequestDeliveryResource): Promise<DeliveryStandingResource> {
    const cmd = RequestNotificationDeliveryCommandFromResourceAssembler.toCommand(r);
    const id = await this.commands.requestNotificationDelivery(cmd);
    const standing = await this.queries.getDeliveryStandingByDispatch(new GetDeliveryStandingByDispatchQuery(id));
    if (!standing) throw new NotFoundException();
    return DeliveryStandingResourceFromEntityAssembler.toResource(standing);
  }
  @Get(':id/standing') async standing(@Param('id') id: string): Promise<DeliveryStandingResource> { /* ... */ }
  @Get(':id/history') async history(@Param('id') id: string): Promise<DeliveryHistoryResource> { /* ... */ }
  @Get('by-key/:key/standing') async standingByKey(@Param('key') key: string): Promise<DeliveryStandingResource> { /* ... */ }
}
```

| Method | Endpoint | Maps to |
|---|---|---|
| `POST` | `/api/v1/notifications/dispatches` | `RequestNotificationDeliveryCommand` (UC1) |
| `GET` | `/api/v1/notifications/dispatches/:id/standing` | `GetDeliveryStandingByDispatchQuery` (UC5) |
| `GET` | `/api/v1/notifications/dispatches/by-key/:key/standing` | `GetDeliveryStandingByKeyQuery` (UC5) |
| `GET` | `/api/v1/notifications/dispatches/:id/history` | `GetDeliveryHistoryQuery` (scrutiny) |

Filtro (error → HTTP): `AddressMalformedError → 400`, `ContactNotAllowedError → 403`, `TemplateUnknownError → 422`, `NoSendInstructedError → 422`, `DuplicateIntentError → 409` (idempotency), `AlreadyConfirmedError → 409`, `RetryNotAllowedError → 409`.

Inbound contract is only template + address + reason + key (R11: no requester rule leaks in). Outbound ACL publishes standing answers:

```typescript
export const NOTIFICATION_CONTEXT_FACADE = Symbol('NOTIFICATION_CONTEXT_FACADE');
export interface NotificationContextFacade {
  getStandingByKey(key: string): Promise<{ standing: string; attempts: number }>;
  getHistory(dispatchId: string): Promise<{ attempts: { at: string; outcome: string }[] }>;
}
```

---

<a name="6-esquema-de-base-de-datos"></a>

## 6. Esquema de Base de Datos

```sql
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE TABLE notifications.dispatches (
  id VARCHAR PRIMARY KEY,
  idempotency_key VARCHAR NOT NULL UNIQUE,
  address VARCHAR NOT NULL,
  channel VARCHAR NOT NULL DEFAULT 'EMAIL' CHECK (channel = 'EMAIL'), -- invariante estructural (skill: columna sin campo en el agregado solo si es invariante, nunca side-channel): fijo por CHECK, nada entra a la fila que no venga del agregado; segundo canal = concepto nuevo con su propio campo en el agregado
  template_key VARCHAR NOT NULL,
  template_values JSONB NOT NULL DEFAULT '{}',
  reason VARCHAR NOT NULL,
  standing VARCHAR NOT NULL,
  history JSONB NOT NULL DEFAULT '[]',
  refusal VARCHAR NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_dispatches_standing ON notifications.dispatches (standing);
```

`idempotency_key UNIQUE` enforces invariant 1 at the storage level; history append-only (`jsonb` array, never updated in place). Carrera `findByKey()` → `save()`: el `UNIQUE` gana; el adapter traduce `QueryFailedError` 23505 a `refuseAndThrow(... 'DUPLICATE')` + 409 (el check previo es fast-path, la constraint es la autoridad).

---

<a name="7-flujos-cqrs-por-caso-de-uso"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 RequestDelivery anchor (UC1)

```
POST /dispatches -> RequestNotificationDeliveryCommandFromResourceAssembler.toCommand()
 -> requestNotificationDelivery(): findByKey() (duplicate -> refuse DUPLICATE, 409)
     -> templates.resolve() (unknown -> 422) + DeliveryAddress.of() (malformed -> 400)
    -> ExternalConsentService.mayContactNow() (refused -> persist REFUSED, 403, still history)
    -> [UoW] requestDelivery() -> save() -> commit -> emit(DeliveryRequestedEvent)
 -> @OnEvent(DeliveryRequestedEvent.eventName, async) -> EmailSendingService.send() (outside)
 -> re-query standing -> 202 DeliveryStandingResource
```

### 7.2 Confirm / Fail / Retry (UC2–UC4)

```
Executor webhook -> ConfirmNotificationDeliveryCommand -> [UoW] confirmDelivered() -> emit(DeliveryConfirmedEvent) -> 200
Executor webhook -> RecordNotificationDeliveryFailureCommand -> [UoW] recordDeliveryFailure(reason) -> emit(DeliveryFailedEvent)
POST .../:id/retry (FAILED only) -> [UoW] requestRetry() -> standing=REQUESTED, history appended -> emit(DeliveryRetriedEvent) -> re-instruct send
CONFIRMED/REFUSED never retry (AlreadyConfirmedError / RetryNotAllowedError -> 409)
```

### 7.3 Answer standing (UC5)

```
GET .../:id/standing | .../by-key/:key/standing
 -> GetDeliveryStandingByDispatchQuery / GetDeliveryStandingByKeyQuery
 -> answerDeliveryStanding() (no mutation, no event) -> 200 { standing, attempts, refusal }
```

---

<a name="8-integración-con-otros-bcs"></a>

## 8. Integración con otros BCs

R10 (Verification/OTP): OTP instructs code delivery with template + address + reason + key; this BC records the outcome — never delivers synchronously through a facade. R11 (open-host sink): IAM (welcome/security/address notices), Voting (open/close/receipt/tally), Membership (standing changes), Consent (erasure notices) all arrive as intents; when/why stays with the requester. R14 (Consent gate): `may-contact-now?` judged in Consent & Compliance, enforced + logged here (`CONTACT_NOT_ALLOWED` refusals are history, never silent drops). Correlation by address + template only — no person identity crosses. Scrutiny/erasure consumers read history (what was sent, to whom, when).

---

<a name="9-dependencias-externas"></a>

## 9. Dependencias Externas

| Direction | Mechanism | Detail |
|---|---|---|
| Consumes Consent | `ExternalConsentService` → `CONSENT_CONTEXT_FACADE` | `mayContactNow(address)` gate (UC1 step 3) |
| Executor Strategy (outside) | `EMAIL_SENDING_SERVICE` port → `Ses` / `Sendgrid` / `LogOnly` adapters | SES/SendGrid send; LogOnly for tests/local; outcomes observed back UC2/UC3 |
| Template catalog | `TEMPLATE_RESOLVER` port → `TemplateResolverAdapter` | `resolve(key, values)`; unknown keys → `TemplateUnknownError` (422) |
| Publishes ACL | `NOTIFICATION_CONTEXT_FACADE` (`exports`) | `getStandingByKey`, `getHistory` |
| Events | `EventEmitter2` in-module only | 5 events; `forRoot()` once in `AppModule`; `{ async: true }` for send path |
| Infra | TypeORM + UoW | `TypeOrmUnitOfWork`, `TransactionContext`; channel column fixed `'EMAIL'` |

---

<a name="10-auditoría-y-correcciones-aplicadas"></a>

## 10. Auditoría y Correcciones Aplicadas

| # | Severity | Finding (D5) | Fix |
|---|---|---|---|
| D5-1 | Alta | Duplicate key delivered twice under race | `findByKey()` check + DB `UNIQUE(idempotency_key)`; second intent refused `DUPLICATE` |
| D5-2 | Alta | Opt-in judged locally | Gate moved to `ExternalConsentService.mayContactNow()`; refusal persisted as history |
| D5-3 | Media | Refusals silently dropped | `NotificationDispatch.refuse()` persists `REFUSED` + emits `DeliveryRefusedEvent` |
| D5-4 | Media | Retry rewrote history | `requestRetry()` appends attempt, re-enters `REQUESTED` on same dispatch |
| D5-5 | Media | Publishing before commit | Drain + emit only after `uow.run()` resolves; send handler `{ async: true }` with own error handling |
| D5-6 | Baja | Person identity in payload | Contract limited to template + address + reason + key; no personId field |
| V1.0.7 | Baja | Naming v1.0.7: forma enum clásica / `in` / `@IsEnum`, eventos sin sufijo `Event`, handlers `<Stem>Handler` / `*.handler.ts`, comandos ambiguos | Enums como `as const` + `type` union + `parseX()` vía `Object.values()` + `@IsIn(Object.values(X))`; eventos con sufijo `Event` (wire `eventName` inalterado, sin doble sufijo); handlers `DeliveryRequestedEventHandler` en `*.event-handler.ts` con `@OnEvent(XEvent.eventName)`; comandos `RequestNotificationDeliveryCommand`/`ConfirmNotificationDeliveryCommand`/`RecordNotificationDeliveryFailureCommand`/`RetryNotificationDeliveryCommand` (`request-notification-delivery.command.ts`, etc.) |

> **Project override (v1.0.7):** sufijo `Event` en TODOS los eventos (no solo en colisión); wire `eventName='X'` inalterado (fix-back tras replaceAll, evitar doble sufijo); comandos ambiguos cualificados con target.

Sin Composite: el historial es lista de VOs `DeliveryAttempt` (append-only) persistida como `jsonb` en la fila del dispatch — componer intentos como entidades hijas añadiría joins sin ningún recorrido por intento; el `jsonb` es la forma correcta aquí.

Open questions (from domain-model.md): retry limits per intent; template catalog ownership; SMS/push as new intent vs new attempt (parked); bounce vs failure vocabulary; in-app inbox as channel vs external read model. Parked: device registry, local preference (Consent owns opt-in), multi-channel.

## Testing (skill §Testing each layer)

- **domain** (plain unit): `requestDelivery()` → `confirmDelivered()`; duplicado por key → `refuse(DUPLICATE)`; retry solo desde `FAILED`; `answerDeliveryStanding()`.
- **application**: mocks de repo + `EMAIL_SENDING_SERVICE` (LogOnly) + `TEMPLATE_RESOLVER` + `ExternalConsentService`, o `overrideProvider(...)`.
- **infrastructure**: Testcontainers Postgres — `UNIQUE(idempotency_key)` autoridad (23505 → `DUPLICATE`), historial `jsonb` append-only.
- **interfaces**: supertest (UC1 request → 202; webhooks UC2–4; UC5 standing/history).
