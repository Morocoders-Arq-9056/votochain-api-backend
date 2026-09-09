---
title: "Application Layer — Notifications"
layer: "application"
bounded-context: "notifications"
last-reviewed: "2026-09-08"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Notifications — Application Layer

This document describes **orchestration**, not business meaning. It answers: in what
order do things happen, who calls whom, and what crosses this bounded context's
boundary to tell one person one thing. It names no framework, transport, or storage —
same discipline as `domain-model.md`.

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

> Receiver and actuator: everyone depends on this context, it depends on no one. Only
> template + address + reason + idempotency key cross the boundary — no business rule
> from any requester ever leaks in (§11.3, honored). Actual sending is executed
> outside (executor-first, locked decision).

---

## 1. Use Case Catalog

| # | Use Case | Trigger | Aggregates Touched | External BCs Consulted | Facts Produced |
|---|----------|---------|--------------------|-------------------------|-----------------|
| UC1 | **RequestDelivery** (anchor) | Any context's delivery intent (template + address + reason + idempotency key) | `NotificationDispatch` | Consent & Compliance (may-contact-now?) | `DeliveryRequestedEvent` — or `DeliveryRefusedEvent` (duplicate key / contact not allowed) |
| UC2 | ConfirmDelivery | Observed send confirmation from the executor | `NotificationDispatch` | — (outcome observed) | `DeliveryConfirmedEvent` |
| UC3 | RecordDeliveryFailure | Observed send failure from the executor | `NotificationDispatch` | — (outcome observed) | `DeliveryFailedEvent` |
| UC4 | RetryDelivery | Requested after a failed attempt | `NotificationDispatch` | — | `DeliveryRetriedEvent` (new attempt opens on the same dispatch) |
| UC5 | AnswerDeliveryStanding | Requesting context asks "did the person get told?" | `NotificationDispatch` (answering operation only) | — | — (synchronous answer, no fact) |

UC1 is detailed fully below because the duplicate-key gate + opt-in gate + refusal-as-history
ordering is the orchestration most likely to be gotten wrong (delivering twice, dropping
refusals silently, or judging opt-in here). This context holds a single aggregate, so
there is no second multi-aggregate sequence to detail.

---

## 2. Commands & Queries Accepted (Input Contracts)

These are the intentions this bounded context accepts from outside — not to be
confused with the aggregate operations in `domain-model.md`, which are internal.

### Commands

| Command | Carries | Handled By |
|---------|---------|------------|
| `RequestDeliveryCommand` | template key + values, address, reason, idempotency key | UC1 |

UC2–UC4 accept no external command: confirmations and failures are observed executor
outcomes recorded via `confirmDelivered()` / `recordDeliveryFailure()`, and retries
follow failures inside the dispatch journey via `requestRetry()`.

### Queries

| Query | Returns | Backing Read Need (domain-model.md) |
|-------|---------|--------------------------------------|
| `GetDeliveryStandingByDispatchQuery` | Where is this intent: requested, refused, confirmed, or failed — and how many attempts stand recorded | "Delivery standing" |
| `GetDeliveryStandingByIdempotencyKeyQuery` | The standing of the requester's own intent (did the person get told?) | "Delivery standing" (by the requester's key) |
| `GetDeliveryHistoryByDispatchQuery` | What was attempted and concluded, in order | "Delivery history (scrutiny)" |

UC5 is served by the aggregate's answering operation `answerDeliveryStanding()` — it
judges standing and answers; it mutates nothing and produces no fact.

---

## 3. Use Case Detail — UC1: RequestDelivery (anchor)

### Preconditions

| # | Precondition | Checked Against |
|---|---------------|------------------|
| 1 | Template key is known in the catalog; address is well-formed | Incoming intent (resolution at request time) |
| 2 | Idempotency key never seen before | Own history (seen before → the same intent, refused as duplicate) |
| 3 | Contact allowed now | Consent & Compliance (`may-contact-now?` — judged there, enforced here) |

### Sequence

