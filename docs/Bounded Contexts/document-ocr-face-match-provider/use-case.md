---
title: "Application Layer — Document OCR & Face Match Provider"
layer: "application"
bounded-context: "document-ocr-face-match-provider"
last-reviewed: "2026-09-08"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Document OCR & Face Match Provider — Application Layer

This document describes **orchestration**, not business meaning. It answers: in what
order do things happen, who calls whom, and what crosses this bounded context's
boundary to judge one document evidence. It names no framework, transport, or storage
— same discipline as `domain-model.md`.

Source of business meaning: `domain-model.md` (this same folder). This document adds
nothing new to *what the aggregate can do*; it only sequences calls to the aggregate
and to other bounded contexts, per the rules already frozen in `context-mapping.md`.

A use case here is triggered either by an external request (synchronous) or by a fact
this context reacts to (event-driven). Both are documented the same way.

Naming convention (frozen for all `use-case.md` documents): commands are
`Action+Target+Command` (e.g. `CreateOrderCommand`), events are
`Target+PastAction+Event` (e.g. `OrderCreatedEvent`), queries are
`Action+Target+Criteria+Query` (e.g. `GetOrderByIdQuery`). A query name may grow
whenever the criteria need declaring.

> This context judges **document evidence** once: does this document read, and does
> this face hold against its portrait? A live person against a lasting reference
> belongs to Biometric Identity Verification — the two are never confused here.
> Extraction, comparison math, and image handling are executed outside
> (executor-first, locked decision): this context judges standing and owns the verdict.

---

## 1. Use Case Catalog

| # | Use Case | Trigger | Aggregates Touched | External BCs Consulted | Facts Produced |
|---|----------|---------|--------------------|-------------------------|-----------------|
| UC1 | RequestExamination | Person request (via onboarding) with a document | `DocumentExamination` | Membership (belongs to ≥1 community?), Consent & Compliance (processing allowed?) | `ExaminationRequestedEvent` — or `ExaminationRefusedEvent` (precondition fails) |
| UC2 | **ExamineDocument** (anchor) | Follows an open examination: extract → compare → verdict | `DocumentExamination` | External executor (extraction / comparison observed) | `DocumentExtractedEvent`, `FacesComparedEvent`, `ExaminationConcludedEvent` (verdict `MATCH` / `NO_MATCH` / `UNREADABLE`) |
| UC3 | ExpireExamination | Time sweep (validity window elapsed) | `DocumentExamination` | — | `ExaminationExpiredEvent` |
| UC4 | RequestReexamination | Person request after `UNREADABLE` / `NO_MATCH` / expiry | `DocumentExamination` | Same preconditions as UC1 | `ReexaminationRequestedEvent`, then `ExaminationRequestedEvent` (fresh identity, linked to prior) |
| UC5 | AnswerExaminationStanding | Biometric enrollment asks for a usable `MATCH` | `DocumentExamination` (answering operation only) | — | — (synchronous answer, no fact) |

UC2 is detailed fully below because the extract → compare → single-use-verdict
ordering with evidence-dying-at-verdict is the orchestration most likely to be gotten
wrong (comparing without a clean read, re-asking a consumed verdict, or keeping
artifacts). This context holds a single aggregate, so there is no second
multi-aggregate sequence to detail.

---

## 2. Commands & Queries Accepted (Input Contracts)

These are the intentions this bounded context accepts from outside — not to be
confused with the aggregate operations in `domain-model.md`, which are internal.

### Commands

| Command | Carries | Handled By |
|---------|---------|------------|
| `RequestDocumentExaminationCommand` | personId, document reference | UC1 |
| `RequestDocumentReexaminationCommand` | prior examinationId | UC4 (opens a fresh examination linked to the prior) |
| `ExpireDocumentExaminationCommand` | examinationId | UC3 (time-triggered sweep) |

UC2's steps (extraction, comparison, verdict) proceed on observed executor results
inside the examination journey via `recordExtraction()` / `recordComparison()` /
`recordVerdict()` — not on separate external commands, same treatment as Relay's
outcome recording.

### Queries

| Query | Returns | Backing Read Need (domain-model.md) |
|-------|---------|--------------------------------------|
| `GetExaminationStandingByPersonAndDocumentQuery` | Usable `MATCH` now? | "Examination standing" |
| `GetExaminationHistoryByPersonAndDocumentQuery` | What was requested, extracted, compared, and concluded, in order | "Examination history (scrutiny)" |

UC5 is served by the aggregate's answering operation `answerExaminationStanding()` —
it judges the verdict and answers; it mutates nothing and produces no fact. A `MATCH`
is consumed once by Biometric enrollment through this answer — never re-asked.

---

## 3. Use Case Detail — UC2: ExamineDocument (anchor)

### Preconditions

| # | Precondition | Checked Against |
|---|---------------|------------------|
| 1 | Examination is `OPEN` (UC1 already gated belonging + opt-in + no-double-open) | `DocumentExamination` |
| 2 | Examination is within its validity window | `DocumentExamination.window` |
| 3 | Extraction and comparison are observed from the external executor — judged here, never performed here | External executor |

### Sequence

