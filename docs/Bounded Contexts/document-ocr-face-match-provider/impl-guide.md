# Document OCR & Face Match Provider — Guía de Implementación NestJS + TypeORM + EventEmitter2

> BC genérico: juzga evidencia documental una vez (¿lee? ¿el rostro sostiene?). Ejecución fuera (executor-first intercambiable Rekognition/GDocAI). Fuente: `domain-model.md`, `use-case.md`, `event-storming.md` v0.1.0.

## ÍNDICE

1. [Estructura del Proyecto](#estructura) · 2. [Domain Layer](#domain) · 3. [Application Layer](#application) · 4. [Infrastructure Layer](#infrastructure) · 5. [Interfaces Layer](#interfaces) · 6. [Esquema de Base de Datos](#database) · 7. [Flujos CQRS](#flujos) · 8. [Integración con otros BCs](#integracion) · 9. [Dependencias Externas](#dependencias) · 10. [Auditoría](#auditoria)

---

<a name="estructura"></a>

## 1. Estructura del Proyecto

```
src/document-ocr-face-match-provider/
├── interfaces/
│   ├── rest/examination.controller.ts
│   │   ├── resources/ (request-examination, examination, history)
│   │   ├── transform/ (command-from-resource, resource-from-entity)
│   │   └── filters/examination-exception.filter.ts
│   └── acl/ocr-context.facade.ts (+ ExaminationStandingResource, ver §5.2)
├── application/acl/ocr-context-facade.impl.ts
├── application/internal/commandservices/examination-command.service.impl.ts
├── application/internal/queryservices/examination-query.service.impl.ts
├── application/internal/eventhandlers/examination-event.logger.ts
├── application/internal/outboundservices/executor/document-executor.service.ts (puerto)
├── application/internal/outboundservices/acl/external-membership.service.ts
├── application/internal/outboundservices/acl/external-consent.service.ts
├── domain/model/aggregates/document-examination.aggregate.ts
├── domain/model/valueobjects/ (examination-id, person-id, document-ref, standing, verdict, unreadable-reason, validity-window)
├── domain/model/commands/ (request-document-examination, request-document-reexamination, examine-document-examination, expire-document-examination)
├── domain/model/queries/ (get-standing, get-history)
├── domain/model/events/ (7: requested, refused, extracted, compared, concluded, expired, reexamination-requested)
├── domain/services/ + repositories/ + exceptions/ (already-open, no-open, concluded, no-eligible-membership, contact-not-allowed)
├── infrastructure/persistence/typeorm/entities/examination.orm-entity.ts
├── infrastructure/persistence/typeorm/assemblers/examination-persistence.assembler.ts
├── infrastructure/persistence/typeorm/adapters/examination-repository.impl.ts
├── infrastructure/executor/rekognition/ + infrastructure/executor/gdoc-ai/
└── document-ocr-face-match-provider.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer

Cero imports de `@nestjs/*`, `typeorm`, `class-validator`. Todo el dominio es TS plano.

### 2.1 Aggregate Root `DocumentExamination`

`OPEN → CONCLUDED (MATCH|NO_MATCH|UNREADABLE)` o `OPEN → EXPIRED`. Terminal; reexamen = nueva identidad vinculada, nunca transición.

Contrato `Examinable`: pipeline lineal sin esqueleto en dominio — `recordExtraction → recordComparison → recordVerdict(Verdict)` único; `expire` terminal. No hay Template/Skeleton reutilizable porque el orden lo impone el agregado con guards lineales.

```typescript
export interface Examinable {
  recordExtraction(readable: boolean, reason: UnreadableReason | null): void;
  recordComparison(holds: boolean): void;
  recordVerdict(v: Verdict): void;
  noteRefused(reason: string): void; // scrutiny sin transición: el rechazo queda en el historial del abierto
  expire(now: Date): void;
}
export const ExaminationStanding = { OPEN: 'OPEN', CONCLUDED: 'CONCLUDED', EXPIRED: 'EXPIRED' } as const;
export type ExaminationStanding = (typeof ExaminationStanding)[keyof typeof ExaminationStanding];
export function parseExaminationStanding(v: string): ExaminationStanding {
  if (!(Object.values(ExaminationStanding) as string[]).includes(v)) throw new Error(`invalid examination standing: ${v}`);
  return v as ExaminationStanding;
}
export const Verdict = { MATCH: 'MATCH', NO_MATCH: 'NO_MATCH', UNREADABLE: 'UNREADABLE' } as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];
export function parseVerdict(v: string): Verdict {
  if (!(Object.values(Verdict) as string[]).includes(v)) throw new Error(`invalid verdict: ${v}`);
  return v as Verdict;
}
// UnreadableReason: conjunto cerrado en 5 como as const + type union + parseUnreadableReason(Object.values) + @IsIn(Object.values(UnreadableReason)) en DTOs (nunca forma enum clásica / `as` / `@IsEnum`)
export class DocumentExamination extends AggregateRoot {
  private constructor(private readonly _id: ExaminationId, private readonly _personId: PersonId,
    private readonly _documentRef: DocumentRef, private _standing: ExaminationStanding,
    private readonly _window: ValidityWindow, private _verdict: Verdict | null = null,
    private _consumed = false, private _extracted = false, private _compared = false) { super(); }
  static request(i: { id: ExaminationId; personId: PersonId; documentRef: DocumentRef; window: ValidityWindow }): DocumentExamination {
    const e = new DocumentExamination(i.id, i.personId, i.documentRef, ExaminationStanding.OPEN, i.window);
    e.registerEvent(new ExaminationRequestedEvent(e._id, e._personId, e._documentRef)); return e;
  }
  static rehydrate(i: { id: ExaminationId; personId: PersonId; documentRef: DocumentRef; standing: ExaminationStanding; window: ValidityWindow; verdict: Verdict | null; consumed: boolean; extracted: boolean; compared: boolean }): DocumentExamination {
    return new DocumentExamination(i.id, i.personId, i.documentRef, i.standing, i.window, i.verdict, i.consumed, i.extracted, i.compared);
  }
  recordExtraction(readable: boolean, reason: UnreadableReason | null): void {
    this.assertOpen(); this._extracted = true;
    this.registerEvent(new DocumentExtractedEvent(this._id, readable, reason));
  }
  recordComparison(holds: boolean): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('comparison without clean read');
    this._compared = true; this.registerEvent(new FacesComparedEvent(this._id, holds));
  }
  recordVerdict(v: Verdict): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('verdict without extraction');
    this._verdict = v; this._standing = ExaminationStanding.CONCLUDED;
    this.registerEvent(new ExaminationConcludedEvent(this._id, v));
  }
  noteRefused(reason: string): void {
    this.assertOpen();
    this.registerEvent(new ExaminationRefusedEvent(this._id, this._personId, reason)); // DUPLICATE: historia sin transición
  }
  expire(now: Date): void {
    if (this._standing !== ExaminationStanding.OPEN) return;
    if (!this._window.isElapsed(now)) throw new ExaminationConcludedError('window still answerable');
    this._standing = ExaminationStanding.EXPIRED;
    this.registerEvent(new ExaminationExpiredEvent(this._id, this._personId));
  }
  requestReexamination(newId: ExaminationId, w: ValidityWindow): DocumentExamination {
    if (this._standing === ExaminationStanding.OPEN) throw new ExaminationAlreadyOpenError('one OPEN per person+doc');
    const f = new DocumentExamination(newId, this._personId, this._documentRef, ExaminationStanding.OPEN, w);
    f.registerEvent(new ReexaminationRequestedEvent(this._id, newId)); return f;
  }
  answerStanding(): { usableMatch: boolean } {
    return { usableMatch: this._standing === ExaminationStanding.CONCLUDED && this._verdict === Verdict.MATCH && !this._consumed };
  }
  markConsumed(): void { this._consumed = true; }
  private assertOpen(): void { if (this._standing !== ExaminationStanding.OPEN) throw new ExaminationConcludedError('not OPEN'); }
  get id(): ExaminationId { return this._id; }
  get standing(): ExaminationStanding { return this._standing; }
}
```

Invariantes: ≤1 `OPEN` por (persona, documento); concluida/expirada nunca responde; veredicto single-use; evidencia muere con el examen.

### 2.2 Value Objects

| VO | Regla |
|:--|:--|
| `ExaminationId` (`exm-`+UUID, `of/generate`) | Identidad estable, nunca reutilizada |
| `PersonId` / `DocumentRef` (`of`) | Referencias por identidad, no embebidas |
| `ExaminationStanding` / `Verdict` (as const + type union + `parseX()` vía `Object.values`, `@IsIn(Object.values(...))` en DTOs, nunca `enum`/`as`/`@IsEnum`) | Sets cerrados |
| `UnreadableReason` (as const 5: `BLURRY, GLARE, CROPPED, EXPIRED, MISMATCHED_TYPE` + `parseUnreadableReason()` vía `Object.values`, `@IsIn`) | Cerrado en 5 |
| `ValidityWindow(requestedAt, ttlMinutes)` + `isElapsed(now)` | Ventana terminal |

```typescript
export class ValidityWindow {
  constructor(public readonly requestedAt: Date, public readonly ttlMinutes: number) {
    if (ttlMinutes <= 0) throw new Error('ttl must be positive');
  }
  static now(ttlMinutes: number): ValidityWindow { return new ValidityWindow(new Date(), ttlMinutes); }
  isElapsed(now: Date): boolean { return now.getTime() > this.requestedAt.getTime() + this.ttlMinutes * 60000; }
  equals(o: ValidityWindow): boolean { return this.requestedAt.getTime() === o.requestedAt.getTime() && this.ttlMinutes === o.ttlMinutes; }
}
```

### 2.3 Commands / 2.4 Queries / 2.5 Excepciones

```typescript
export class RequestDocumentExaminationCommand { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) { if (!personId || !documentRef) throw new Error('person+document required'); } }
export class RequestDocumentReexaminationCommand { constructor(public readonly priorExaminationId: ExaminationId) {} }
export class ExamineDocumentExaminationCommand { constructor(public readonly examinationId: ExaminationId) { if (!examinationId) throw new Error('examination required'); } }
export class ExpireDocumentExaminationCommand { constructor(public readonly examinationId: ExaminationId, public readonly now: Date) {} }
export class GetExaminationStandingByPersonAndDocumentQuery { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) {} }
export class GetExaminationHistoryByPersonAndDocumentQuery { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) {} }
```

UC2 `examineDocument` viaja en `ExamineDocumentExaminationCommand{examinationId}` de primera clase (la dispara el worker tras `request`, sin intención de usuario de por medio — el comando nombra el trabajo pendiente, no una intención humana): extracción/comparación/veredicto se observan del ejecutor y se aplican vía `record*` en orquestación app-side. `record*` observado preserva el límite: el dominio juzga el pipeline, nunca ejecuta vendors. Push único `ExaminationConcludedEvent(MATCH)` (wire `eventName='ExaminationConcluded'`) → Biometric consume single-use + pull de standing. Excepciones puras: `ExaminationAlreadyOpenError`, `NoOpenExaminationError`, `ExaminationConcludedError`, `NoEligibleMembershipError` (R8, 403), `ContactNotAllowedError` (consent gate, 403) (+ `Object.setPrototypeOf`).

### 2.6 Eventos (7)

`ExaminationRequestedEvent` (person, docRef) · `ExaminationRefusedEvent` (reason) · `DocumentExtractedEvent` (readable, reason?) · `FacesComparedEvent` (holds) · `ExaminationConcludedEvent` (verdict) · `ExaminationExpiredEvent` (person) · `ReexaminationRequestedEvent` (priorId, newId). Ninguno lleva imágenes, retratos, artefactos, vendor ids ni scores. Wire `eventName` inalterado (`'ExaminationRequested'`, `'ExaminationRefused'`, `'DocumentExtracted'`, `'FacesCompared'`, `'ExaminationConcluded'`, `'ExaminationExpired'`, `'ReexaminationRequested'`).

```typescript
export class ExaminationConcludedEvent implements DomainEvent {
  static readonly eventName = 'ExaminationConcluded'; readonly eventName = ExaminationConcludedEvent.eventName; readonly occurredAt = new Date();
  constructor(public readonly examinationId: ExaminationId, public readonly verdict: Verdict) {}
}
```

### 2.7 Servicios de dominio + 2.8 Patrones

```typescript
export const EXAMINATION_COMMAND_SERVICE = Symbol('EXAMINATION_COMMAND_SERVICE');
export interface ExaminationCommandService {
  requestExamination(c: RequestDocumentExaminationCommand): Promise<ExaminationId>;
  requestReexamination(c: RequestDocumentReexaminationCommand): Promise<ExaminationId>;
  examineDocument(c: ExamineDocumentExaminationCommand): Promise<void>; // UC2 anchor
  expireExamination(c: ExpireDocumentExaminationCommand): Promise<void>;
}
export const EXAMINATION_QUERY_SERVICE = Symbol('EXAMINATION_QUERY_SERVICE');
export interface ExaminationQueryService {
  getStanding(q: GetExaminationStandingByPersonAndDocumentQuery): Promise<{ usableMatch: boolean }>;
  getHistory(q: GetExaminationHistoryByPersonAndDocumentQuery): Promise<DocumentExamination[]>;
}
```

Patrones: Aggregate Root + VOs + Commands/Queries como clases + repositorio como puerto en `domain/repositories` + eventos tipados con `eventName` estático. Intercambio de ejecutor = Strategy infra-side (Rekognition/GDocAI vía `OCR_EXECUTOR`), fuera del límite del dominio: el dominio nunca importa vendors, solo observa juicios `{readable, reason} / {holds}`.

---

<a name="application"></a>

## 3. Application Layer

Toda escritura en `uow.run()`; publish con `EventEmitter2` **después** del commit.

### 3.1 Command services

```typescript
@Injectable()
export class ExaminationCommandServiceImpl implements ExaminationCommandService {
  constructor(@Inject(EXAMINATION_REPOSITORY) private readonly exams: ExaminationRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork, private readonly emitter: EventEmitter2,
    @Inject(MEMBERSHIP_PORT) private readonly membership: ExternalMembershipService,
    @Inject(CONSENT_PORT) private readonly consent: ExternalConsentService,
    @Inject(EXECUTOR_PORT) private readonly executor: DocumentExecutorService) {}
  async requestExamination(cmd: RequestDocumentExaminationCommand): Promise<ExaminationId> {
    if (!(await this.membership.belongsToAnyCommunity(cmd.personId.value))) throw new NoEligibleMembershipError('person belongs nowhere');
    if (!(await this.consent.mayProcessNow(cmd.personId.value))) throw new ContactNotAllowedError('processing not allowed now');
    const open = await this.exams.findOpenByPersonAndDocument(cmd.personId, cmd.documentRef);
    if (open) { // el rechazo queda historial ANTES de lanzar: UoW propio para no morir con el throw
      const noted = await this.uow.run(async () => {
        open.noteRefused('DUPLICATE'); await this.exams.save(open); return open;
      });
      this.publish(noted);
      throw new ExaminationAlreadyOpenError('already OPEN');
    }
    const e = await this.uow.run(async () => {
      const x = DocumentExamination.request({ id: ExaminationId.generate(), personId: cmd.personId, documentRef: cmd.documentRef, window: ValidityWindow.now(30) });
      await this.exams.save(x); return x;
    });
    this.publish(e); return e.id;
  }
  async examineDocument(cmd: ExamineDocumentExaminationCommand): Promise<void> { // UC2 anchor
    const id = cmd.examinationId;
    const e = await this.uow.run(async () => {
      const x = await this.exams.findByIdOrThrow(id);
      const ext = await this.executor.observeExtraction(id.value); x.recordExtraction(ext.readable, ext.reason ? UnreadableReason.of(ext.reason) : null);
      if (!ext.readable) x.recordVerdict(Verdict.UNREADABLE);
      else { const cmp = await this.executor.observeComparison(id.value); x.recordComparison(cmp.holds); x.recordVerdict(cmp.holds ? Verdict.MATCH : Verdict.NO_MATCH); }
      await this.exams.save(x); return x;
    });
    this.publish(e);
  }
  async requestReexamination(cmd: RequestDocumentReexaminationCommand): Promise<ExaminationId> {
    const created = await this.uow.run(async () => {
      const prior = await this.exams.findByIdOrThrow(cmd.priorExaminationId); // el reexamen vincula al previo, nunca lo transiciona
      const x = prior.requestReexamination(ExaminationId.generate(), ValidityWindow.now(30));
      await this.exams.save(x); return x;
    });
    this.publish(created); return created.id;
  }
  async expireExamination(cmd: ExpireDocumentExaminationCommand): Promise<void> {
    const e = await this.uow.run(async () => {
      const x = await this.exams.findByIdOrThrow(cmd.examinationId);
      x.expire(cmd.now);
      await this.exams.save(x); return x;
    });
    this.publish(e);
  }
  private publish(e: DocumentExamination): void { for (const ev of e.pullDomainEvents()) this.emitter.emit(ev.eventName, ev); }
}
```

### 3.2 Query services

`getStanding` → `findOpen/findLatestConcluded` → `answerStanding()`; `getHistory` → `findAllByPersonAndDocument` ordenado. Solo lectura, sin mutación ni eventos.

### 3.3 Puertos de salida

```typescript
export const EXECUTOR_PORT = Symbol('EXECUTOR_PORT');
export interface DocumentExecutorService {
  observeExtraction(examinationId: string): Promise<{ readable: boolean; reason: string | null }>;
  observeComparison(examinationId: string): Promise<{ holds: boolean }>;
}
export const MEMBERSHIP_PORT = Symbol('MEMBERSHIP_PORT');
export interface ExternalMembershipService { belongsToAnyCommunity(personId: string): Promise<boolean>; }
export const CONSENT_PORT = Symbol('CONSENT_PORT');
export interface ExternalConsentService { mayProcessNow(personId: string): Promise<boolean>; }
```

Executor-first: mismo puerto, adaptadores Rekognition/GDocAI intercambiables; el vocabulario no cambia.

### 3.4 Handlers + 3.5 Facade ACL

`ExaminationEventLogger` (`@OnEvent(...eventName)`, exempto del renombre `<Stem>EventHandler` — logger genérico, no handler de un evento) solo observabilidad. Si otro BC necesita el `MATCH`, el handler in-module llama su facade (nunca `@OnEvent` cross-module). `OcrContextFacadeImpl` expone `answerUsableMatch()` + `consumeMatch()` (single-use: `markConsumed()` + `save` en UoW). Eventos observados como `ExaminationConcludedEvent` y demás (wire `eventName` inalterado).

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 Persistencia TypeORM

```typescript
@Entity('examinations')
export class ExaminationOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; @Column() personId: string; @Column() documentRef: string;
  @Column() standing: string; @Column({ nullable: true }) verdict: string | null;
  @Column({ default: false }) consumed: boolean; @Column() requestedAt: Date;
  @Column() ttlMinutes: number; @Column({ nullable: true }) unreadableReason: string | null;
}
```

`ExaminationRepositoryImpl` usa `TransactionContext.current ?? orm`; assembler con `parseExaminationStanding()/parseVerdict()/parseUnreadableReason()` vía `Object.values` (nunca `as`/`enum`); DTOs validan con `@IsIn(Object.values(...))`. Índice parcial `WHERE standing='OPEN'` en migración (§6).

### 4.2 Adaptadores ejecutor + 4.3 Módulo

`infrastructure/executor/rekognition/` y `.../gdoc-ai/` implementan `DocumentExecutorService` como Strategy infra-side; selección por `OCR_EXECUTOR` (default `rekognition`). Cambio = una línea en `providers`.

```typescript
@Module({ imports: [TypeOrmModule.forFeature([ExaminationOrmEntity])], controllers: [ExaminationController],
  providers: [ExaminationPersistenceAssembler,
    { provide: EXAMINATION_REPOSITORY, useClass: ExaminationRepositoryImpl },
    { provide: EXAMINATION_COMMAND_SERVICE, useClass: ExaminationCommandServiceImpl },
    { provide: EXAMINATION_QUERY_SERVICE, useClass: ExaminationQueryServiceImpl },
    { provide: EXECUTOR_PORT, useClass: RekognitionExecutorService },
    { provide: OCR_CONTEXT_FACADE, useClass: OcrContextFacadeImpl },
    ExternalMembershipService, ExternalConsentService, // ACL → MEMBERSHIP_CONTEXT_FACADE / CONSENT_CONTEXT_FACADE (módulos importados)
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork }],
  exports: [OCR_CONTEXT_FACADE] })
export class DocumentOcrFaceMatchProviderModule {}
```

---

<a name="interfaces"></a>

## 5. Interfaces Layer

### 5.1 Controller

| Método | Endpoint | Uso |
|:--|:--|:--|
| `POST` | `/api/v1/examinations` | `RequestDocumentExaminationCommand` → 201 + `Location` |
| `POST` | `/api/v1/examinations/:id/reexaminations` | Nuevo ID vinculado al previo |
| `POST` | `/api/v1/examinations/:id/examine` | UC2 anchor |
| `GET` | `/api/v1/examinations/standing?personId=&documentRef=` | `GetExaminationStandingByPersonAndDocumentQuery` |
| `GET` | `/api/v1/examinations/history?personId=&documentRef=` | `GetExaminationHistoryByPersonAndDocumentQuery` |

Delgado: Resource → assembler → comando (token) → relectura query → Resource. `ValidationPipe` global + `@UseFilters(ExaminationExceptionFilter)`.

### 5.2 ACL + 5.3 Resources + 5.4 Assemblers + 5.5 Filtros

```typescript
export const OCR_CONTEXT_FACADE = Symbol('OCR_CONTEXT_FACADE');
export interface OcrContextFacade {
  answerUsableMatch(personId: string, documentRef: string): Promise<{ usableMatch: boolean }>;
  consumeMatch(personId: string, documentRef: string): Promise<boolean>; // single-use
}
```

DTOs con `class-validator` (nunca VOs): `RequestExaminationResource{personId,documentRef}`, `ExaminationResource{id,standing,verdict,consumed}`, `ExaminationStandingResource{usableMatch}`, `ExaminationHistoryResource{items}`. Assemblers envuelven (`PersonId.of`) / desenvuelven (`.value`). Filtro: `AlreadyOpen→409`, `NoOpen→404`, `Concluded→422`, `NoEligibleMembership→403`, `ContactNotAllowed→403`.

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Esquema `ocr`, tabla `examinations`. Sin blobs: la evidencia muere con el examen.

| Columna | Tipo | Restricción |
|:--|:--|:--|
| `id` | `VARCHAR(64)` PK | `exm-`+UUID |
| `person_id` / `document_ref` | `VARCHAR(64/128)` NOT NULL | Referencias IAM/documento |
| `standing` | `VARCHAR(16)` NOT NULL | `OPEN/CONCLUDED/EXPIRED` |
| `verdict` | `VARCHAR(16)` NULL | `MATCH/NO_MATCH/UNREADABLE` |
| `consumed` | `BOOLEAN` DEFAULT FALSE | Single-use MATCH |
| `requested_at` / `ttl_minutes` | `TIMESTAMPTZ` / `INT` | Ventana de validez |
| `unreadable_reason` | `VARCHAR(32)` NULL | Razón cerrada (5) |
| `created_at/updated_at` | `TIMESTAMPTZ` | Auditoría |

```sql
CREATE SCHEMA IF NOT EXISTS ocr;
CREATE TABLE ocr.examinations (id VARCHAR(64) PRIMARY KEY, person_id VARCHAR(64) NOT NULL,
  document_ref VARCHAR(128) NOT NULL, standing VARCHAR(16) NOT NULL, verdict VARCHAR(16),
  consumed BOOLEAN NOT NULL DEFAULT FALSE, requested_at TIMESTAMPTZ NOT NULL, ttl_minutes INT NOT NULL,
  unreadable_reason VARCHAR(32), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_open_exam ON ocr.examinations (person_id, document_ref) WHERE standing = 'OPEN';
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

**UC1 Request:** `POST` → `belongsToAnyCommunity?` (R8) + `mayProcessNow?` → `findOpen` (doble → `noteRefused('DUPLICATE')` + publish + 409) → `request()` → `save` (UoW) → publish post-commit → 201.
**UC2 ExamineDocument (anchor):** `examine(id)` → assert OPEN+ventana → `observeExtraction→recordExtraction` → si ilegible `recordVerdict(UNREADABLE)`; si legible `observeComparison→recordComparison→recordVerdict(MATCH|NO_MATCH)` → `save` → publish → push único `ExaminationConcludedEvent(MATCH)` consumible vía facade (R7, una vez) + pull `answerUsableMatch/consumeMatch`. Comparar sin lectura limpia o veredicto tardío se rechaza.
**UC3 Expire / UC4 Reexamen / UC5 Standing:** sweep `findOpenExpired→expire→ExaminationExpiredEvent` (wire `'ExaminationExpired'`); reexamen solo si previo terminal (`requestReexamination(newId)` + `ReexaminationRequestedEvent` + `ExaminationRequestedEvent`); standing = query → `answerStanding()`, sin evento.

---

<a name="integracion"></a>

## 8. Integración con otros BCs

| Dirección | Relación | Mecanismo |
|:--|:--|:--|
| OCR → Biometric (R7 Customer/Supplier) | `ExaminationConcludedEvent(MATCH)` (wire `'ExaminationConcluded'`) + `consumeMatch` | ACL single-use; nada image-like cruza |
| Membership → OCR (R8 Conformist) | `belongsToAnyCommunity` | Precondición UC1/UC4; `NoEligibleMembership` |
| Consent → OCR | `mayProcessNow` | Gate UC1/UC4; `ContactNotAllowed` |
| IAM → OCR | Existencia persona | Referencia por identidad |
| Ejecutor → OCR | Executor-first | Puerto `DocumentExecutorService` |

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Dependencia | Puerto | Adaptador |
|:--|:--|:--|
| Ejecutor OCR/face | `DocumentExecutorService` | `Rekognition...` / `GdocAi...` (intercambiables) |
| Membership R8 | `ExternalMembershipService` | Facade Membership (conformist) |
| Consent | `ExternalConsentService` | Facade Consent |
| Bus | `EventEmitter2` | `EventEmitterModule.forRoot()` solo en `AppModule` |
| Persistencia | `ExaminationRepository`, `IUnitOfWork` | `...Impl`, `TypeOrmUnitOfWork` (AsyncLocalStorage) |
| Ciclos OCR↔Biometric/Membership | `forwardRef(() => ...)` en ambos lados | OCR consume Membership facade y Biometric consume OCR facade (R7); sin forwardRef Nest no arranca |

---

<a name="auditoria"></a>

## 10. Auditoría y Correcciones Aplicadas

| # | Sev. | Hallazgo | Corrección |
|:--|:--|:--|:--|
| D1 | Alta | Extracción/comparación como agregados separados | Un solo `DocumentExamination`; evidencia transitoria |
| D2 | Media | Veredicto re-preguntable | `consumed` + `consumeMatch()` single-use |
| D3 | Media | Imágenes en eventos/DB | Prohibidas; juicios + razón cerrada |
| D4 | Media | `as` cast de enums | Parsers explícitos |
| D5 | Baja | Publish dentro de `uow.run()` | Publish solo tras commit |
| D6 | Baja | `@OnEvent` cross-BC | Handler in-module + ACL |
| D7 | Baja | Composite para facetas H4 | No aplica: facetas H4 son estados del único examen; evidencia muere, nada que componer |
| D8 | Baja | Nomenclatura ddd-guideliness v1.0.7 | Enums → as const + type union + parser `Object.values` + `@IsIn` (`ExaminationStanding`, `Verdict`, `UnreadableReason`); 7 eventos → sufijo `Event` (wire `eventName` inalterado); 4 comandos ambiguos → `RequestDocumentExaminationCommand`, `RequestDocumentReexaminationCommand`, `ExamineDocumentExaminationCommand`, `ExpireDocumentExaminationCommand`; `ExaminationEventLogger` exempto de `<Stem>EventHandler` |

> Override proyecto (skill ddd-guideliness v1.0.7, CHANGELOG líneas 7-18): closed sets como `as const` (sin enum clásico ni `@IsEnum`); comandos `Action+Target+Command`, queries `Action+Target+Criteria+Query`, eventos `Target+PastAction` + sufijo `Event` solo en clase (wire inalterado), handlers `<EventName>EventHandler` — `ExaminationEventLogger` exempto por ser logger genérico.

**Preguntas abiertas:** ninguna bloqueante (veredicto single-use, reexamen ilimitado con IDs frescos, nada retenido, 5 razones, swap neutro — todo resuelto en storming).

```properties
ocr.window.ttl-minutes=${OCR_TTL_MINUTES:30}
ocr.executor=${OCR_EXECUTOR:rekognition}
```
