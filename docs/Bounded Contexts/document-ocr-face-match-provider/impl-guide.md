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
├── domain/model/commands/ (request-examination, request-reexamination, expire-examination)
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
export enum ExaminationStanding { OPEN = 'OPEN', CONCLUDED = 'CONCLUDED', EXPIRED = 'EXPIRED' }
export enum Verdict { MATCH = 'MATCH', NO_MATCH = 'NO_MATCH', UNREADABLE = 'UNREADABLE' }
export class DocumentExamination extends AggregateRoot {
  private constructor(private readonly _id: ExaminationId, private readonly _personId: PersonId,
    private readonly _documentRef: DocumentRef, private _standing: ExaminationStanding,
    private readonly _window: ValidityWindow, private _verdict: Verdict | null = null,
    private _consumed = false, private _extracted = false, private _compared = false) { super(); }
  static request(i: { id: ExaminationId; personId: PersonId; documentRef: DocumentRef; window: ValidityWindow }): DocumentExamination {
    const e = new DocumentExamination(i.id, i.personId, i.documentRef, ExaminationStanding.OPEN, i.window);
    e.registerEvent(new ExaminationRequested(e._id, e._personId, e._documentRef)); return e;
  }
  static rehydrate(i: { id: ExaminationId; personId: PersonId; documentRef: DocumentRef; standing: ExaminationStanding; window: ValidityWindow; verdict: Verdict | null; consumed: boolean; extracted: boolean; compared: boolean }): DocumentExamination {
    return new DocumentExamination(i.id, i.personId, i.documentRef, i.standing, i.window, i.verdict, i.consumed, i.extracted, i.compared);
  }
  recordExtraction(readable: boolean, reason: UnreadableReason | null): void {
    this.assertOpen(); this._extracted = true;
    this.registerEvent(new DocumentExtracted(this._id, readable, reason));
  }
  recordComparison(holds: boolean): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('comparison without clean read');
    this._compared = true; this.registerEvent(new FacesCompared(this._id, holds));
  }
  recordVerdict(v: Verdict): void {
    this.assertOpen();
    if (!this._extracted) throw new NoOpenExaminationError('verdict without extraction');
    this._verdict = v; this._standing = ExaminationStanding.CONCLUDED;
    this.registerEvent(new ExaminationConcluded(this._id, v));
  }
  noteRefused(reason: string): void {
    this.assertOpen();
    this.registerEvent(new ExaminationRefused(this._id, this._personId, reason)); // DUPLICATE: historia sin transición
  }
  expire(now: Date): void {
    if (this._standing !== ExaminationStanding.OPEN) return;
    if (!this._window.isElapsed(now)) throw new ExaminationConcludedError('window still answerable');
    this._standing = ExaminationStanding.EXPIRED;
    this.registerEvent(new ExaminationExpired(this._id, this._personId));
  }
  requestReexamination(newId: ExaminationId, w: ValidityWindow): DocumentExamination {
    if (this._standing === ExaminationStanding.OPEN) throw new ExaminationAlreadyOpenError('one OPEN per person+doc');
    const f = new DocumentExamination(newId, this._personId, this._documentRef, ExaminationStanding.OPEN, w);
    f.registerEvent(new ReexaminationRequested(this._id, newId)); return f;
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
| `ExaminationStanding` / `Verdict` (enum + `parseX()`, nunca `as`) | Sets cerrados |
| `UnreadableReason` (5: `BLURRY, GLARE, CROPPED, EXPIRED, MISMATCHED_TYPE`) | Cerrado en 5 |
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
export class RequestExaminationCommand { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) { if (!personId || !documentRef) throw new Error('person+document required'); } }
export class RequestReexaminationCommand { constructor(public readonly priorExaminationId: ExaminationId) {} }
export class ExamineDocumentCommand { constructor(public readonly examinationId: ExaminationId) { if (!examinationId) throw new Error('examination required'); } }
export class ExpireExaminationCommand { constructor(public readonly examinationId: ExaminationId, public readonly now: Date) {} }
export class GetExaminationStandingByPersonAndDocumentQuery { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) {} }
export class GetExaminationHistoryByPersonAndDocumentQuery { constructor(public readonly personId: PersonId, public readonly documentRef: DocumentRef) {} }
```

UC2 `examineDocument` viaja en `ExamineDocumentCommand{examinationId}` de primera clase (la dispara el worker tras `request`, sin intención de usuario de por medio — el comando nombra el trabajo pendiente, no una intención humana): extracción/comparación/veredicto se observan del ejecutor y se aplican vía `record*` en orquestación app-side. `record*` observado preserva el límite: el dominio juzga el pipeline, nunca ejecuta vendors. Push único `ExaminationConcluded(MATCH)` → Biometric consume single-use + pull de standing. Excepciones puras: `ExaminationAlreadyOpenError`, `NoOpenExaminationError`, `ExaminationConcludedError`, `NoEligibleMembershipError` (R8, 403), `ContactNotAllowedError` (consent gate, 403) (+ `Object.setPrototypeOf`).

### 2.6 Eventos (7)

`ExaminationRequested` (person, docRef) · `ExaminationRefused` (reason) · `DocumentExtracted` (readable, reason?) · `FacesCompared` (holds) · `ExaminationConcluded` (verdict) · `ExaminationExpired` (person) · `ReexaminationRequested` (priorId, newId). Ninguno lleva imágenes, retratos, artefactos, vendor ids ni scores.

```typescript
export class ExaminationConcluded implements DomainEvent {
  static readonly eventName = 'ExaminationConcluded'; readonly eventName = ExaminationConcluded.eventName; readonly occurredAt = new Date();
  constructor(public readonly examinationId: ExaminationId, public readonly verdict: Verdict) {}
}
```

### 2.7 Servicios de dominio + 2.8 Patrones

```typescript
export const EXAMINATION_COMMAND_SERVICE = Symbol('EXAMINATION_COMMAND_SERVICE');
export interface ExaminationCommandService {
  requestExamination(c: RequestExaminationCommand): Promise<ExaminationId>;
  requestReexamination(c: RequestReexaminationCommand): Promise<ExaminationId>;
  examineDocument(c: ExamineDocumentCommand): Promise<void>; // UC2 anchor
  expireExamination(c: ExpireExaminationCommand): Promise<void>;
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
  async requestExamination(cmd: RequestExaminationCommand): Promise<ExaminationId> {
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
  async examineDocument(cmd: ExamineDocumentCommand): Promise<void> { // UC2 anchor
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
  async requestReexamination(cmd: RequestReexaminationCommand): Promise<ExaminationId> {
    const created = await this.uow.run(async () => {
      const prior = await this.exams.findByIdOrThrow(cmd.priorExaminationId); // el reexamen vincula al previo, nunca lo transiciona
      const x = prior.requestReexamination(ExaminationId.generate(), ValidityWindow.now(30));
      await this.exams.save(x); return x;
    });
    this.publish(created); return created.id;
  }
  async expireExamination(cmd: ExpireExaminationCommand): Promise<void> {
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

`ExaminationEventLogger` (`@OnEvent(...eventName)`) solo observabilidad. Si otro BC necesita el `MATCH`, el handler in-module llama su facade (nunca `@OnEvent` cross-module). `OcrContextFacadeImpl` expone `answerUsableMatch()` + `consumeMatch()` (single-use: `markConsumed()` + `save` en UoW).

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

`ExaminationRepositoryImpl` usa `TransactionContext.current ?? orm`; assembler con `parseExaminationStanding/parseVerdict/parseUnreadableReason` (nunca `as`). Índice parcial `WHERE standing='OPEN'` en migración (§6).

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
| `POST` | `/api/v1/examinations` | `RequestExaminationCommand` → 201 + `Location` |
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
**UC2 ExamineDocument (anchor):** `examine(id)` → assert OPEN+ventana → `observeExtraction→recordExtraction` → si ilegible `recordVerdict(UNREADABLE)`; si legible `observeComparison→recordComparison→recordVerdict(MATCH|NO_MATCH)` → `save` → publish → push único `Concluded(MATCH)` consumible vía facade (R7, una vez) + pull `answerUsableMatch/consumeMatch`. Comparar sin lectura limpia o veredicto tardío se rechaza.
**UC3 Expire / UC4 Reexamen / UC5 Standing:** sweep `findOpenExpired→expire→ExaminationExpired`; reexamen solo si previo terminal (`requestReexamination(newId)` + `ReexaminationRequested` + `ExaminationRequested`); standing = query → `answerStanding()`, sin evento.

---

<a name="integracion"></a>

## 8. Integración con otros BCs

| Dirección | Relación | Mecanismo |
|:--|:--|:--|
| OCR → Biometric (R7 Customer/Supplier) | `ExaminationConcluded(MATCH)` + `consumeMatch` | ACL single-use; nada image-like cruza |
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

**Preguntas abiertas:** ninguna bloqueante (veredicto single-use, reexamen ilimitado con IDs frescos, nada retenido, 5 razones, swap neutro — todo resuelto en storming).

```properties
ocr.window.ttl-minutes=${OCR_TTL_MINUTES:30}
ocr.executor=${OCR_EXECUTOR:rekognition}
```
