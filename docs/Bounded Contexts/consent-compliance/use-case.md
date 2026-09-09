---
title: "Application Layer — Consent & Compliance"
layer: "application"
bounded-context: "consent-compliance"
last-reviewed: "2026-09-08"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Consent & Compliance — Application Layer

This document describes **orchestration**, not business meaning. It answers: in what
order do things happen, who calls whom, and what crosses this bounded context's
boundary to grant one consent or erase one person's data. It names no framework,
transport, or storage — same discipline as `domain-model.md`.

Source of business meaning: `domain-model.md` (this same folder). This document adds
nothing new to *what the aggregates can do*; it only sequences calls to aggregates and
to other bounded contexts, per the rules already frozen in `context-mapping.md`.

A use case here is triggered either by an external request (synchronous) or by a fact
this context reacts to (event-driven). Both are documented the same way.

Naming convention (frozen for all `use-case.md` documents): commands are
`Action+Target+Command` (e.g. `CreateOrderCommand`), events are
`Target+PastAction+Event` (e.g. `OrderCreatedEvent`), queries are
`Action+Target+Criteria+Query` (e.g. `GetOrderByIdQuery`). A query name may grow
whenever the criteria need declaring.

> This context records consent and coordinates erasure. It never owns other contexts'
> personal data: each owning context deletes its own data when coordinated — this
> context records asks and confirmations only.

---

## 1. Use Case Catalog

| # | Use Case | Trigger | Aggregates Touched | External BCs Consulted | Facts Produced |
|---|----------|---------|--------------------|-------------------------|-----------------|
| UC1 | GrantConsent | Person request for one scope under one policy version | `ConsentRecord` | IAM (person existence) | `ConsentGrantedEvent` |
| UC2 | RevokeConsent | Person withdraws one scope | `ConsentRecord` | — | `ConsentRevokedEvent` (processing under it stops from that moment) |
| UC3 | DefineRetentionPolicy | Compliance steward request | `RetentionPolicy` | — | `RetentionPolicyDefinedEvent` (supersedes the previous) |
| UC4 | SubmitErasureRequest | Person request (Law 29733) | `DataSubjectRequest` | IAM (person existence) | `ErasureRequestedEvent` |
| UC5 | ConfirmErasureRequest | Compliance steward confirms validity | `DataSubjectRequest` | — | `ErasureConfirmedEvent` |
| UC6 | **CoordinateErasure** (anchor) | Follows confirmation: ask every owner → collect confirmations → complete | `DataSubjectRequest` | Every owning context holding this person's data (Biometric, Wallet, Membership, Notifications, …) | `RevocationCoordinatedEvent` (one per owner), `RevocationConfirmedEvent` (one per owner), `ErasureCompleteEvent` |
| UC7 | AnswerConsentState | Biometric / Notifications / OTP / OCR gate check | `ConsentRecord` (answering operation only) | — | — (synchronous answer, no fact) |

UC6 is detailed fully below because the coordinate-every-owner → complete-only-when-all-confirm
ordering is the orchestration most likely to be gotten wrong (executing others' deletion here,
or closing while an owner is still pending). UC7 gets a second sequence because it is the
flow every gated context depends on — and the one where "stops from this moment, never rewrites
the past" is most likely to be misread.

---

## 2. Commands & Queries Accepted (Input Contracts)

These are the intentions this bounded context accepts from outside — not to be
confused with the aggregate operations in `domain-model.md`, which are internal.

### Commands

| Command | Carries | Handled By |
|---------|---------|------------|
| `GrantConsentCommand` | personId, scope, policy version | UC1 |
| `RevokeConsentCommand` | personId, scope | UC2 |
| `DefineRetentionPolicyCommand` | data category, terms | UC3 |
| `SubmitErasureRequestCommand` | personId | UC4 |
| `ConfirmErasureRequestCommand` | requestId | UC5 |
| `RecordRevocationConfirmationCommand` | requestId, owning context | UC6 (one confirmation per coordinated owner, from that owner) |

UC6's coordination (`coordinateRevocation()`) and completion (`complete()`) are
triggered by the erasure flow itself — coordination follows confirmation, completion
follows the last pending confirmation — not by separate external commands.

### Queries

| Query | Returns | Backing Read Need (domain-model.md) |
|-------|---------|--------------------------------------|
| `GetConsentStateByPersonAndScopeQuery` | Granted or not, under which policy version, since when | "Current consent per (person, scope)" |
| `GetErasureStandingByPersonQuery` | Standing plus, while waiting, which owners confirmed and which are pending | "Erasure request standing" |
| `GetRetentionTermsByCategoryQuery` | Current terms plus superseded history | "Retention rule per data category" |
| `GetAuditTrailByPersonQuery` | The grant → revoke → request → coordination → confirmation chain | "Audit trail (scrutiny)" |

UC7 is served by the record's answering operation `answerState()` — it judges the
grant and answers; it mutates nothing and produces no fact.

---

## 3. Use Case Detail — UC6: CoordinateErasure (anchor)

### Preconditions

| # | Precondition | Checked Against |
|---|---------------|------------------|
| 1 | Request is `CONFIRMED` (merely requested coordinates nothing) | `DataSubjectRequest` |
| 2 | The owning contexts holding this person's data are known | Coordination list (one fact per owner) |
| 3 | No owner is skipped and no confirmation is invented: one ask → one confirmation per owner | `DataSubjectRequest.confirmations` |

