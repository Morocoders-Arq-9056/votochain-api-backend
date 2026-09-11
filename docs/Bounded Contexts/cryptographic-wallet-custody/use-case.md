---
title: "Application Layer — Cryptographic Wallet Custody"
layer: "application"
bounded-context: "cryptographic-wallet-custody"
last-reviewed: "2026-09-08"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Cryptographic Wallet Custody — Application Layer

This document describes **orchestration**, not business meaning. It answers: in what
order do things happen, who calls whom, and what crosses this bounded context's
boundary to make one signing real. It names no framework, transport, or storage —
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

---

## 1. Use Case Catalog

| # | Use Case | Trigger | Aggregates Touched | External BCs Consulted | Facts Produced |
|---|----------|---------|--------------------|-------------------------|-----------------|
| UC1 | ProvisionWallet | Custodian request, on person onboarding | `UserWallet` | IAM (person existence, identity reference) | `WalletProvisionedEvent` |
| UC2 | **SignVoteContent** (anchor) | Voting request, with one specific vote content | `UserWallet` | Voting (the content to sign) | `KeyReconstructedEvent`, `KeyForgottenEvent` |
| UC3 | AnswerSigningCapability | Voting signing-gate check | `UserWallet` (answering operation only) | — | — (synchronous answer, no fact) |
| UC4 | RotateWallet | Custody admin request | `UserWallet` | — | `WalletRotatedEvent` |
| UC5 | SuspendWallet | Custody admin request | `UserWallet` | — | `WalletSuspendedEvent` |
| UC6 | RetireWallet | Reacts to erasure coordination confirmed (Consent & Compliance) | `UserWallet` | Consent & Compliance (coordination) | `WalletRetiredEvent` |

UC2 is detailed fully below because the reconstruct → sign → forget atomicity is the
one orchestration in this context most likely to be gotten wrong: splitting it, reusing
an open reconstruction across contents, or leaving a reconstruction open would break
the "nothing kept that could sign on its own" rule. This context holds a single
aggregate, so there is no second multi-aggregate sequence to detail.

---

## 2. Commands & Queries Accepted (Input Contracts)

These are the intentions this bounded context accepts from outside — not to be
confused with the aggregate operations in `domain-model.md`, which are internal.

### Commands

| Command | Carries | Handled By |
|---------|---------|------------|
| `ProvisionWalletCommand` | personId | UC1 |
| `SignVoteContentCommand` | walletId (or personId), vote content reference | UC2 |
| `RotateWalletCommand` | walletId, new position | UC4 |
| `SuspendWalletCommand` | walletId, reason | UC5 |
| `RetireWalletCommand` | walletId | UC6 |

UC6 accepts no standing external command from a person or admin: it is triggered by
the erasure-coordination fact arriving from Consent & Compliance.

### Queries

| Query | Returns | Backing Read Need (domain-model.md) |
|-------|---------|--------------------------------------|
| `GetSigningCapabilityByPersonQuery` | Whether the person may sign now, and with which capability and position | "Signing capability" |
| `GetAdminshipHistoryByWalletQuery` | Provisioning, rotations, suspensions, retirement behind a past signature | "Adminship history (scrutiny)" |

UC3 is served by the aggregate's answering operation `answerSigningCapability()` — it
judges standing and answers; it mutates nothing and produces no fact.

---

## 3. Use Case Detail — UC2: SignVoteContent (anchor)

### Preconditions

| # | Precondition | Checked Against |
|---|---------------|------------------|
| 1 | Capability exists and standing is `PROVISIONED` | `UserWallet` |
| 2 | No reconstruction is already open | `UserWallet.openFor` (must be empty) |
| 3 | Exactly one vote content is asked (identity reference; content owned by Voting) | Incoming request |

### Sequence

