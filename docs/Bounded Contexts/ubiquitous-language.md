---
title: "Ubiquitous Language — VotoChain Bounded Contexts"
layer: "domain"
last-reviewed: "2026-09-07"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Ubiquitous Language: VotoChain — Consolidated Glossary

One language per bounded context — never one global model. Each section below states
what a term means **inside its context**, copied from that context's domain model.
Where the same word means different things in different contexts, the Conflict Table
(§12) disambiguates and the Translation Rules (§13) say what crosses each boundary.

Source of truth per context: its `domain-model.md`. This file consolidates; it defines nothing new.

## 1. Voting & Verifiable Ledger (Core)

| Term | Domain definition (inside this context) |
|---|---|
| **Proposal** | An item submitted for a vote within a community; lifecycle `DRAFT → OPEN → CLOSED → TALLIED`; never embeds votes |
| **Vote** | A person's decision on a `Proposal`, expressed as a `choice`; off-chain cast is intent, on-chain confirmation is fact |
| **VoteAuthorization** | A short-lived, single-use permission to sign a vote for one (proposal, voter); consumed atomically on cast |
| **QuorumSnapshot** | The community's participation rule, frozen at `open()`; later policy changes never rewrite it |
| **EligibilitySnapshot** | The roster judgment, frozen at grant; past judgments are never rewritten |
| **Verifiable Vote** | A vote whose authorship can be proven without trusting the operator |
| **Replay** | Reuse of an already-consumed authorization or signature; always refused |

## 2. Cryptographic Wallet Custody

| Term | Domain definition (inside this context) |
|---|---|
| **UserWallet** | One person's signing capability; single aggregate of this context |
| **Signing capability** | What proves "this vote came from this person" without the person managing secrets |
| **DerivationPosition** | The unique ordered position one capability occupies |
| **SignedContentRef** | One vote content transiently open for signing, owned by Voting |
| **OpenFor** | At most one content open at once |
| **WalletStanding** | `PROVISIONED, SIGNING_OPEN, ROTATED, SUSPENDED, RETIRED` |

## 3. Biometric Identity Verification

| Term | Domain definition (inside this context) |
|---|---|
| **BiometricProfile** | A person's lasting reference, once per person; never holds raw images |
| **VerificationAttempt** | One presence-proof + comparison interaction; born and dies in minutes |
| **Liveness** | Observed physical presence; must pass before any comparison |
| **FaceComparison** | The match question against the reference, only after passed liveness |
| **VerificationVerdict** | The frozen binary outcome: `VERIFIED` / `NOT_VERIFIED` + reason + freshness |
| **FreshnessWindow** | How long one `VERIFIED` authorizes; then it ages out |
| **ProfileStanding** | `ENROLLED / REVOKED` |
| **Enrollment** | The one-time process establishing a person's reference profile |

## 4. Blockchain Relay & Transaction Delivery

| Term | Domain definition (inside this context) |
|---|---|
| **DeliveryOrder** | One order per signed content; single aggregate of this context |
| **SignedContentRef** | Already-signed vote content carried, owned by Voting |
| **PayerRef** | The payer capability paying for sending; never the voter's signing capability |
| **SendingOrderPosition** | Sequential per-payer position; no overtaking |
| **SendingCost** | The cost of sending; uncovered cost is failure with reason |
| **SendingAttempt** | One recorded try: position + outcome + reason, append-only |
| **DeliveryStanding** | `ACCEPTED, ORDERED, SENT, CONFIRMED, FAILED, RETRIED, ABANDONED` |

## 5. IAM

| Term | Domain definition (inside this context) |
|---|---|
| **User** | A person's technical identity; exactly 1 per person; never carries membership, community, or physical identity |
| **Session** | The proven-in standing; at most one open per `User` (supersede default) |
| **System Role** | A global technical permission (`ADMIN / USER`); distinct from community role and community administration |
| **Secret** | Local proof material; this context judges proofs, never exposes material |
| **Outside proof** | Standing vouched by the one agreed outside prover; a linked facet, not a second identity |
| **Access standing** | `REGISTERED, ACTIVE, SUSPENDED` + session open/closed |
| **Email identity** | The recorded address + verified standing; sending executed outside |

## 6. Community Management

