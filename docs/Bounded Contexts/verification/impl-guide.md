# Verification — Guía de Implementación (NestJS + TypeORM + EventEmitter2)

> BC genérico (prueba de posesión de canal). Fuente de negocio: `domain-model.md`, `use-case.md`, `event-storming.md` (v0.1.0). Porte más cercano de `docs/References/impl-guide.md`: mismas decisiones (HMAC no BCrypt, sin `plainCode` en eventos, entrega sincrónica por ACL) en idioms NestJS (`references/nestjs.md`).

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
src/verification/
├── interfaces/
│   ├── rest/
│   │   ├── verification.controller.ts
│   │   ├── resources/                           # DTOs con class-validator
│   │   │   ├── request-challenge.resource.ts
│   │   │   ├── answer-challenge.resource.ts
│   │   │   ├── challenge.resource.ts
│   │   │   └── challenge-standing.resource.ts
│   │   └── transform/
│   │       ├── request-verification-challenge-command-from-resource.assembler.ts
│   │       └── challenge-resource-from-entity.assembler.ts
│   ├── acl/
│   │   └── verification-context.facade.ts       # interfaz + token (primitivas)
│   └── filters/
│       └── verification-exception.filter.ts
├── application/
│   ├── acl/
│   │   └── verification-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/
│       │   └── verification-command.service.impl.ts
│       ├── queryservices/
│       │   └── verification-query.service.impl.ts
│       ├── eventhandlers/
│       │   └── challenge-confirmed.event-handler.ts   # solo dentro del módulo → facade IAM
│       └── outboundservices/
│           ├── codecompare/code-compare.service.ts      # port ejecutor (hash+matches)
│           └── acl/
│               ├── external-consent.service.ts          # gate may-contact
│               ├── external-iam.service.ts              # existencia de persona + markVerified (R9)
│               └── external-notifications.service.ts    # ACL → Notifications facade (sendCode sync)
├── domain/
│   ├── model/
│   │   ├── aggregates/verification-challenge.aggregate.ts
│   │   ├── valueobjects/   # challenge-id, person-id, purpose, attempt-count, validity-window, invalidation-reason
│   │   ├── commands/       # RequestVerificationChallengeCommand, AnswerVerificationChallengeCommand, ExpireVerificationChallengeCommand
│   │   ├── queries/        # GetChallengeStandingByPersonAndPurposeQuery, GetChallengeHistoryByPersonAndPurposeQuery
│   │   └── events/         # 5 eventos (ver §2.6)
│   ├── services/           # ports command/query + tokens
│   ├── repositories/verification-challenge.repository.ts
│   └── exceptions/         # 5 rechazos
├── infrastructure/
│   ├── persistence/typeorm/
│   │   ├── entities/challenge.orm-entity.ts
│   │   ├── assemblers/challenge-persistence.assembler.ts
│   │   └── adapters/challenge-repository.impl.ts
│   ├── hashing/
│   │   ├── hmac/hmac-code-compare.service.ts         # real por defecto (OTP_HASHER=hmac)
│   │   ├── bcrypt/bcrypt-code-compare.service.ts     # alternativa (OTP_HASHER=bcrypt)
│   │   └── fake/fake-code-compare.service.ts         # solo tests (OTP_HASHER=fake)
└── verification.module.ts
```

`EventEmitterModule.forRoot()` solo en `AppModule`. Dominio sin imports de `@nestjs/*`, `typeorm`, `class-validator`.

## 2. Capa de Dominio

### 2.1 Agregado raíz: `VerificationChallenge` — `ChallengeStandable` + `ChallengeStanding`

Un agregado = una prueba de un par (persona, propósito). Intentos contados dentro del challenge (sin ciclo separado). Como máximo un `OPEN` por par; segunda petición supersede (default). `CONFIRMED` un solo uso; `INVALIDATED`/`EXPIRED` terminales.

Contrato de standing (sin esqueleto): `ChallengeStandable` declara `answer / supersede / expire`. NO hay clase base: `request` (fábrica), `answer` y `expire` son disímiles (crear vs juzgar vs barrer), así que no comparten template-method. `answer()` mantiene sus 3 ramas internas (expirada / holds / falla-cuenta) en un solo método — partirlo rompería la atomicidad cuenta-o-confirma.

```typescript
// domain/model/aggregates/verification-challenge.aggregate.ts — cero framework
export const ChallengeStanding = { OPEN: 'OPEN', CONFIRMED: 'CONFIRMED', INVALIDATED: 'INVALIDATED', EXPIRED: 'EXPIRED' } as const;
export type ChallengeStanding = typeof ChallengeStanding[keyof typeof ChallengeStanding];
export function parseChallengeStanding(v: string): ChallengeStanding {
  if (!(Object.values(ChallengeStanding) as string[]).includes(v)) throw new Error(`invalid standing: ${v}`);
  return v as ChallengeStanding;
}

/** Contrato de standing. Sin esqueleto: request/answer/expire no comparten base. */
export interface ChallengeStandable {
  answer(holds: boolean, now: Date): void; // 3 ramas internas en un método: expira / confirma / cuenta
  supersede(): void;
  expire(now: Date): void;
}