```mermaid
sequenceDiagram
    participant OCR as Document OCR BC
    participant Executor as External Executor
    participant BIO as Biometric BC

    OCR->>Executor: extraction observed for the open examination
    Executor-->>OCR: readable (+ identity data) / unreadable + reason
    OCR->>OCR: recordExtraction() → DocumentExtractedEvent
    alt readable
        OCR->>Executor: comparison observed (portrait vs face)
        Executor-->>OCR: holds / does not hold
        OCR->>OCR: recordComparison() → FacesComparedEvent
        OCR->>OCR: recordVerdict() → ExaminationConcludedEvent (MATCH / NO_MATCH)
        alt MATCH
            OCR-->>BIO: usable MATCH via UC5 [R7 — Customer/Supplier]
            Note over OCR: Consumed once by Biometric enrollment;<br/>evidence dies with the examination
        else NO_MATCH
            Note over OCR: Closes without reference;<br/>only a fresh request reopens
        end
    else unreadable (closed reason of 5)
        OCR->>OCR: recordVerdict() → ExaminationConcludedEvent (UNREADABLE)
        Note over OCR: Fresh reexamination may follow (UC4, unbounded)
    end
```

### Steps (Business Language)

| Step | Action | Facts / Failure |
|------|--------|------------------|
| 1 | Confirm the examination is `OPEN` and within its window | Otherwise: `NoOpenExamination` / `AlreadyConcluded` — evidence arriving late is refused, never applied |
| 2 | Observe the extraction result; `recordExtraction()` | `DocumentExtractedEvent` — readable, or unreadable with the closed reason (blurry, glare-covered, cropped, expired, mismatched document type) |
| 3 | On unreadable: `recordVerdict()` concludes `UNREADABLE` — no comparison is ever asked | `ExaminationConcludedEvent` (`UNREADABLE`); UC4 may follow |
| 4 | On readable: observe the comparison; `recordComparison()` | `FacesComparedEvent` (holds / does not hold) — comparison without a clean read is refused |
| 5 | `recordVerdict()` — freezes the single judgment on this examination | `ExaminationConcludedEvent` (`MATCH` / `NO_MATCH`) |
| 6 | On `MATCH`: Biometric enrollment consumes the verdict once through UC5 (R7) | The lasting reference lives in Biometric; nothing image-like crosses — evidence dies with the examination (invariant 4) |

### What This Use Case Does *Not* Do

- Does not prove a live person or keep a lasting reference (Biometric's concern — this context judges evidence once and lets it die).
- Does not carry images, portraits, comparison artifacts, vendor identifiers, or scores in any fact (judgments and closed reasons only).
- Does not judge belonging or opt-in (Membership and Consent own those — gated once at UC1, not re-checked here).
- Does not reopen concluded examinations (reexamination is always a fresh identity linked to the prior — never a transition).

### Concurrency & Idempotency

- Evidence or verdicts arriving for a non-`OPEN` examination are refused
  (`NoOpenExamination` / `AlreadyConcluded`) — a late executor result never reopens or
  edits a concluded examination.
- A second `RequestDocumentExaminationCommand` for the same (person, document) while one is
  `OPEN` is refused (`ExaminationAlreadyOpen`) — examinations are never doubled; the
  retry path is UC4 after conclusion, not a parallel examination.
- A consumed `MATCH` is never answered again: Biometric consumes through UC5 once; a
  second ask finds no usable verdict and must start from a fresh examination.

### Open Orchestration Questions

- None remaining — all workshop questions resolved during storming (domain-model.md:
  single-use verdict, unbounded reexamination as new examinations, nothing kept).

---

## 4. ACL Published (What This BC Exposes)

| Capability | Consumer (per context-mapping.md) | Notes |
|---|---|---|
| `ExaminationConcludedEvent` with `MATCH` | Biometric enrollment (R7) | Crosses once, single-use, seeds the lasting reference — nothing image-like crosses |
| Examination standing answer (`answerExaminationStanding()`, UC5) | Biometric enrollment | Usable `MATCH` now? — asked once at reference-seeding time |

## 5. ACL Consumed (What This BC Depends On)

| Dependency | Pattern (context-mapping.md) | Used In |
|---|---|---|
| Membership → OCR (belongs to ≥1 community?) | Conformist (R8) | UC1, UC4 — belonging answered outside; refused with `NoEligibleMembership` when the person belongs nowhere |
| Consent & Compliance → OCR (processing allowed?) | Partnership / coordination | UC1, UC4 — opt-in judged where consent lives |
| External executor → OCR (extraction / comparison observed) | Executor-first | UC2 — executed outside (interchangeable paths), judged and recorded here |
| IAM → OCR (person existence) | Identity reference | UC1 — an examination belongs to exactly one known person |

Every row here is a consequence of a relationship already frozen in
`context-mapping.md` — this table only says *which use case* is the one that actually
makes the call.

---

## Related Documentation

| Document | Link |
|----------|------|
| Domain model (source of aggregate behavior) | `domain-model.md` |
| Event Storming | `event-storming.md` |
| Context map + relationship catalog (source of R1–R14) | `context-mapping.md` |
| Consolidated ubiquitous language | `ubiquitous-language.md` |