| Term | Domain definition (inside this context) |
|---|---|
| **Community** | The owners' association / cooperative as its own entity, owning its configuration; never embeds the member list |
| **CommunityStanding** | `REGISTERED, ACTIVE, SUSPENDED, ARCHIVED` (`ARCHIVED` terminal) |
| **CommunitySettings** | Name, domicile, contact — general community data |
| **VotingPolicy** | The default participation rule; Voting copies it at opening and the copy is then independent |
| **QuorumConfig** | Threshold + basis, part of the policy; frozen by Voting as `QuorumSnapshot` |
| **CommunityAdmin** | A person entrusted to administer one community; distinct from `CommunityRole` and system role |

## 7. Membership

| Term | Domain definition (inside this context) |
|---|---|
| **Membership** | The relationship one person–one community, with independent standing |
| **Member / Owner** | A person holding an `ACTIVE` membership |
| **Unit** | The apartment / unit held; an attribute that follows the person by default |
| **MembershipStatus** | `REQUESTED, ACTIVE, DELINQUENT, SUSPENDED, TERMINATED` (`TERMINATED` terminal) |
| **CommunityRole** | The member's part within the association; distinct from administration and system role |
| **Roster** | The set of currently eligible members, as answered — not an embedded object |
| **EligibilitySnapshot** | The frozen judgment at an instant, handed to Voting |
| **Delinquency** | Unmet obligations, which may lose eligibility |

## 8. Consent & Compliance

| Term | Domain definition (inside this context) |
|---|---|
| **ConsentRecord** | A grant for one (person, scope) under one policy version |
| **ConsentScope** | The specific scope of consent (e.g. biometric processing, email notices); one scope per record, never blanket |
| **PolicyVersion** | The policy version frozen at grant |
| **DataSubjectRequest** | One erasure flow, request → completion, with per-owner confirmations |
| **ErasureStanding** | `REQUESTED, CONFIRMED, COORDINATED, AWAITING_CONFIRMATIONS, COMPLETE` |
| **RetentionPolicy** | The keeping rule for one data category; supersedes, never edits past |
| **Revocation / Erasure** | Invalidating a consent / executing an erasure request (coordinated here, executed by owners) |
| **ConsentStanding** | `GRANTED / REVOKED` |

## 9. Document OCR & Face Match Provider

| Term | Domain definition (inside this context) |
|---|---|
| **Examination** | One concrete proof for one person + one document; born on request, dies on verdict or expiry |
| **Evidence** | The document image and presented face as received; held only while the examination is open |
| **Extraction** | What was read from the document; judged readable or unreadable |
| **Comparison** | The portrait-vs-face judgment: holds or does not hold |
| **Verdict** | The single judgment: `MATCH` (reads + holds), `NO_MATCH` (reads but does not hold), `UNREADABLE` (cannot judge) |
| **ExaminationStanding** | `OPEN, CONCLUDED, EXPIRED` |
| **UnreadableReason** | Why no judgment was possible — closed 5: blurry, glare-covered, cropped, expired, mismatched document type |
| **ValidityWindow** | How long the examination stays answerable |

## 10. Verification (OTP)

| Term | Domain definition (inside this context) |
|---|---|
| **Challenge** | One proof instance per (person, purpose); dies on confirm / invalidate / expiry |
| **Purpose** | The reason for the challenge — closed 3: `login`, `email-verification`, `password-reset` |
| **Presented code** | Judged per attempt, never kept readable |
| **Attempt** | One judgment; past the agreed count the challenge invalidates |
| **Validity window** | The answerable span; past it the challenge expires |
| **Consumption** | A confirmed challenge never confirms again; single-use |

## 11. Notifications

| Term | Domain definition (inside this context) |
|---|---|
| **Delivery intent** | Template + address + reason + idempotency key; when/why stay with the requester |
| **Template** | A reusable content structure with placeholders, resolved here |
| **Channel** | Email only for now; others parked, not modeled |
| **Dispatch** | Requested → confirmed / failed; retry appends new attempts, never rewrites |
| **Delivery history** | The per-dispatch append-only record, never rewritten |
| **Idempotency key** | Same key never delivers twice |
| **DispatchStanding** | `REQUESTED, REFUSED, CONFIRMED, FAILED` |

## 12. Conflict Table (homonyms across contexts)

