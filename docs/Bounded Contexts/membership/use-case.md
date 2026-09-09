---
title: "Application Layer — Membership"
layer: "application"
bounded-context: "membership"
last-reviewed: "2026-09-08"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Membership — Application Layer

This document describes **orchestration**, not business meaning. It answers: in what
order do things happen, who calls whom, and what crosses this bounded context's
boundary to judge one person's belonging. It names no framework, transport, or storage
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

---

## 1. Use Case Catalog

| # | Use Case | Trigger | Aggregates Touched | External BCs Consulted | Facts Produced |
|---|----------|---------|--------------------|-------------------------|-----------------|
| UC1 | RegisterMembership | Person request to join a community | `Membership` | IAM (person existence), Community (accepts members) | `MembershipRegisteredEvent` |
| UC2 | ActivateMembership | Admin confirmation that the request becomes belonging | `Membership` | Community (standing allows it) | `MembershipActivatedEvent` |
| UC3 | AssignUnit | Admin request | `Membership` | — | `UnitAssignedEvent` |
| UC4 | AssignCommunityRole | Admin request | `Membership` | — | `CommunityRoleAssignedEvent` |
| UC5 | MarkDelinquent | Association books confirm arrears | `Membership` | Association books (obligation standing, observed) | `MemberMarkedDelinquentEvent` |
| UC6 | ClearDelinquency | Obligations met again | `Membership` | Association books (observed) | `DelinquencyClearedEvent` |
| UC7 | SuspendMembership | Discipline decision (entitlement judged in Community Management) | `Membership` | — | `MembershipSuspendedEvent` |
| UC8 | ReinstateMembership | Cause resolved | `Membership` | — | `MembershipReinstatedEvent` |
| UC9 | TerminateMembership | End of the relationship, with reason | `Membership` | — | `MembershipTerminatedEvent` |
| UC10 | **JudgeEligibility** (anchor) | Voting authorization-gate check | `Membership` | — (answered from own standing) | `EligibilityJudgedEvent` (with snapshot reference) |

UC10 is detailed fully below because the judge-at-the-instant → freeze-snapshot →
never-rewrite handover is the orchestration this context's consumers depend on — and
the one most likely to be gotten wrong (re-judging the past, or embedding the roster).
This context holds a single aggregate, so there is no second multi-aggregate sequence
to detail.

---

## 2. Commands & Queries Accepted (Input Contracts)

These are the intentions this bounded context accepts from outside — not to be
confused with the aggregate operations in `domain-model.md`, which are internal.

### Commands

| Command | Carries | Handled By |
|---------|---------|------------|
| `RegisterMembershipCommand` | personId, communityId | UC1 |
| `ActivateMembershipCommand` | membershipId | UC2 |
| `AssignUnitCommand` | membershipId, unit | UC3 |
| `AssignCommunityRoleCommand` | membershipId, role | UC4 |
| `MarkDelinquentCommand` | membershipId, reason | UC5 |
| `ClearDelinquencyCommand` | membershipId | UC6 |
| `SuspendMembershipCommand` | membershipId, reason | UC7 |
| `ReinstateMembershipCommand` | membershipId | UC8 |
| `TerminateMembershipCommand` | membershipId, reason | UC9 |
| `JudgeEligibilityCommand` | personId, communityId | UC10 |

### Queries

| Query | Returns | Backing Read Need (domain-model.md) |
|-------|---------|--------------------------------------|
| `GetMembershipByIdQuery` | The membership or nothing | "Membership by identity" |
| `GetMembershipByPersonAndCommunityQuery` | The live membership or nothing | "Membership for a (person, community) pair" |
| `GetRosterByCommunityQuery` | All `ACTIVE` memberships of that community | "Roster of a community" |
| `GetMembershipsByPersonQuery` | All live memberships across communities | "Memberships of a person" |

UC10 is a command (not a query) because judging produces a frozen fact —
`EligibilityJudgedEvent` with its snapshot reference — that Voting freezes a copy of.
A pure query would leave no history to explain a past grant after standing changes.

---

## 3. Use Case Detail — UC10: JudgeEligibility (anchor)

### Preconditions

| # | Precondition | Checked Against |
|---|---------------|------------------|
| 1 | The (person, community) pair is known — a live membership exists, or the absence itself is the answer | `Membership` (absence answers `NEVER_REGISTERED` / `NOT_A_MEMBER`) |
| 2 | Nothing about the past is re-judged: the answer reflects standing at this instant only | `Membership.status` now |