```mermaid
sequenceDiagram
    participant Requester as Any BC (IAM / OTP / Voting / Membership / Consent)
    participant NOT as Notifications BC
    participant Consent as Consent & Compliance BC
    participant Executor as External Executor

    Requester->>NOT: RequestDeliveryCommand(template, address, reason, idempotencyKey)
    NOT->>NOT: key seen before?
    alt duplicate key
        NOT->>NOT: requestDelivery() → DeliveryRefusedEvent (DUPLICATE)
        NOT-->>Requester: refused — original dispatch stands untouched
    else fresh key
        NOT->>NOT: template known? address well-formed?
        NOT->>Consent: may-contact-now?
        alt not allowed
            Consent-->>NOT: refused
            NOT->>NOT: requestDelivery() → DeliveryRefusedEvent (CONTACT_NOT_ALLOWED)
        else allowed
            NOT->>NOT: requestDelivery() → DeliveryRequestedEvent
            NOT->>Executor: send instructed (mechanics outside)
            Note over NOT: UC2/UC3 record the observed outcome;<br/>UC4 appends retries; UC5 answers standing
        end
    end
```

### Steps (Business Language)

| Step | Action | Facts / Failure |
|------|--------|------------------|
| 1 | Check the idempotency key against seen keys | Seen before → `DeliveryRefusedEvent` (`DUPLICATE`); the original dispatch stands untouched — never delivered twice (invariant 1) |
| 2 | Resolve the template (known key + requester's values) and confirm the address is well-formed | Otherwise: `TemplateUnknown` / `AddressMalformed` — no dispatch opened |
| 3 | Ask Consent & Compliance `may-contact-now?` | Refused → `DeliveryRefusedEvent` (`CONTACT_NOT_ALLOWED`) — still recorded history, never a silent drop (rule: refusal is history) |
| 4 | `requestDelivery()` — opens one dispatch for exactly this address and this resolved template | `DeliveryRequestedEvent` (dispatch, template, address, reason) |
| 5 | Instruct the send to the external executor | Mechanics outside; the outcome is observed back in UC2/UC3 |

### What This Use Case Does *Not* Do

- Does not decide when or why to notify (the requester owns the when/why — this context only honors the intent).
- Does not judge opt-in (Consent & Compliance owns it — this context enforces the answer and logs the refusal).
- Does not carry person identity (minimal delivery data only — address + template; correlation never by person).
- Does not judge business consequences (verified email, informed voter — requesting contexts judge those on their own facts).

### Concurrency & Idempotency

- Two identical intents racing each other serialize on the key: the first opens the
  dispatch, the second finds the key seen and is refused as duplicate — one intent,
  one dispatch, at most one delivery ever.
- A retry (UC4) racing a late confirmation resolves by standing: if `confirmDelivered()`
  lands first the dispatch is `CONFIRMED` and retry is refused (`AlreadyConfirmed`); a
  retry opens a new attempt only from `FAILED`.
- Observing the same outcome twice (duplicate confirmation/failure from the executor)
  records once: the second finds no uninstructed send for the current attempt
  (`NoSendInstructed`) and is ignored, not appended.

### Open Orchestration Questions

- Retry limits per intent — how many attempts before abandoning with reason
  (domain-model.md, Open Question #1) — needs product decision.
- Template catalog ownership — who writes and approves wording per requester (Open
  Question #2) — needs product decision.
- Bounce vs failure vocabulary — failure, refusal, or its own outcome (Open
  Question #4) — needs product decision.

---

## 4. ACL Published (What This BC Exposes)

| Capability | Consumer (per context-mapping.md) | Notes |
|---|---|---|
| Delivery standing answer (`answerDeliveryStanding()`, UC5) | Any requesting context (did the person get told?) | By dispatch or by the requester's idempotency key |
| Delivery history | Scrutiny, erasure answers | What was sent, to whom, when — attempts and outcomes in order |

## 5. ACL Consumed (What This BC Depends On)

| Dependency | Pattern (context-mapping.md) | Used In |
|---|---|---|
| Any BC → Notifications (delivery intent) | Open Host Service (this context is the sink) | UC1 — IAM (welcome/security/address), OTP (code delivery), Voting (open/close/receipt/tally), Membership (standing changes), Consent (coordination notices) |
| Consent & Compliance → Notifications (may-contact-now?) | Partnership / coordination | UC1 step 3 — opt-in judged where consent lives |
| External executor → Notifications (send executed, outcome observed) | Executor-first | UC1 step 5, UC2, UC3 — mechanics outside, outcomes recorded here |

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