```mermaid
sequenceDiagram
    participant Voting as Voting BC
    participant Wallet as Wallet Custody BC

    Voting->>Wallet: SignVoteContentCommand(contentRef) [R4 — Customer/Supplier]
    Wallet->>Wallet: answerSigningCapability() — PROVISIONED?
    Wallet->>Wallet: UserWallet.reconstructForSigning(contentRef) → KeyReconstructedEvent
    Wallet->>Wallet: sign this one content (transient, SIGNING_OPEN)
    Wallet->>Wallet: UserWallet.forget() → KeyForgottenEvent
    Wallet-->>Voting: signed content (offered answer)
    Note over Wallet: Reconstruction is bound to this content only;<br/>never reused, never left open
```

### Steps (Business Language)

| Step | Action | Facts / Failure |
|------|--------|------------------|
| 1 | Answer the signing capability for the person; confirm standing `PROVISIONED` | Otherwise: refusal with reason (`SigningNotAllowed_Suspended`, `SigningNotAllowed_Retired`, or `CapabilityNotFound`) — surfaced to Voting, no state left behind |
| 2 | Confirm no reconstruction is already open for another content | Otherwise: `ReconstructionAlreadyOpen` |
| 3 | `reconstructForSigning()` — opens signing transiently, bound to exactly this content | `KeyReconstructedEvent` |
| 4 | Sign this one content while `SIGNING_OPEN` | Signing is possible only here; at rest nothing can sign |
| 5 | `forget()` — closes the transient use immediately, always | `KeyForgottenEvent` |
| 6 | Return the signed content to Voting | Voting delivers what this context signed (R4) |

### What This Use Case Does *Not* Do

- Does not pay for sending or deliver anything anywhere (Relay's concern — signer signs, payer pays, never mixed).
- Does not decide what the vote means (Voting's concern — the content is judged there, signed here).
- Does not keep anything signing-related after step 5 (no cache of the reconstruction "for the next vote").

### Concurrency & Idempotency

- A second `SignVoteContentCommand` arriving while one reconstruction is open fails at
  step 2 (`ReconstructionAlreadyOpen`) — it never observes or reuses the open content.
- If step 4 (signing) succeeds but step 5 (persisting `KeyForgottenEvent`) fails, the
  flow must still close the transient use: a fresh `forget()` is issued before any new
  signing is accepted. An un-forgotten reconstruction is never left to be discovered
  by the next request.
- Retrying the same content after a failure starts a new reconstruction bound to that
  content — never a resumption of the previous transient use.

### Open Orchestration Questions

- In-flight signing at erasure time (domain-model.md, Open Question #4): whether a
  `RetireWalletCommand` arriving mid-UC2 finishes the asked signing or refuses
  immediately is not yet decided — needs product + legal.
- The exact audit boundary of "nothing kept that could sign on its own" (derived
  material, cached content, logs) is open — needs security review.

---

## 4. ACL Published (What This BC Exposes)

| Capability | Consumer (per context-mapping.md) | Notes |
|---|---|---|
| Signing capability answer (`answerSigningCapability()`) | Voting (signing gate, UC3) | Whether the person may sign now, with which capability and position |
| Signed vote content | Voting (UC2 result, R4) | One specific content signed; nothing crosses that could sign on its own |
| Retirement confirmation | Consent & Compliance (erasure coordination) | `WalletRetiredEvent` confirms this owner's part once retired |

## 5. ACL Consumed (What This BC Depends On)

| Dependency | Pattern (context-mapping.md) | Used In |
|---|---|---|
| Voting → Wallet (one content to sign) | Customer/Supplier (R4) | UC2 — reconstruction is always for one specific content, never open-ended |
| IAM → Wallet (person existence) | Identity reference | UC1 — a capability belongs to exactly one person; what a person is lives in IAM |
| Consent & Compliance → Wallet (erasure coordination) | Partnership / coordination | UC6 — retirement asked here once an erasure request is confirmed |
| Wallet ⋮ Relay (signer / payer split) | Separate Ways (R6) | No direct integration — paying and sending happen in Relay, never observed here |

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