### Sequence

```mermaid
sequenceDiagram
    participant Voting as Voting BC
    participant MEM as Membership BC

    Voting->>MEM: JudgeEligibilityCommand(personId, communityId) [R2 — OHS + ACL]
    MEM->>MEM: Membership.judgeEligibility() — ACTIVE now?
    alt ACTIVE
        MEM->>MEM: freeze EligibilitySnapshot (verdict + standing observed + reference)
        MEM-->>Voting: EligibilityJudgedEvent — ELIGIBLE + snapshot reference
        Note over Voting: Voting freezes a copy;<br/>later changes here never rewrite it
    else anything else
        MEM-->>Voting: EligibilityJudgedEvent — NOT_ELIGIBLE + reason<br/>(DELINQUENT / SUSPENDED / TERMINATED / NOT_A_MEMBER)
    end
```

### Steps (Business Language)

| Step | Action | Facts / Failure |
|------|--------|------------------|
| 1 | Load the live membership for the (person, community) pair, if any | Absence is itself an answer (`NOT_A_MEMBER` / `NEVER_REGISTERED`), not an error |
| 2 | `judgeEligibility()` — `ACTIVE` means eligible; any other standing means not eligible with reason | `EligibilityJudgedEvent` with verdict, reason, and snapshot reference |
| 3 | Hand the snapshot reference to Voting, which freezes a copy at authorization time | Past judgments stay history; later standing changes affect only future judgments (H3) |

### What This Use Case Does *Not* Do

- Does not embed the roster (the roster is a question answered from many memberships — `GetRosterByCommunityQuery` — never an object held or handed over).
- Does not invent arrears (delinquency mirrors the association's books; judging only reads the standing).
- Does not judge community standing or person existence (asked of Community Management and IAM at UC1/UC2, not re-asked here).
- Does not authorize voting (Voting's decision — this context answers eligibility; Biometric answers verified-now; Voting conjoins both).

### Concurrency & Idempotency

- Judging the same pair twice in a row records two snapshots, one per instant — this is
  correct, not duplication: each answers "eligible now?" at its own moment.
- A standing change (e.g. `MemberMarkedDelinquentEvent`) landing between judgment and
  Voting's freeze does not rewrite the judgment: Voting froze a copy of the instant it
  was given. Whether in-flight authorizations survive a mid-flight exclusion is the
  parked delinquency-immediacy question, not a rewrite of this fact.
- `TERMINATED` answers stay terminal: no later judgment for the same membership
  identity ever flips to eligible — a returning person is judged under a new
  membership.

### Open Orchestration Questions

- Delinquency-immediacy — immediate exclusion vs next-authorization-only while
  in-flight votes continue (domain-model.md, Open Question #1) — needs product decision.
- Roster freshness — judged live at each authorization vs a periodically confirmed roll
  (Open Question #4) — needs product decision.

---

## 4. ACL Published (What This BC Exposes)

| Capability | Consumer (per context-mapping.md) | Notes |
|---|---|---|
| Eligibility answer + snapshot reference (`EligibilityJudgedEvent`) | Voting (authorization gate, UC10, R2) | Frozen at grant; past judgments never rewritten |
| Roster answer (`GetRosterByCommunityQuery`) | Voting (turnout basis, eligibility window) | Answered, not embedded — only `ACTIVE` counts |
| Belonging answer | Document OCR (precondition, R8) | OCR refuses with `NoEligibleMembership` when the person belongs nowhere; never judged by OCR itself |
| Standing notices | Notifications | Exclusions and re-inclusions (`MemberMarkedDelinquentEvent`, `MembershipSuspendedEvent`, `MembershipReinstatedEvent`, …) |

## 5. ACL Consumed (What This BC Depends On)

| Dependency | Pattern (context-mapping.md) | Used In |
|---|---|---|
| IAM → Membership (person existence) | Identity reference | UC1 — registration requires a real person; only the reference is held |
| Community → Membership (exists and accepts members; standing) | Conformist / OHS | UC1, UC2 — registration and activation require a community that accepts members |
| Association books → Membership (obligation standing) | Observed truth | UC5, UC6 — marking/clearing delinquency mirrors the books; arrears never invented here |
| Consent & Compliance ↔ Membership (may-process-now? + revocation confirmations) | Partnership / coordination | Gating + erasure coordination (revocation confirmations answered on request) |

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