| Word | Meaning A | Meaning B | Rule |
|---|---|---|---|
| Verification | Channel possession via one-time code (OTP) | Live-person proof (Biometric) | Never say "verification" unqualified — always `channel verification` or `identity verification` |
| Verified | `EmailVerified` — address standing (IAM) | `VERIFIED` — fresh liveness + match verdict (Biometric) | Different aggregates, different freshness; translate, never equate |
| Vote | Off-chain intent `VoteCast` (Voting) | On-chain fact `VoteConfirmedOnChain` (Voting ← Relay) | Only `CONFIRMED` counts toward the tally |
| User | Technical identity, 1 per person (IAM) | — | `Member/Owner` (Membership), `CommunityAdmin` (Community), `System Role` (IAM) are four different things; never interchange |
| Role | `System Role` — global technical permission (IAM) | `CommunityRole` — part within the association (Membership) | Plus `CommunityAdmin` (Community): three distinct concepts |
| Examination | `DocumentExamination` — document proof (OCR) | `VerificationAttempt` (Biometric), `Challenge` (OTP) | Each dies on its own verdict; none substitutes another |
| Quorum | `QuorumConfig` — live rule (Community) | `QuorumSnapshot` — frozen copy (Voting) | The copy is independent from the moment of opening |
| Roster | Answered set of eligible members (Membership) | `EligibilitySnapshot` — frozen judgment handed to Voting | Live answer vs frozen handover; past handovers never rewritten |
| Revocation | Erasure coordination (Consent) | `REVOKED` profile, `SUSPENDED/RETIRED` wallet, revoked system role (owners) | Consent coordinates; each owner owns its local standing |
| Signing vs paying | Signing capability (Wallet) | Payer capability (Relay) | Never mixed; only Voting's flow brings them near, still apart |
| Consent vs enforcement | Opt-in judged (Consent) | Refusal enforced + logged (Notifications) | Notifications owns no preference; it enforces the answer |
| Purpose | Closed 3 OTP purposes (Verification) | Vote authorization, notices, erasure (other contexts) | No vote OTP, no borrowed purposes |

## 13. Translation Rules (what crosses, in which words)

1. **Identity crosses by reference only.** Person, community, document cross as identifiers; what they mean is judged where they live.
2. **Live rules never cross; frozen copies do.** (`VotingPolicy` → `QuorumSnapshot`; roster answer → `EligibilitySnapshot`.) Later changes never rewrite frozen copies.
3. **Verdicts cross, mechanics never do.** Fresh `verified`, `ChallengeConfirmed`, `MATCH` cross as facts; liveness detail, codes, images, scores stay behind.
4. **Secrets never cross.** No plain code, no signing material, no portrait crosses any boundary.
5. **Standing is local.** Suspension, revocation, retirement in one context never rewrites another's standing; erasure completes only when every owner confirms.
6. **Closed sets stay closed at the boundary.** `Purpose` (3), `Verdict` (3), `UnreadableReason` (5) cross only with their agreed values.
7. **Delivery takes minimal intent.** Template + address + reason + idempotency key; never person identity, never business rules.
8. **Mechanism-free phrasing everywhere.** Kept-apart secrets, unique derivation positions, payer's sending order, sending cost — the same plain words in every context.

## 14. Deviations from the Reference Glossary

The reference map's §§2–11 glossary was hypothesis. Kept, corrected, or rejected per
the modeled contexts — full log in `context-mapping.md` (D1–D7). Headlines: OCR is a
full context (not adapter-only); Notifications email-only with no local preferences;
OTP purposes closed at 3; IAM judges proofs executed outside; Consent coordinates
without owning; Relay speaks in sending-order terms; Voting holds 3 aggregates, not 1.

## Related Documentation

| Document | Link |
|----------|------|
| Context map + relationship catalog | `context-mapping.md` |
| The 11 domain models (sources of truth) | `voting-verifiable-ledger/domain-model.md`, `cryptographic-wallet-custody/domain-model.md`, `biometric-identity-verification/domain-model.md`, `blockchain-relay-transaction-delivery/domain-model.md`, `iam/domain-model.md`, `community-management/domain-model.md`, `membership/domain-model.md`, `consent-compliance/domain-model.md`, `document-ocr-face-match-provider/domain-model.md`, `verification/domain-model.md`, `notifications/domain-model.md` |
| Subdomain map (input, hypothesis) | `docs/BrainStorming/VotoChain_DDD_Subdomains.md` |