### Sequence

```mermaid
sequenceDiagram
    participant Flow as Erasure Flow
    participant CON as Consent & Compliance BC
    participant Owner as Each Owning BC<br/>(Biometric / Wallet / Membership / Notifications / …)

    Flow->>CON: confirmed → coordinateRevocation()
    loop one per owning context
        CON->>CON: RevocationCoordinatedEvent (request, person, owner)
        CON->>Owner: revoke your own data for this person
        Note over Owner: Each owner deletes its own data;<br/>this context never touches it
        Owner-->>CON: RecordRevocationConfirmationCommand(requestId, owner)
        CON->>CON: recordConfirmation() → RevocationConfirmedEvent
    end
    CON->>CON: every coordinated owner confirmed? → complete()
    CON->>CON: ErasureCompleteEvent (terminal; audit trail stays)
    CON-->>Flow: person notice via Notifications
```

### Steps (Business Language)

| Step | Action | Facts / Failure |
|------|--------|------------------|
| 1 | Confirm the request is `CONFIRMED` — a merely `REQUESTED` erasure asks nothing of anyone | Otherwise: `ErasureNotConfirmed` |
| 2 | `coordinateRevocation()` — one coordination fact per owning context holding this person's data | `RevocationCoordinatedEvent` per owner; the request now visibly waits (`AWAITING_CONFIRMATIONS`) |
| 3 | Each owner ends use and deletes its own data, then confirms back | `RecordRevocationConfirmationCommand` per owner → `RevocationConfirmedEvent` |
| 4 | Confirmations from contexts never coordinated for this request are refused | `UnknownOwnerConfirmation` — only asked owners can answer |
| 5 | `complete()` — only when every coordinated owner confirmed | `ErasureCompleteEvent`; partial completion is unrepresentable (`ErasureIncomplete` otherwise) |
| 6 | The grant → revoke → request → coordination → confirmation chain stays as an uneditable audit trail | History never rewritten — completion closes the request, never the past |

### What This Use Case Does *Not* Do

- Does not delete other contexts' data (each owner deletes its own — this context records asks and confirmations only, invariant 6).
- Does not complete while any owner is pending (no partial completion, no timeout-completion — the request waits, visibly naming who is pending).
- Does not rewrite the period when consent stood (revocation and erasure stop processing from their moment; past grants stay history).
- Does not let retention overrule a confirmed erasure (deletion wins unless a legal hold is recorded with reason — default, needs legal confirmation).

### Concurrency & Idempotency

- Two confirmations from the same owner record once: the second finds its confirmation
  already recorded and is ignored — one owner, one confirmation.
- A completion racing a still-pending owner fails (`ErasureIncomplete`): completion is
  only meaningful when the pending set is empty, checked at the completion's own moment.
- A second erasure request for the same person while one is open is refused
  (`ErasureAlreadyOpen`) — one open request per person; scopes already revoked stay revoked.

### Open Orchestration Questions

- Who confirms an erasure request, and on what grounds it may be refused — legal hold,
  in-flight vote (domain-model.md, Open Question #2) — needs product + legal.
- Retention vs erasure under a legal hold: form of the hold, who records it, expiry
  (Open Question #3) — needs legal.
- In-flight votes at erasure time: history stays or erasure waits (Open Question #4) —
  needs product + legal.

---

## 4. Use Case Detail — UC7: AnswerConsentState

Second sequence: the gate every processing context depends on.

```mermaid
sequenceDiagram
    participant Gate as Gated BC<br/>(Biometric / Notifications / OTP / OCR)
    participant CON as Consent & Compliance BC

    Gate->>CON: may-process-now? (personId, scope)
    CON->>CON: ConsentRecord.answerState() — GRANTED now?
    alt granted under its policy version
        CON-->>Gate: granted — processing may run
    else revoked or never granted
        CON-->>Gate: refused (ConsentNotGranted) — processing must not run
    end
    Note over Gate: Revocation stops processing from that moment;<br/>the period when consent stood stays history
```

No grant, no processing: Biometric runs only while `BIOMETRIC_PROCESSING` stands,
Notifications only while its contact scope stands. A revoked scope refuses from that
moment — past runs under a standing grant are never retroactively tainted.

---

## 5. ACL Published (What This BC Exposes)

| Capability | Consumer (per context-mapping.md) | Notes |
|---|---|---|
| Consent-state answer (`answerState()`, UC7) | Biometric, Notifications, OTP, OCR (`may-process-now?` / `may-contact-now?`) | Granted or not, under which version, since when — fact only, no personal data |
| Revocation-asked (`RevocationCoordinatedEvent`) | Each owning context | One fact per owner — each deletes its own data |
| Erasure completion (`ErasureCompleteEvent`) | Person notice via Notifications; scrutiny | Terminal; audit trail stays |
| Retention terms answer (`answerTerms()`) | Compliance steward | How long kept, under what terms, per category |

## 6. ACL Consumed (What This BC Depends On)

| Dependency | Pattern (context-mapping.md) | Used In |
|---|---|---|
| Each owning BC → Consent (revocation confirmation) | Partnership / coordination | UC6 step 3 — Biometric revokes its reference, Wallet retires its capability, and so on; one confirmation per owner |
| IAM → Consent (person existence) | Identity reference | UC1, UC4 — records belong to exactly one known person |

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
