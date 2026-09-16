# Biometric Identity Verification — Guía de Implementación NestJS + TypeORM + EventEmitter2

> Verifica identidad física (persona viva vs referencia). OTP valida posesión de canal — nunca se confunden. Fuente: `domain-model.md`, `use-case.md`, `event-storming.md` v0.1.0.
## ÍNDICE

1. [Estructura](#estructura) · 2. [Domain](#domain) · 3. [Application](#application) · 4. [Infrastructure](#infrastructure) · 5. [Interfaces](#interfaces) · 6. [DB](#database) · 7. [CQRS](#flujos) · 8. [Integración](#integracion) · 9. [Dependencias](#dependencias) · 10. [Auditoría](#auditoria)
---

<a name="estructura"></a>

## 1. Estructura del Proyecto

```
src/biometric-identity-verification/
├── interfaces/
│   ├── rest/biometric.controller.ts
│   │   ├── resources/ (enroll-biometric, start-challenge, complete-liveness, profile, attempt)
│   │   ├── transform/ (command-from-resource, resource-from-entity)
│   │   └── filters/biometric-exception.filter.ts
│   └── acl/biometric-context.facade.ts (+ VerifiedNowResource, ver §5.2)
├── application/acl/biometric-context-facade.impl.ts
├── application/internal/commandservices/ (biometric, attempt)
├── application/internal/queryservices/biometric-query.service.impl.ts
├── application/internal/eventhandlers/identity-verified.event-handler.ts (IdentityVerifiedEventHandler)
├── application/internal/outboundservices/acl/ (external-consent.service.ts, external-ocr.service.ts)
├── application/internal/outboundservices/matching/face-matching.service.ts (puerto)
├── domain/model/aggregates/biometric-profile.aggregate.ts
├── domain/model/aggregates/verification-attempt.aggregate.ts
├── domain/model/valueobjects/ (biometric-profile-id, verification-attempt-id, person-id, freshness-window, failure-reason, liveness-outcome)
├── domain/model/commands/ (enroll-biometric, start-liveness-challenge, revoke-biometric-profile)
├── domain/model/queries/ (get-verification-standing, get-reference-standing, get-attempt-history)
├── domain/model/events/ (9: enrolled, challenge-started, liveness-passed/failed, comparison-requested, verified, verification-failed, attempt-expired, profile-revoked)
├── domain/services/ + repositories/ (profile, attempt) + exceptions/
├── infrastructure/persistence/typeorm/entities/ (profile, attempt)
├── infrastructure/persistence/typeorm/assemblers/ + adapters/ (profile, attempt)
├── infrastructure/matching/vendor-a|vendor-b|fake/ (selector = env `FACE_MATCHER`, no token DI; umbral propio del BC)
└── biometric-identity-verification.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer
Cero imports de `@nestjs/*`, `typeorm`, `class-validator`. Referencia nunca guarda imágenes crudas.

### 2.1 Aggregate `BiometricProfile` — `ENROLLED → REVOKED` terminal. ≤1 viva por persona; re-enroll = nueva identidad.

Contrato `Enrollable` (sin esqueleto: solo `requireNotTerminal` de una línea; guards load-bearing en `revoke`):

```typescript
export interface Enrollable { enroll(): void; revoke(): void; }
export const ProfileStanding = { ENROLLED: 'ENROLLED', REVOKED: 'REVOKED' } as const;
export type ProfileStanding = (typeof ProfileStanding)[keyof typeof ProfileStanding];
export function parseProfileStanding(v: string): ProfileStanding {
  if (!(Object.values(ProfileStanding) as string[]).includes(v)) throw new Error(`invalid profile standing: ${v}`);
  return v as ProfileStanding;
}
// DTOs: @IsIn(Object.values(ProfileStanding)) (nunca forma enum clásica / `as` / `@IsEnum`)
export class BiometricProfile extends AggregateRoot {
  private constructor(private readonly _id: BiometricProfileId, private readonly _personId: PersonId,
    private _standing: ProfileStanding) { super(); }
  static enroll(i: { id: BiometricProfileId; personId: PersonId }): BiometricProfile {
    const p = new BiometricProfile(i.id, i.personId, ProfileStanding.ENROLLED);
    p.registerEvent(new BiometricEnrolledEvent(p._id, p._personId)); return p;
  }
  static rehydrate(i: { id: BiometricProfileId; personId: PersonId; standing: ProfileStanding }): BiometricProfile {
    return new BiometricProfile(i.id, i.personId, i.standing);
  }
  revoke(): void {
    if (this._standing !== ProfileStanding.ENROLLED) throw new AttemptConcludedError('already revoked');
    this._standing = ProfileStanding.REVOKED;
    this.registerEvent(new BiometricProfileRevokedEvent(this._id, this._personId));
  }
  answerReferenceStanding(): { live: boolean } { return { live: this._standing === ProfileStanding.ENROLLED }; }
  get id(): BiometricProfileId { return this._id; }
  get personId(): PersonId { return this._personId; }
  get standing(): ProfileStanding { return this._standing; }
}
```

Invariantes: una viva por persona; sin nada visible como rostro (solo lo que el matching necesita); `REVOKED` no reescribe veredictos pasados.

### 2.2 Aggregate `VerificationAttempt` — efímero (minutos). Liveness primero; veredicto binario congelado; frescura manda.

Contrato `AttemptStandable` (sin esqueleto: secuencia fijada por guards de standing, no por Template; único `requireNotTerminal` trivial):

```typescript
export interface AttemptStandable {
  completeLiveness(present: boolean): void;
  requestComparison(profileLive: boolean): void;
  recordVerdict(match: boolean, now: Date): void;
  expire(reason: FailureReason): void;
}

```typescript
export const AttemptStanding = { CHALLENGE_OPEN: 'CHALLENGE_OPEN', LIVENESS_PASSED: 'LIVENESS_PASSED', LIVENESS_FAILED: 'LIVENESS_FAILED', COMPARISON_REQUESTED: 'COMPARISON_REQUESTED', VERIFIED: 'VERIFIED', NOT_VERIFIED: 'NOT_VERIFIED', EXPIRED: 'EXPIRED' } as const;
export type AttemptStanding = (typeof AttemptStanding)[keyof typeof AttemptStanding];
export function parseAttemptStanding(v: string): AttemptStanding {
  if (!(Object.values(AttemptStanding) as string[]).includes(v)) throw new Error(`invalid attempt standing: ${v}`);
  return v as AttemptStanding;
}
// DTOs: @IsIn(Object.values(AttemptStanding)) (nunca forma enum clásica / `as` / `@IsEnum`)
export class VerificationAttempt extends AggregateRoot {
  private constructor(private readonly _id: VerificationAttemptId, private readonly _personId: PersonId,
    private readonly _profileId: BiometricProfileId, private _standing: AttemptStanding,
    private _freshness: FreshnessWindow, private _failure: FailureReason | null = null) { super(); }
  static start(i: { id: VerificationAttemptId; personId: PersonId; profileId: BiometricProfileId; freshness: FreshnessWindow }): VerificationAttempt {
    const a = new VerificationAttempt(i.id, i.personId, i.profileId, AttemptStanding.CHALLENGE_OPEN, i.freshness);
    a.registerEvent(new LivenessChallengeStartedEvent(a._id, a._personId)); return a;
  }
  static rehydrate(i: { id: VerificationAttemptId; personId: PersonId; profileId: BiometricProfileId; standing: AttemptStanding; freshness: FreshnessWindow; failure: FailureReason | null }): VerificationAttempt {
    return new VerificationAttempt(i.id, i.personId, i.profileId, i.standing, i.freshness, i.failure);
  }
  completeLiveness(present: boolean): void {
    this.assertStanding(AttemptStanding.CHALLENGE_OPEN);
    if (present) { this._standing = AttemptStanding.LIVENESS_PASSED; this.registerEvent(new LivenessPassedEvent(this._id)); }
    else { this._standing = AttemptStanding.LIVENESS_FAILED; this.registerEvent(new LivenessFailedEvent(this._id, FailureReason.LIVENESS_NOT_OBSERVED)); }
  }
  requestComparison(profileLive: boolean): void {
    this.assertStanding(AttemptStanding.LIVENESS_PASSED);
    if (!profileLive) throw new ReferenceEndedError('reference revoked');
    this._standing = AttemptStanding.COMPARISON_REQUESTED;
    this.registerEvent(new FaceComparisonRequestedEvent(this._id, this._profileId));
  }
  recordVerdict(match: boolean, now: Date): void {
    this.assertStanding(AttemptStanding.COMPARISON_REQUESTED);
    if (match) { this._standing = AttemptStanding.VERIFIED; this._freshness = this._freshness.stamp(now); this.registerEvent(new IdentityVerifiedEvent(this._id, this._personId, this._freshness)); }
    else { this._standing = AttemptStanding.NOT_VERIFIED; this._failure = FailureReason.NO_MATCH; this.registerEvent(new IdentityVerificationFailedEvent(this._id, this._personId, this._failure)); }
  }
  expire(reason: FailureReason): void {
    if ([AttemptStanding.VERIFIED, AttemptStanding.NOT_VERIFIED, AttemptStanding.LIVENESS_FAILED, AttemptStanding.EXPIRED].includes(this._standing)) return;
    this._standing = AttemptStanding.EXPIRED;
    this.registerEvent(new VerificationAttemptExpiredEvent(this._id, reason));
  }
  answerStanding(now: Date): { verifiedNow: boolean; reason: FailureReason | null } {
    const fresh = this._standing === AttemptStanding.VERIFIED && !this._freshness.isElapsed(now);
    return { verifiedNow: fresh, reason: fresh ? null : (this._failure ?? FailureReason.ATTEMPT_EXPIRED) };
  }
  private assertStanding(s: AttemptStanding): void { if (this._standing !== s) throw new AttemptConcludedError(`expected ${s}, was ${this._standing}`); }
  get id(): VerificationAttemptId { return this._id; }
  get standing(): AttemptStanding { return this._standing; }
}
```

### 2.3 Value Objects

| VO | Regla |
|:--|:--|
| `BiometricProfileId` / `VerificationAttemptId` / `PersonId` (`of/generate`) | Identidades tipadas, nunca `string` suelto |
| `FreshnessWindow(durationMin)` + `stamp(now)` + `isElapsed(now)` | Un veredicto autoriza una autorización, luego caduca (default) |
| `LivenessOutcome` (`PRESENT/ABSENT`) | Decidido una vez, nunca revisado |
| `FailureReason` (`LIVENESS_NOT_OBSERVED, NO_MATCH, REFERENCE_ENDED, ATTEMPT_EXPIRED, CONSENT_WITHDRAWN`) | Sin detalles de comparación |
| `ProfileStanding` / `AttemptStanding` (as const + type union + `parseX()` vía `Object.values`, `@IsIn(Object.values(...))` en DTOs, nunca forma enum clásica/`as`/`@IsEnum`) | Sin `as` |

### 2.4 Commands / Queries / Excepciones

```typescript
export class EnrollBiometricCommand { constructor(public readonly personId: PersonId) {} }
export class StartLivenessChallengeCommand { constructor(public readonly personId: PersonId) {} }
export class CompleteLivenessCommand { constructor(public readonly attemptId: VerificationAttemptId, public readonly present: boolean) {} }
export class RequestComparisonCommand { constructor(public readonly attemptId: VerificationAttemptId) {} }
export class RecordVerdictCommand { constructor(public readonly attemptId: VerificationAttemptId, public readonly now: Date) {} }
export class RevokeBiometricProfileCommand { constructor(public readonly profileId: BiometricProfileId) {} }
export class GetVerificationStandingByPersonQuery { constructor(public readonly personId: PersonId, public readonly now: Date) {} }
export class GetReferenceStandingByPersonQuery { constructor(public readonly personId: PersonId) {} }
export class GetAttemptHistoryByPersonQuery { constructor(public readonly personId: PersonId) {} }
```

Pasos intermedios UC2 viajan como comandos de primera clase (`CompleteLivenessCommand`, `RequestComparisonCommand`, `RecordVerdictCommand`) para cumplir la regla v1.0.11 (un método por comando con su objeto). Excepciones puras: `ReferenceAlreadyExistsError`, `ReferenceRequiredError`, `ConsentRequiredError`, `LivenessRequiredError`, `AttemptConcludedError`, `ReferenceEndedError`.

### 2.5 Eventos (9)

`BiometricEnrolledEvent` · `LivenessChallengeStartedEvent` · `LivenessPassedEvent` · `LivenessFailedEvent` (reason) · `FaceComparisonRequestedEvent` · `IdentityVerifiedEvent` (freshness) · `IdentityVerificationFailedEvent` (reason) · `VerificationAttemptExpiredEvent` (reason) · `BiometricProfileRevokedEvent`. Clases con `eventName` estático (wire inalterado `'BiometricEnrolled'`, `'LivenessChallengeStarted'`, `'LivenessPassed'`, `'LivenessFailed'`, `'FaceComparisonRequested'`, `'IdentityVerified'`, `'IdentityVerificationFailed'`, `'VerificationAttemptExpired'`, `'BiometricProfileRevoked'`) y VOs tipados.

### 2.6 Servicios de dominio

```typescript
export const BIOMETRIC_COMMAND_SERVICE = Symbol('BIOMETRIC_COMMAND_SERVICE');
export interface BiometricCommandService {
  // Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query)
  enrollBiometric(cmd: EnrollBiometricCommand): Promise<BiometricProfileId>;
  startLivenessChallenge(cmd: StartLivenessChallengeCommand): Promise<VerificationAttemptId>;
  completeLiveness(cmd: CompleteLivenessCommand): Promise<void>;
  requestComparison(cmd: RequestComparisonCommand): Promise<void>;
  recordVerdict(cmd: RecordVerdictCommand): Promise<void>;
  revokeBiometricProfile(cmd: RevokeBiometricProfileCommand): Promise<void>;
}
export const BIOMETRIC_QUERY_SERVICE = Symbol('BIOMETRIC_QUERY_SERVICE');
export interface BiometricQueryService {
  getVerificationStandingByPerson(q: GetVerificationStandingByPersonQuery): Promise<{ verifiedNow: boolean; reason: string | null }>;
  getReferenceStandingByPerson(q: GetReferenceStandingByPersonQuery): Promise<{ live: boolean }>;
  getAttemptHistoryByPerson(q: GetAttemptHistoryByPersonQuery): Promise<VerificationAttempt[]>;
}
```

---

<a name="application"></a>

## 3. Application Layer
UoW + publish after-commit. Consent gatea todo inicio; OCR single-use siembra la referencia.

### 3.1 Command services

```typescript
@Injectable()
export class BiometricCommandServiceImpl implements BiometricCommandService {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository,
    @Inject(ATTEMPT_REPOSITORY) private readonly attempts: AttemptRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork, private readonly emitter: EventEmitter2,
    @Inject(CONSENT_PORT) private readonly consent: ExternalConsentService,
    @Inject(OCR_PORT) private readonly ocr: ExternalOcrService,
    @Inject(MATCHING_PORT) private readonly matching: FaceMatchingService) {}
  async enrollBiometric(cmd: EnrollBiometricCommand): Promise<BiometricProfileId> {
    if (!(await this.consent.biometricConsentStands(cmd.personId.value))) throw new ConsentRequiredError('consent required');
    if (!(await this.ocr.consumeUsableMatch(cmd.personId.value))) throw new ReferenceRequiredError('single-use MATCH required'); // R7
    const p = await this.uow.run(async () => {
      if (await this.profiles.findLiveByPerson(cmd.personId)) throw new ReferenceAlreadyExistsError('one live reference');
      const x = BiometricProfile.enroll({ id: BiometricProfileId.generate(), personId: cmd.personId });
      await this.profiles.save(x); return x;
    });
    this.publish(p); return p.id;
  }
  async startLivenessChallenge(cmd: StartLivenessChallengeCommand): Promise<VerificationAttemptId> { // anchor UC2
    if (!(await this.consent.biometricConsentStands(cmd.personId.value))) throw new ConsentRequiredError('consent required');
    const personId = cmd.personId;
    const attempt = await this.uow.run(async () => {
      const ref = await this.profiles.findLiveByPerson(personId);
      if (!ref) throw new ReferenceRequiredError('no live reference');
      const a = VerificationAttempt.start({ id: VerificationAttemptId.generate(), personId, profileId: ref.id, freshness: FreshnessWindow.singleUse(15) });
      await this.attempts.save(a); return a;
    });
    this.publish(attempt); return attempt.id;
  }
  async completeLiveness(cmd: CompleteLivenessCommand): Promise<void> {
    const a = await this.uow.run(async () => {
      const x = await this.attempts.findByIdOrThrow(cmd.attemptId); x.completeLiveness(cmd.present);
      await this.attempts.save(x); return x;
    });
    this.publish(a);
  }
  async requestComparison(cmd: RequestComparisonCommand): Promise<void> {
    const a = await this.uow.run(async () => {
      const x = await this.attempts.findByIdOrThrow(cmd.attemptId);
      const ref = await this.profiles.findById(x.profileId);
      x.requestComparison(ref?.standing === ProfileStanding.ENROLLED);
      await this.attempts.save(x); return x;
    });
    this.publish(a);
  }
  async recordVerdict(cmd: RecordVerdictCommand): Promise<void> {
    const a = await this.uow.run(async () => {
      const x = await this.attempts.findByIdOrThrow(cmd.attemptId);
      const match = await this.matching.judgesMatch(x.id.value); // umbral propio del BC
      x.recordVerdict(match, cmd.now); await this.attempts.save(x); return x;
    });
    this.publish(a);
  }
  private publish(a: AggregateRoot): void { for (const ev of a.pullDomainEvents()) this.emitter.emit(ev.eventName, ev); }
  async revokeBiometricProfile(cmd: RevokeBiometricProfileCommand): Promise<void> { // UC5 erasure
    const { profile, expired } = await this.uow.run(async () => {
      const p = (await this.profiles.findById(cmd.profileId)) ?? (() => { throw new ReferenceRequiredError('no profile'); })();
      p.revoke();
      const open = await this.attempts.findOpenByProfile(p.id);
      for (const a of open) { a.expire(FailureReason.REFERENCE_ENDED); }
      await this.profiles.save(p);
      for (const a of open) { await this.attempts.save(a); }
      return { profile: p, expired: open };
    });
    this.publish(profile); for (const a of expired) this.publish(a);
  }
}
```

UC5 revoke app-orquestado vía `RevokeBiometricProfileCommand`: `revoke()` + `expire(REFERENCE_ENDED)` por cada attempt abierto, mismo UoW, luego publish. No se usa Profile-observes-Attempts (reacoplaría agregados de ritmos distintos); la orquestación vive en application. Cross-BC: `Verified/Failed` → Voting R3 vía facade/ACL, `Revoked` → Consent vía evento.

### 3.2 Query services

`getVerificationStanding` → último `VERIFIED` → `answerStanding(now)` (fresco autoriza, añejo = `VerdictExpired`/historia); `getReferenceStanding` → `answerReferenceStanding()` (nunca detalles de contenido); `getAttemptHistory` → attempts ordenados (scrutiny).

### 3.3 Puertos de salida

```typescript
export const CONSENT_PORT = Symbol('CONSENT_PORT');
export interface ExternalConsentService { biometricConsentStands(personId: string): Promise<boolean>; }
export const OCR_PORT = Symbol('OCR_PORT');
export interface ExternalOcrService { consumeUsableMatch(personId: string): Promise<boolean>; } // R7 single-use
export const MATCHING_PORT = Symbol('MATCHING_PORT');
export interface FaceMatchingService { judgesMatch(attemptId: string): Promise<boolean>; } // score→boolean, umbral del BC
```

### 3.4 Handlers + 3.5 Facade ACL

`IdentityVerifiedEventHandler` (`identity-verified.event-handler.ts`, `@OnEvent(IdentityVerifiedEvent.eventName)` in-module) llama al facade de Voting vía ACL (R3) — nunca `@OnEvent` cross-module. `BiometricContextFacadeImpl`: `answerVerifiedNow(personId, nowIso)` (Voting, primitivas en el borde) + confirmación de revocación hacia Consent.

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer
### 4.1 Persistencia TypeORM (dos tablas, sin imágenes/crops/descriptores)

```typescript
@Entity('profiles')
export class ProfileOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; @Column() personId: string; @Column() standing: string;
}
@Entity('attempts')
@Index(['personId', 'standing'])
export class AttemptOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; @Column() personId: string; @Column() profileId: string;
  @Column() standing: string; @Column() freshnessStart: Date; @Column() freshnessMinutes: number;
  @Column({ nullable: true }) failureReason: string | null;
}
```

Adaptadores con `TransactionContext.current ?? orm`; assemblers con parsers (nunca `as`). `save()` traduce directo del agregado.

### 4.2 Adaptador matching + 4.3 Módulo

`infrastructure/matching/vendor-a/` + `vendor-b/` + `fake/` seleccionados por env `FACE_MATCHER` (`vendor-a|vendor-b|fake`, selector de despliegue — el puerto sigue siendo `MATCHING_PORT`); cada adaptador reporta score y el BC juzga `judgesMatch(): boolean` contra su propio umbral (`FACE_MATCH_THRESHOLD`) — el listón nunca sale del BC. Módulo exporta solo `BIOMETRIC_CONTEXT_FACADE`.

```typescript
@Module({ imports: [TypeOrmModule.forFeature([ProfileOrmEntity, AttemptOrmEntity])], controllers: [BiometricController],
  providers: [ProfilePersistenceAssembler, AttemptPersistenceAssembler,
    { provide: PROFILE_REPOSITORY, useClass: ProfileRepositoryImpl },
    { provide: ATTEMPT_REPOSITORY, useClass: AttemptRepositoryImpl },
    { provide: BIOMETRIC_COMMAND_SERVICE, useClass: BiometricCommandServiceImpl },
    { provide: BIOMETRIC_QUERY_SERVICE, useClass: BiometricQueryServiceImpl },
    { provide: MATCHING_PORT, useFactory: matchingFactory }, // FACE_MATCHER: vendor-a|vendor-b|fake
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: BIOMETRIC_CONTEXT_FACADE, useClass: BiometricContextFacadeImpl },
    ExternalConsentService, ExternalOcrService], // ACL → CONSENT_CONTEXT_FACADE / OCR_CONTEXT_FACADE (módulos importados)
  exports: [BIOMETRIC_CONTEXT_FACADE] })
export class BiometricIdentityVerificationModule {}
```

---

<a name="interfaces"></a>

## 5. Interfaces Layer
### 5.1 Controller

| Método | Endpoint | Uso |
|:--|:--|:--|
| `POST` | `/api/v1/biometric/profiles` | `EnrollBiometricCommand` (consume MATCH R7) → 201 |
| `DELETE` | `/api/v1/biometric/profiles/:id` | `RevokeBiometricProfileCommand` (erasure UC5) |
| `GET` | `/api/v1/biometric/profiles/standing?personId=` | `GetReferenceStandingByPersonQuery` |
| `POST` | `/api/v1/biometric/attempts` | `StartLivenessChallengeCommand` → 201 |
| `POST` | `/api/v1/biometric/attempts/:id/liveness` | `completeLiveness` (present/absent) |
| `POST` | `/api/v1/biometric/attempts/:id/comparison` | `requestComparison` (solo tras liveness) |
| `POST` | `/api/v1/biometric/attempts/:id/verdict` | `recordVerdict` (binario congelado) |
| `GET` | `/api/v1/biometric/attempts/standing?personId=` | UC3 verified-now (Voting R3) |

Delgado + `ValidationPipe` global + `@UseFilters(BiometricExceptionFilter)`.

### 5.2 ACL + Resources + Assemblers + Filtros

```typescript
export const BIOMETRIC_CONTEXT_FACADE = Symbol('BIOMETRIC_CONTEXT_FACADE');
export interface BiometricContextFacade {
  answerVerifiedNow(personId: string, nowIso: string): Promise<{ verifiedNow: boolean; reason: string | null }>;
}
```

DTOs `class-validator`: `EnrollBiometricResource{personId}`, `StartChallengeResource{personId}`, `CompleteLivenessResource{present}`, `ProfileResource{id,standing}`, `AttemptResource{id,standing,freshness}`, `VerifiedNowResource{verifiedNow,reason}`. Assemblers envuelven a VOs. Filtro: `ReferenceRequired→404`, `ConsentRequired→403`, `AttemptConcluded→409`, `LivenessRequired/ReferenceEnded→422`.

---

<a name="database"></a>

## 6. Esquema de Base de Datos
Esquema `biometric`, tablas `profiles` + `attempts`.
| Tabla | Columnas clave |
|:--|:--|
| `profiles` | `id` PK, `person_id` NOT NULL, `standing`, auditoría |
| `attempts` | `id` PK, `person_id`, `profile_id`, `standing`, `freshness_start/minutes`, `failure_reason` NULL |

```sql
CREATE SCHEMA IF NOT EXISTS biometric;
CREATE TABLE biometric.profiles (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
  standing VARCHAR(16) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_live_profile ON biometric.profiles (person_id) WHERE standing = 'ENROLLED';
CREATE TABLE biometric.attempts (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
  profile_id VARCHAR(64) NOT NULL, standing VARCHAR(24) NOT NULL, freshness_start TIMESTAMPTZ NOT NULL,
  freshness_minutes INT NOT NULL, failure_reason VARCHAR(32), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX ix_attempt_person ON biometric.attempts (person_id, standing);
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso
**UC1 Enroll:** consent? → `consumeUsableMatch` (R7, una vez) → `findLive` (existe → 409) → `enroll()` → `save` → publish.
**UC2 VerifyIdentity (anchor):** `consent→reference→start→completeLiveness→requestComparison→recordVerdict`: `start` → `Passed/Failed` (failed terminal) → comparación solo tras `LIVENESS_PASSED` → veredicto binario congelado → publish post-commit.
**UC3/UC4/UC5:** `answerStanding(now)` (solo fresco autoriza, R3); sweep `expire`; erasure → `revoke()` + `expire(REFERENCE_ENDED)` por abierto → `BiometricProfileRevokedEvent`; re-enroll = nueva identidad.

---

<a name="integracion"></a>

## 8. Integración con otros BCs
| Dirección | Relación | Mecanismo |
|:--|:--|:--|
| Biometric → Voting (R3) | `answerVerifiedNow` (UC3) | ACL síncrona; solo `VERIFIED` fresco autoriza |
| Biometric → Consent | `BiometricProfileRevokedEvent` | Confirma erasure; revocación cierra abiertos |
| OCR → Biometric (R7 Customer/Supplier) | `consumeUsableMatch` (UC1) | Single-use `MATCH` siembra referencia; nada image-like cruza |
| Consent → Biometric | `biometricConsentStands` | Gate UC1/UC2; `ConsentRequired` |
| IAM → Biometric | Existencia persona | Referencia por identidad |

---

<a name="dependencias"></a>

## 9. Dependencias Externas
| Dependencia | Puerto | Adaptador |
|:--|:--|:--|
| Consent | `ExternalConsentService` | Facade Consent (gate + erasure) |
| OCR (R7) | `ExternalOcrService` | `OCR_CONTEXT_FACADE` (single-use MATCH) |
| Matching vendor | `FaceMatchingService` | `VendorAMatchingService` (score→boolean, umbral BC) |
| Bus | `EventEmitter2` | `forRoot()` solo en `AppModule` |
| Persistencia | `ProfileRepository`, `AttemptRepository`, `IUnitOfWork` | Impls + `TypeOrmUnitOfWork` |
| Ciclo Biometric↔Consent | `forwardRef(() => ConsentModule)` en ambos módulos | Biometric consume Consent facade y Consent coordina revocación hacia Biometric |

---

<a name="auditoria"></a>

## 10. Auditoría y Correcciones Aplicadas
| # | Sev. | Hallazgo | Corrección |
|:--|:--|:--|:--|
| D1 | Alta | Un agregado para referencia + intentos | Dos agregados (ritmos distintos); attempts referencian por ID |
| D2 | Alta | Comparación sin liveness | `requestComparison` exige `LIVENESS_PASSED` (`LivenessRequired`) |
| D3 | Media | Imágenes en referencia/eventos | Prohibidas; solo standing/veredicto/frescura |
| D4 | Media | Umbral del vendor como veredicto | Vendor reporta score; BC juzga boolean contra umbral propio |
| D5 | Media | `as` cast de standings | Parsers explícitos vía `Object.values()` en assemblers; enums como `as const` + `@IsIn(Object.values(...))` |
| D6 | Baja | Publish dentro de UoW | Publish tras `run()` resuelto |
| D7 | Baja | Composite entre Profile/Attempts | No aplica: ID-refs correctas (`profileId` por valor), ritmos distintos, nada que componer |
| V1.0.7 | Baja | Naming v1.0.7: forma enum clásica / `in` / `@IsEnum`, eventos sin sufijo `Event`, handlers `<Stem>Handler` / `*.handler.ts` | Enums como `as const` + `type` union + `parseX()` vía `Object.values()` + `@IsIn(Object.values(X))`; eventos con sufijo `Event` (wire `eventName` inalterado, sin doble sufijo); handlers `IdentityVerifiedEventHandler` en `*.event-handler.ts` con `@OnEvent(XEvent.eventName)`; comandos Biometric UNCHANGED |

> **Project override (v1.0.7):** sufijo `Event` en TODOS los eventos (no solo en colisión); wire `eventName='X'` inalterado (fix-back tras replaceAll, evitar doble sufijo).

**Preguntas abiertas (no bloqueantes):** frontera exacta raw-images (producto+legal); ventana de frescura (default: una autorización); disciplina de fallos/pausas; detalle de scrutiny (score, versión umbral); referencia global vs por comunidad (default: una por persona).

```properties
biometric.freshness.minutes=${FACE_FRESHNESS_MINUTES:15}
biometric.match.threshold=${FACE_MATCH_THRESHOLD:0.82}
biometric.match.matcher=${FACE_MATCHER:vendor-a}
```