export class VerificationChallenge extends AggregateRoot implements ChallengeStandable {
  private constructor(
    private readonly _id: ChallengeId,
    private readonly _personId: PersonId,
    private readonly _purpose: Purpose,
    private _standing: ChallengeStanding,
    private _attempts: AttemptCount,
    private readonly _window: ValidityWindow,
    private _codeHash: string,                       // solo hash HMAC; jamás el código
    private _invalidationReason: InvalidationReason | null,
  ) { super(); }

  static request(id: ChallengeId, p: PersonId, purpose: Purpose, win: ValidityWindow, codeHash: string): VerificationChallenge {
    const c = new VerificationChallenge(id, p, purpose, ChallengeStanding.OPEN, AttemptCount.fresh(5), win, codeHash, null);
    c.registerEvent(new ChallengeRequestedEvent(id, p, purpose, win));
    return c;
  }
  static rehydrate(i: { id: ChallengeId; personId: PersonId; purpose: Purpose; standing: ChallengeStanding; attempts: AttemptCount; window: ValidityWindow; codeHash: string; reason: InvalidationReason | null }): VerificationChallenge {
    return new VerificationChallenge(i.id, i.personId, i.purpose, i.standing, i.attempts, i.window, i.codeHash, i.reason);
  }

  /** Responde; el veredicto holds/not-holds llega del ejecutor (juzgado fuera, consumido aquí). */
  answer(holds: boolean, now: Date): void {
    if (this._standing !== ChallengeStanding.OPEN) throw new AlreadyAnsweredError('challenge ya respondido');
    if (this._window.isElapsed(now)) { this._standing = ChallengeStanding.EXPIRED; this.registerEvent(new ChallengeExpiredEvent(this._id, this._personId, this._purpose)); throw new AlreadyAnsweredError('ventana vencida'); }
    if (holds) { this._standing = ChallengeStanding.CONFIRMED; this.registerEvent(new ChallengeConfirmedEvent(this._id, this._personId, this._purpose)); return; }
    this._attempts = this._attempts.counted();
    this.registerEvent(new ChallengeAttemptFailedEvent(this._id, this._personId, this._purpose, this._attempts.remaining()));
    if (this._attempts.isExhausted()) {
      this._standing = ChallengeStanding.INVALIDATED;
      this._invalidationReason = InvalidationReason.attemptsExhausted();
      this.registerEvent(new ChallengeInvalidatedEvent(this._id, this._personId, this._purpose, this._invalidationReason));
    }
  }
  supersede(): void {  // request() sobre un OPEN previo: se invalida con SUPERSEDED
    if (this._standing !== ChallengeStanding.OPEN) return;
    this._standing = ChallengeStanding.INVALIDATED;
    this._invalidationReason = InvalidationReason.superseded();
    this.registerEvent(new ChallengeInvalidatedEvent(this._id, this._personId, this._purpose, this._invalidationReason));
  }
  expire(now: Date): void {
    if (this._standing === ChallengeStanding.OPEN && this._window.isElapsed(now)) {
      this._standing = ChallengeStanding.EXPIRED; this.registerEvent(new ChallengeExpiredEvent(this._id, this._personId, this._purpose));
    }
  }
  /** Operación de respuesta (lectura del agregado): ¿hay usable ahora y con cuántos intentos? */
  answerChallengeStanding(now: Date): { usable: boolean; remaining: number } {
    const usable = this._standing === ChallengeStanding.OPEN && !this._window.isElapsed(now) && !this._attempts.isExhausted();
    return { usable, remaining: this._attempts.remaining() };
  }
  get id(): ChallengeId { return this._id; } get standing(): ChallengeStanding { return this._standing; }
  get codeHash(): string { return this._codeHash; } get personId(): PersonId { return this._personId; }
}
```

### 2.2 Value Objects

`ChallengeId`/`PersonId`: `private` + `of()`/`generate()` + `equals()` (nunca intercambiables). `Purpose`: cerrado `login | email-verification | password-reset` (`as const` + type union, nunca `export enum`; skill) + `parsePurpose()` con guard `Object.values()` (nuevo propósito = nuevo mapeo, no cambio de modelo). Alineado a `domain-model.md` y UL §10 (fuentes de verdad). `AttemptCount(count, max=5)`: `fresh()`, `counted()`, `remaining()`, `isExhausted()`. `ValidityWindow(requestedAt, minutes=5)`: `isElapsed(now)`. `InvalidationReason`: `ATTEMPTS_EXHAUSTED | SUPERSEDED` con fábricas. Propuesta inicial (5 intentos / 5 min / código numérico corto) pendiente de producto: los números cambian sin tocar la forma.

### 2.3 Commands

`RequestVerificationChallengeCommand(personId, purpose)`, `AnswerVerificationChallengeCommand(challengeId, presentedCode)`, `ExpireVerificationChallengeCommand(challengeId)`. UC1 rechaza antes de abrir con `PurposeUnknown` / `ContactNotAllowed` sin producir hechos. UC3 sin scheduler en Sprint-01 (`@nestjs/schedule` aparcado): el juicio de expiracion es lazy — `answer(holds, now)` y `answerChallengeStanding(now)` aplican la rama expirada al leer; `ExpireVerificationChallengeCommand` queda para barrido explicito/admin, no para un cron.

### 2.4 Queries

`GetChallengeStandingByPersonAndPurposeQuery(personId, purpose)` (UC4, vía `answerChallengeStanding()`, sin mutar ni emitir) y `GetChallengeHistoryByPersonAndPurposeQuery(personId, purpose)` (scrutiny: todos los challenges del par `(personId, purpose)` en cualquier standing — OPEN/CONFIRMED/INVALIDATED/EXPIRED, incluidos SUPERSEDED — ordenados por `requestedAt`; el historial son challenges persistidos, no eventos rehidratados, y nunca contiene secretos).

### 2.5 Rechazos — `domain/exceptions/`

`PurposeUnknownError`, `ContactNotAllowedError`, `NoUsableChallengeError`, `AlreadyAnsweredError`, `AttemptNotHeldError`. `AttemptNotHeldError` se lanza al intentar responder un challenge sin OPEN usable (inexistente, ya CONFIRMED/INVALIDATED/EXPIRED, o de otro par); el fallo con intentos restantes NO lanza — registra el intento y emite `ChallengeAttemptFailedEvent`. Subclases de `Error` + `Object.setPrototypeOf`.

### 2.6 Eventos (5) — sin el código, nunca

`ChallengeRequestedEvent(challengeId, personId, purpose, window)`, `ChallengeConfirmedEvent(challengeId, personId, purpose)`, `ChallengeAttemptFailedEvent(challengeId, personId, purpose, remaining)`, `ChallengeInvalidatedEvent(challengeId, personId, purpose, reason)`, `ChallengeExpiredEvent(challengeId, personId, purpose)`. Payloads con VO tipados. **Ningún evento lleva `plainCode` ni el hash**: el historial registra juicios, jamás secretos (decisión espejo de impl-guide §10.1 #8).

## 3. Capa de Aplicación

### 3.1 Puertos — `domain/services/`

```typescript
export const VERIFICATION_COMMAND_SERVICE = Symbol('VERIFICATION_COMMAND_SERVICE');
export interface VerificationCommandService {
  // Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query)
  requestVerificationChallenge(c: RequestVerificationChallengeCommand): Promise<ChallengeId>;
  answerVerificationChallenge(c: AnswerVerificationChallengeCommand): Promise<void>;
  expireVerificationChallenge(c: ExpireVerificationChallengeCommand): Promise<void>;
}
export const VERIFICATION_QUERY_SERVICE = Symbol('VERIFICATION_QUERY_SERVICE');
export interface VerificationQueryService {
  getChallengeStandingByPersonAndPurpose(q: GetChallengeStandingByPersonAndPurposeQuery): Promise<{ usable: boolean; remaining: number }>;
  // History = findAllByPersonAndPurpose(personId, purpose) ordenado por requestedAt (todos los standings).
  getChallengeHistoryByPersonAndPurpose(q: GetChallengeHistoryByPersonAndPurposeQuery): Promise<VerificationChallenge[]>;
}
```

### 3.2 Command service — UoW + after-commit + ejecutor externo

```typescript
@Injectable()
export class VerificationCommandServiceImpl implements VerificationCommandService {
  constructor(
    @Inject(CHALLENGE_REPOSITORY) private readonly repo: VerificationChallengeRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    @Inject(CODE_COMPARE_SERVICE) private readonly compare: CodeCompareService,   // port ejecutor
    private readonly notifications: ExternalNotificationsService, // ACL → Notifications facade
    private readonly consent: ExternalConsentService,   // gate may-contact
    private readonly iam: ExternalIamService,           // existencia + markVerified (R9)
  ) {}
  async requestVerificationChallenge(c: RequestVerificationChallengeCommand): Promise<ChallengeId> {
    let plain: string; // vive solo en este método; jamás persiste ni viaja en eventos
    // Gates ACL ANTES del run(): el tx solo agrupa statements DB, nunca llamadas a otros BCs
    // (skill nestjs.md pitfalls). El chequeo findOpen + uq_open_pair siguen dentro: la constraint es la autoridad.
    if (!(await this.iam.personExists(c.personId.value))) throw new NoUsableChallengeError('persona desconocida');
    if (!(await this.consent.mayContactNow(c.personId.value))) throw new ContactNotAllowedError('contacto no permitido');
    plain = generateNumericCode(6);
    const codeHash = await this.compare.hash(plain); // ejecutor ANTES del run: el tx solo agrupa DB
    const created = await this.uow.run(async () => {
      const open = await this.repo.findOpenByPersonAndPurpose(c.personId, c.purpose);
      if (open) { open.supersede(); await this.repo.save(open); }   // mismo UoW: invalida + abre
      const ch = VerificationChallenge.request(ChallengeId.generate(), c.personId, c.purpose,
        ValidityWindow.fromNow(5), codeHash);
      await this.repo.save(ch); return ch;
    });
    this.publish(created);
    try {
      await this.notifications.sendCode(created!.personId.value, plain!, created!.purpose.value); // sync ACL, fuera de eventos; fallo no revierte commit
    } catch (err) { this.logger.warn(`notify falló para ${created!.id.value}: ${String(err)}`); }
    return created!.id;
  }
  async answerVerificationChallenge(c: AnswerVerificationChallengeCommand): Promise<void> {
    const probe = await this.repo.findById(c.challengeId); // lectura previa fuera del tx
    if (!probe) throw new NoUsableChallengeError('sin challenge usable');
    const holds = await this.compare.matches(c.presentedCode, probe.codeHash); // ejecutor fuera del tx
    const ch = await this.uow.run(async () => {
      const found = await this.repo.findById(c.challengeId); // re-lectura autoritativa dentro
      if (!found) throw new NoUsableChallengeError('sin challenge usable');
      found.answer(holds, new Date());   // cuenta intento / confirma / invalida / expira (carrera: rama expired)
      await this.repo.save(found); return found;
    });
    this.publish(ch);   // ChallengeConfirmedEvent lo consume el handler interno → IAM (R9)
  }
  private publish(ch: VerificationChallenge): void { for (const e of ch.pullDomainEvents()) this.events.emit(e.eventName, e); }
}
```

Concurrencia: dos `answer` en carrera serializan por intento; el que confirma consume (`CONFIRMED`), el tardío ve `AlreadyAnswered`. Un `request` en carrera invalida (`SUPERSEDED`) y la respuesta tardía no se aplica al nuevo challenge. Repetir el mismo código cuenta un intento por presentación.

### 3.3 Puertos de salida (ejecutor-first, decisión bloqueada)

```typescript
export const CODE_COMPARE_SERVICE = Symbol('CODE_COMPARE_SERVICE');
export interface CodeCompareService { hash(plain: string): Promise<string>; matches(plain: string, hash: string): Promise<boolean>; }
```

`ExternalNotificationsService.sendCode(personId: string, plainCode: string, purpose: string): Promise<void>` — ACL en `application/internal/outboundservices/acl/external-notifications.service.ts` que inyecta `NOTIFICATIONS_CONTEXT_FACADE` (el código viaja por ACL, nunca por eventos). `ExternalConsentService.mayContactNow(personId: string): Promise<boolean>` (Consent & Compliance juzga opt-in; UC1 lo exige) y `ExternalIamService { personExists(personId: string): Promise<boolean>; markVerified(personId: string, purpose: string): Promise<void> }` (existencia + R9). Generación/comparación/entrega se ejecutan fuera: este contexto juzga standing y posee el historial.

### 3.4 Event handlers (`{ async: true }` + `forRoot()` una vez)

```typescript
@Injectable()
export class ChallengeConfirmedEventHandler {
  @OnEvent(ChallengeConfirmedEvent.eventName, { async: true })
  async handle(e: ChallengeConfirmedEvent): Promise<void> {
    try { await this.iam.markVerified(e.personId.value, e.purpose.value); } // R9 → IAM
    catch (err) { this.logger.error(`IAM R9 falló para ${e.personId.value}: ${String(err)}`); }
  }
}
```

`EventEmitterModule.forRoot()` solo una vez en `AppModule`; aquí solo se inyecta `EventEmitter2`. `ChallengeConfirmedEvent` → IAM (R9: email verificado / 2FA / reset permitido, solo el hecho, jamás el secreto); la entrega del código es instrucción sync a Notifications (`ExternalNotificationsService.sendCode`, nunca por eventos). Ningún módulo externo se suscribe a estos eventos (misma regla anti-acoplamiento que Membership).

## 4. Capa de Infraestructura

**Comparador (Strategy `CodeCompareService`).** Puerto ejecutor `hash/matches`; HMAC-SHA256 es el real por defecto — OTP de vida corta (5 min) e intentos limitados (5); determinístico; rápido; sin dependencias. El secreto (`verification.otp.hmac-secret`) se protege y rota. Alternativas vía `verification.otp.hasher=hmac|bcrypt|fake` con swap en providers (sin tocar aplicación/dominio): `BcryptCodeCompareService` (coste adaptativo, si producto exige hashing lento) y `FakeCodeCompareService` (hash reversible predecible, solo tests). Decisión espejo de impl-guide §4.2.

```typescript
// verification.module.ts — swap por ConfigService, mismo token CODE_COMPARE_SERVICE
// `verification.otp.hasher` + `verification.otp.hmac-secret` se declaran en config + validation.schema (Joi); nunca process.env directo en providers.
providers: [
  {
    provide: CODE_COMPARE_SERVICE,
    inject: [ConfigService],
    useFactory: (cfg: ConfigService) => {
      const hasher = cfg.get<string>('verification.otp.hasher', 'hmac');
      if (hasher === 'bcrypt') return new BcryptCodeCompareService();
      if (hasher === 'fake') return new FakeCodeCompareService();
      return new HmacCodeCompareService(cfg.getOrThrow<string>('verification.otp.hmac-secret'));
    },
  },
]
@Injectable()
export class HmacCodeCompareService implements CodeCompareService {
  constructor(@Inject(CONFIG) private readonly secret: string) {}
  async hash(p: string): Promise<string> { return createHmac('sha256', this.secret).update(p).digest('hex'); }
  async matches(p: string, h: string): Promise<boolean> { return timingSafeEqualHex(await this.hash(p), h); }
}
```

**Notificación (sync ACL).** `ExternalNotificationsService` (en `application/internal/outboundservices/acl/`) inyecta `NOTIFICATIONS_CONTEXT_FACADE` — instrucción de entrega; el código viaja por ACL, nunca por eventos. Trade-off registrado: Verification deja de ser hoja.
**Persistencia.** ORM entity = forma de persistencia; `purpose`/`standing` columnas reales (finders filtran sobre ellas).

```typescript
@Entity('challenges') @Index(['personId', 'purpose', 'standing'])
export class ChallengeOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; @Column() personId: string; @Column() purpose: string;
  @Column() standing: string; @Column() attempts: number; @Column() maxAttempts: number;
  @Column() codeHash: string; @Column() requestedAt: Date; @Column() expiresAt: Date;
  @Column({ nullable: true }) reason: string | null;
}
// Assembler: toDomain vía rehydrate + of()/parsePurpose()/parseChallengeStanding(); toOrmEntity lee del agregado. Adapter: repo getter traduce el EntityManager ambiente vía manager.getRepository(ChallengeOrmEntity) (skill v1.0.9, nunca `?? orm`); findOpenByPersonAndPurpose(open+vigente), findAllByPersonAndPurpose(personId, purpose) ordenado por requestedAt (history), findById, save.
```

## 5. Capa de Interfaces

Controller delgado + filtro BC. Rate-limit en `request` (guardia de ejecución, no regla de dominio).

| Método | Endpoint | Descripción |
|:--|:--|:--|
| `POST` | `/api/v1/verifications/challenges` | `RequestVerificationChallengeCommand` → 201 + `Location` (entrega sync vía ACL, no en eventos) |
| `POST` | `/api/v1/verifications/challenges/:id/answer` | `AnswerVerificationChallengeCommand` → confirma / cuenta / invalida |
| `GET` | `/api/v1/verifications/standing?personId=&purpose=` | UC4: usable ahora + intentos restantes |
| `GET` | `/api/v1/verifications/history?personId=&purpose=` | Scrutiny |

```json
POST /api/v1/verifications/challenges        { "personId": "per-uuid", "purpose": "login" }  → 201 { "challengeId": "ch-xxx", "expiresAt": "..." }
POST /api/v1/verifications/challenges/:id/answer  { "code": "482913" }  → 200 { "standing": "CONFIRMED" } | 409 { "standing": "OPEN", "remaining": 3 } | 410 gone
```

ACL publicada (primitivas): `export const VERIFICATION_CONTEXT_FACADE = Symbol('VERIFICATION_CONTEXT_FACADE'); export interface VerificationContextFacade { requestChallenge(personId, purpose): Promise<string>; answerChallenge(challengeId, code): Promise<{ standing: string; remaining: number }>; getStanding(personId, purpose): Promise<{ usable: boolean; remaining: number }>; }` + impl en `application/acl/`; `verification.module.ts` `exports: [VERIFICATION_CONTEXT_FACADE]`. Resources con `class-validator`; assemblers estáticos. `VerificationExceptionFilter` mapea los 5 errores (`NoUsableChallengeError`/`AttemptNotHeldError` → 404, `AlreadyAnsweredError` → 409, `PurposeUnknownError`/`ContactNotAllowedError` → 422).

## 6. Esquema de Base de Datos

Schema `verification`, tabla `challenges`. Sin Redis/TTL: la expiración se juzga en dominio (`expiresAt`).

```sql
CREATE SCHEMA IF NOT EXISTS verification;
CREATE TABLE verification.challenges (
  id VARCHAR(36) PRIMARY KEY,
  person_id VARCHAR(36) NOT NULL,
  purpose VARCHAR(24) NOT NULL,          -- login|email-verification|password-reset
  standing VARCHAR(12) NOT NULL,         -- OPEN|CONFIRMED|INVALIDATED|EXPIRED
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  code_hash VARCHAR(128) NOT NULL,       -- HMAC-SHA256 hex; jamás plano
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(24) NULL,               -- ATTEMPTS_EXHAUSTED|SUPERSEDED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_open_pair ON verification.challenges (person_id, purpose) WHERE standing = 'OPEN';
CREATE INDEX ix_standing ON verification.challenges (person_id, purpose, standing);
```

## 7. Flujos CQRS por Caso de Uso

**UC1 Request:** `POST /challenges` → valida `Purpose` cerrado + `mayContactNow` (403 `ContactNotAllowed`) → UoW: supersede del OPEN previo + `request()` + `save` → publicar `ChallengeRequestedEvent`/`ChallengeInvalidatedEvent` tras commit → instrucción sync a Notifications → 201 + `Location`.
**UC2 Answer (ancla):** `POST /challenges/:id/answer` → UoW: `findById` → `compare.matches(plain, codeHash)` (juzgado fuera, nunca guardado) → `answer(holds)` → `save` → publicar tras commit (`ChallengeConfirmedEvent` | `ChallengeAttemptFailedEvent` [+ `ChallengeInvalidatedEvent` si agotó]) → handler interno → IAM (R9, solo el hecho).
**UC3 Expire (lazy, sin scheduler en Sprint-01):** el juicio autoritativo vive en `answer(holds, now)` (rama expirada) y `answerChallengeStanding(now)`; `expireVerificationChallenge` ejecuta `expire(now)` como barrido explicito/admin → `ChallengeExpiredEvent` si el OPEN vencio. **UC4 Standing:** query → `answerChallengeStanding()` → `{ usable, remaining }` (flujos IAM, throttling).

## 8. Integración con otros BCs

- **R9 → IAM (OHS + ACL):** el handler interno `ChallengeConfirmedEventHandler` (este módulo) llama a la facade IAM vía `ExternalIamService.markVerified` — IAM consume así el hecho (email verificado / segundo factor / reset permitido). IAM juzga standing, jamás re-juzga el código.
- **→ Notifications (instrucción):** "persona invitada a confirmar"; entrega del código como intención, propiedad de Notifications.
- **↔ Consent & Compliance:** `may-contact-now?` en UC1; denegado bloquea sin hechos.
- IAM → Verification: existencia de persona (referencia de identidad). Sin Redis; `Purpose` cerrado en tres (autorización de voto vive en Voting).

## 9. Dependencias Externas

| Dirección | Tipo | Detalle |
|:--|:--|:--|
| Verification → Shared Kernel | Legítima | `AggregateRoot`, `DomainEvent`, `IUnitOfWork`, `AuditableOrmEntity` |
| Verification → Notifications | ACL consumida sync | `ExternalNotificationsService` → `NOTIFICATIONS_CONTEXT_FACADE` (código por ACL, no por bus) |
| Verification → Consent / IAM | ACL consumida | gates `mayContactNow` / `personExists` (primitivas en el borde, VO dentro) |
| Verification → IAM (R9) | ACL publicada (hecho) | handler interno `ChallengeConfirmedEvent` → facade IAM; consumidores actúan sobre el hecho, nunca el secreto |

## 10. Auditoría y Preguntas Abiertas

Decisiones espejo de impl-guide: HMAC-SHA256 real por defecto, bcrypt/fake por flag `OTP_HASHER` (§4.2 impl-guide #9); sin `plainCode` en eventos, entrega por `ExternalNotificationsService` sync con try/catch (#8, #11); `Purpose` como enum cerrado (aquí 3: sin `CHECK_IN` genérico); multicanal queda en Notifications (sin `channel` en este BC); optimistic handling vía serialización por intento + supersede atómico en UoW (análogo a `@Version`); rate-limit en `request` (análogo a `@RateLimiter`); `personId` string alfanumérico (#10); validación de entrada en resources + `ValidationPipe` global (#4); 201 con `Location` (#5). **Sin Composite**: `AttemptCount`/`ValidityWindow` son VOs contados/juzgados dentro del challenge (H2), no partes componibles; el historial es query, no árbol.
Abiertas (de `domain-model.md`): supersede vs rechazar (#1), ventana/intentos/longitud (#2), throttling como regla vs guardia (#3), canales futuros (#4), qué flujos IAM consumen primero (#5).

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| V1.0.7 | — | Naming: <Stem>Event + <Stem>EventHandler in *.event-handler.ts; as const sets; ambiguous-only command renames | Applied |

Project override: ALL events carry Event suffix (deviates from skill collision-only rule) for grep-ability; wire eventName strings unchanged.

## Testing (skill §Testing each layer)

- **domain** (plain unit): `request()` → `answer` wrong ×5 → `INVALIDATED`; `request()` → `answer` correct → `CONFIRMED`; segundo `request` supersede el OPEN previo; `answerChallengeStanding()` no muta ni emite.
- **application**: mocks de repo + `CODE_COMPARE_SERVICE` (Fake) + `ExternalIamService`/`ExternalConsentService`, o `overrideProvider(...)`.
- **infrastructure**: Testcontainers Postgres — `uq_open_pair` parcial, round-trip + `parsePurpose()` corrupto.
- **interfaces**: supertest (`POST challenges → answer ×5 → INVALIDATED`; `request → answer → CONFIRMED`).
