# VotoChain — Subdomain Map (DDD) and Ubiquitous Language
### Domain analysis | Based on: *Biometric Verification + Per-User Wallet Flow (Model B)*
### v3 — Incorporates IAM/Membership split, generic contexts (Notifications, Verification/OTP), and new Community Management and Consent & Compliance contexts
### Prepared as a strategic input for the Morocoders team

---

## 0. Classification criteria applied

> *Is this capability the reason Morocoders exists as a business, or is it a supporting capability that any competitor could buy/outsource without losing competitive advantage?*

| Type | Guiding question | Investment implication |
|---|---|---|
| **Core Domain** | Is this what makes VotoChain distinct and defensible? | Built in-house, with the best talent, with full control of the model |
| **Supporting Subdomain** | Is it necessary for the business but not the differentiator? | Built custom, but can be simplified or partially outsourced |
| **Generic Subdomain** | Does the market already solve this? | Buy / use SaaS / integrate via API, no need to reinvent |

VotoChain's real differentiator remains: issuing a vote that is mathematically verifiable on-chain and attributable to a real person (ADR-001, `ecrecover()`).

### 0.1 Changes in this version

- **Community Management** is introduced as its own context, split from `Membership`, using the same cardinality argument already applied to IAM/Membership: 1 community has N memberships, and the community's own configuration (default quorum, majority rules, admins) changes on different events than an individual membership does.
- **Consent & Compliance** is introduced as its own context, directly motivated by the source document (Peruvian Law No. 29733, explicit consent for biometric data, right to erasure). It is not modeled as part of `Biometric Identity Verification` because consent would also apply to other channels (e.g., notifications), and its lifecycle (consent records, erasure requests, retention policies) differs from biometrics itself.
- Three evaluated candidates are explicitly excluded for now: **Fraud & Risk Detection**, **Contract/Network Configuration**, and **Results & Reporting** — out of scope for this document by the team's decision.

---

## 1. Overall subdomain map

```
                              ┌────────────────────────────┐
                              │   CORE DOMAIN                │
                              │   Voting & Verifiable Ledger │
                              └──────────────┬────────────────┘
                                              │ orchestrates / consumes
                 ┌────────────────────────────┼─────────────────────────────┐
                 │                            │                             │
      ┌──────────▼──────────┐     ┌───────────▼───────────┐      ┌──────────▼───────────┐
      │ SUPPORTING            │     │ SUPPORTING              │      │ SUPPORTING             │
      │ Cryptographic Wallet   │     │ Biometric Identity       │      │ Blockchain Relay &      │
      │ Custody (Model B)      │     │ Verification              │      │ Transaction Delivery    │
      └─────────────────────────┘     └────────────┬─────────────┘      └──────────────────────────┘
                                                    │ delegates to                    ▲
                                       ┌────────────▼────────────┐                    │
                                       │ GENERIC                   │                    │
                                       │ Document OCR & Face Match  │                    │
                                       │ (AWS Rekognition / GDocAI) │                    │
                                       └──────────────────────────────┘                    │
                                                                                             │
      ┌───────────────────────┐     ┌────────────────────────┐     ┌────────────────────────┘
      │ SUPPORTING              │     │ SUPPORTING               │
      │ IAM                      │     │ Community Management      │
      │ (session identity,       │     │ (organization, voting      │
      │  authentication, system  │     │  config, admins)            │
      │  roles)                  │     └────────────┬─────────────────┘
      └────────────┬─────────────┘                  │ communityId
                    │ userId                          ▼
                    │                    ┌────────────────────────┐
                    └───────────────────►│ SUPPORTING               │
                                         │ Membership                 │
                                         │ (membership, eligibility,  │
                                         │  roster)                    │
                                         └─────────────────────────────┘
                    │
                    │ uses (purpose=login, password-reset, etc.)
                    ▼
      ┌───────────────────────┐
      │ GENERIC                  │
      │ Verification (OTP)        │
      └────────────┬───────────────┘
                    │ delivered via
                    ▼
      ┌───────────────────────┐
      │ GENERIC                  │
      │ Notifications              │
      │ (email / future SMS/push)  │
      └──────────────────────────────┘

      ┌────────────────────────────┐        ┌────────────────────────────────┐
      │ SUPPORTING                    │      │ GENERIC / FUTURE                  │
      │ Consent & Compliance            │      │ Legacy System Reconciliation      │
      │ (consent, right to erasure,      │      │ (RPA — delinquency, accounting)     │
      │  Law 29733)                       │      └────────────────────────────────────┘
      └────────────────────────────────────┘
```

> **Diagram reading note:** `Consent & Compliance` receives signals from `Biometric Identity Verification` (biometric data consent) and from `Notifications` (communication opt-in), but it does not own those contexts' data — it only records consent and coordinates erasure requests; each context remains responsible for deleting its own data when instructed.

---

## 2. CORE DOMAIN — *Voting & Verifiable Ledger*

### 2.1 Why it is the Core

The only capability **no one else solves the same way**: turning a verified person's voting intent into an on-chain transaction that is **verifiable by a third party without trusting Morocoders**.

### 2.2 Responsibilities

- Model `Proposal` and its lifecycle (open, closed, quorum, etc.)
- Issue and control the `VoteAuthorization`
- Build the EIP-712 vote message
- Orchestrate: sign → queue → send → on-chain confirmation
- Prevent replay
- Expose the verifiable vote state

### 2.3 Ubiquitous language — *Voting & Verifiable Ledger*

| Term | Domain definition |
|---|---|
| **Proposal** | An item submitted for a vote within a community; has its own lifecycle |
| **Vote** | A user's decision on a `Proposal`, expressed as a `choice` |
| **VoteAuthorization** | A short-lived, single-use permission to sign a vote for a specific `proposalId` |
| **EIP-712 Signature** | A structured, typed, cryptographically signed representation of the vote |
| **ecrecover()** | An on-chain operation that reconstructs the public address from a signature |
| **Verifiable Vote** | A vote whose authorship can be publicly proven |
| **Replay** | Reusing an already-consumed authorization or vote signature |
| **VotingLedgerPort** | The port abstracting sending/querying votes on the blockchain |
| **Quorum** | The minimum participation condition (its default value is defined in `Community Management`, see section 8) |

### 2.4 Suggested Aggregate Root
`Proposal` as the root, with `Vote` as an internal entity referencing `VoteAuthorization` as a business invariant.

---

## 3. SUPPORTING — *Cryptographic Wallet Custody (Model B)*

Essential for the Core, but HD/BIP-32 derivation is a standard industry cryptographic pattern, not a proprietary differentiator.

### 3.1 Responsibilities

- Custody the master seed (KMS/HSM)
- Derive individual wallets by `userIndex`
- Reconstruct the private key only in memory, transiently
- Distinguish the user wallet (signs) from the relayer wallet (pays and sends)

### 3.2 Ubiquitous language — *Wallet Custody*

| Term | Domain definition |
|---|---|
| **Model B** | One derived wallet per user, as opposed to "Model A" (a single wallet signing for everyone) |
| **Master Seed** | The root secret from which all user wallets are derived |
| **HD Wallet / BIP-32** | Deterministic hierarchical derivation standard |
| **userIndex** | A sequential, unique index; position in the derivation path |
| **User Wallet** | Signs the vote content; never pays gas |
| **Relayer Wallet** | Pays gas and sends transactions; never signs vote content |
| **Custodial** | The user does not manage their own private key |
| **Ephemeral Private Key** | Reconstructed only in memory during signing |

### 3.3 Suggested Aggregate Root
`UserWallet`, invariant: a persistent private-key field must never exist.

---

## 4. SUPPORTING — *Biometric Identity Verification*

The biometric technology itself is a commodity (AWS/Google); Morocoders' own value is *how* it integrates into the voting flow.

> ⚠️ Do not confuse with `Verification` (section 10) — this context verifies **physical identity**; `Verification` validates **possession of a channel** (email/phone) via OTP.
> ⚠️ **Consent** for processing this biometric data is not modeled here — it lives in `Consent & Compliance` (section 12); this context only performs the verification assuming consent was already granted.

### 4.1 Responsibilities

- Orchestrate the liveness challenge
- Orchestrate the face comparison against the `BiometricProfile`
- Produce a binary result enabling the Core to issue the `VoteAuthorization`

### 4.2 Ubiquitous language — *Biometric Identity Verification*

| Term | Domain definition |
|---|---|
| **Enrollment** | A one-time process establishing a user's reference `BiometricProfile` |
| **Liveness** | Proof of real physical presence |
| **Face Match** | Verification that the selfie matches the registered person |
| **BiometricProfile** | An encrypted record of the reference facial identity |
| **dniMatchScore** | Confidence that the selfie matches the presented ID document |
| **IdentityVerificationPort** | The port abstracting the biometric provider |
| **Liveness Challenge** | A short interaction (~8s) confirming physical presence |

### 4.3 Suggested Aggregate Root
`BiometricProfile`, invariant: never contains raw images.

---

## 5. GENERIC — *Document OCR & Face Match Provider*

AWS Rekognition and Google Document AI solve an already market-solved problem. No proprietary business logic; only the adapter.

### 5.1 Ubiquitous language

| Term | Domain definition |
|---|---|
| **AWS Adapter / Google Adapter** | The concrete implementation of the `IdentityVerificationPort` |
| **In-house Roadmap** | Tesseract.js + face-api.js as a self-hosted alternative |
| **Facial Descriptor (128 values)** | A facial vector for Euclidean-distance comparison |
| **FaceId (Rekognition)** | AWS-managed facial reference identifier |
| **MRZ** | The machine-readable zone of the ID document |

---

## 6. SUPPORTING — *Blockchain Relay & Transaction Delivery*

Delivery logistics, not electoral logic.

### 6.1 Ubiquitous language

| Term | Domain definition |
|---|---|
| **Relayer** | Pays gas and transports already-signed transactions |
| **Transaction Queue (BullMQ + Redis)** | Serializes sending to avoid `nonce` collisions |
| **Nonce** | A sequential transaction counter for a wallet |
| **Blockchain Worker** | Consumes the queue and executes the send |
| **Gas** | Cost of execution on the network (Polygon Amoy) |

---

## 7. SUPPORTING — *IAM* (split from Membership)

### 7.1 Why it is split from Membership

An IAM `User` is 1, but can have N `Membership` records (one per community), each with independent state. IAM speaks in technical terms (system role, session); Membership speaks in community-business terms.

### 7.2 Responsibilities

- Authenticate the user (login, session)
- Manage credentials and their lifecycle
- Manage system roles (admin, superadmin)
- Issue session tokens

### 7.3 Ubiquitous language — *IAM*

| Term | Domain definition |
|---|---|
| **User** | A person's technical identity; 1 per person |
| **Session** | The active authenticated state of a `User` |
| **System Role** | A global technical permission, distinct from the community role |
| **Credential** | The authentication mechanism associated with a `User` |
| **Token** | A session artifact (JWT) |

### 7.4 Suggested Aggregate Root
`User`, invariant: must not contain membership-state or community fields.

---

## 8. SUPPORTING — *Community Management* (new, split from Membership)

### 8.1 Why it is split from Membership

The same cardinality/lifecycle argument used for IAM/Membership, one level up: **1 community has N memberships**, and the community's own data (name, address, voting configuration, admins) changes on administrative events (the association is created, its bylaws are updated) — not on an individual member's events (they move out, stop paying). If `Membership` also carried this data, the entity would be forced to mix two different rates of change.

### 8.2 Responsibilities

- Model the community as its own entity (owners' association/cooperative)
- Maintain default voting configuration (quorum, majority rules) that `Voting` consults when creating a `Proposal`
- Manage community administrators (distinct from IAM's system role and from a member's community role in `Membership`)
- Maintain general settings (name, address, association contact info)

### 8.3 Ubiquitous language — *Community Management*

| Term | Domain definition |
|---|---|
| **Community** | The organization (owners' association/cooperative) as its own entity, owning its configuration |
| **CommunityAdmin** | A person with administrative permissions over a specific `Community` (not to be confused with IAM's system role) |
| **VotingPolicy / QuorumConfig** | Default quorum and majority-rule configuration that `Voting` uses when opening a `Proposal` |
| **CommunitySettings** | General community data (name, address, contact) |

### 8.4 Suggested Aggregate Root
`Community`, invariant: `communityId` is referenced by `Membership` and by `Proposal` (to read its `VotingPolicy`), but `Community` never embeds the full member list — that relationship lives in `Membership`.

---

## 9. SUPPORTING — *Membership* (split from IAM and Community)

### 9.1 Responsibilities

- Model the relationship between a `userId` and a specific `communityId`
- Manage membership status (active, delinquent, suspended)
- Manage the member's community role (president, board member, plain owner)
- Maintain the `Roster`, a direct input for `Voting` eligibility

### 9.2 Ubiquitous language — *Membership*

| Term | Domain definition |
|---|---|
| **Membership** | The relationship between a `userId` and a `communityId`; a user can have several |
| **Member / Owner** | A person with an active `Membership` |
| **Unit** | The apartment/unit the owner holds |
| **Membership Status** | active / delinquent / suspended |
| **Community Role** | The member's role within the association — distinct from IAM's system role and from `CommunityAdmin` |
| **Roster** | The record of eligible members, consumed by `Voting` |

### 9.3 Suggested Aggregate Root
`Membership`, referencing `userId` and `communityId` (never the full objects). Invariant: only "active" memberships enable a `VoteAuthorization`.

---

## 10. GENERIC — *Verification (OTP)*

### 10.1 Nature of the context

`Verification` is not an internal function of `Notifications`; it is its own bounded context, with its own lifecycle (`challenge` → attempts → expiration/consumption). It only *uses* `Notifications` as the delivery channel.

### 10.2 Responsibilities

- Generate an `OTP` for a given `purpose`
- Control expiration (`TTL`) and failed attempts
- Validate the presented code
- Delegate delivery to `Notifications`

### 10.3 Ubiquitous language — *Verification*

| Term | Domain definition |
|---|---|
| **OTP** | A short-lived, single-use code |
| **Challenge** | A concrete instance of an OTP issued for a `purpose` and recipient |
| **Purpose** | The reason for the challenge (`login`, `email-verification`, `password-reset`) |
| **Attempt Count** | A counter invalidating the challenge after N attempts |
| **TTL** | The OTP's validity window |
| **Challenge Consumption** | Marks the challenge as used after successful validation |

### 10.4 Suggested Aggregate Root
`VerificationChallenge`, invariant: a consumed or expired challenge can never validate successfully again.

---

## 11. GENERIC — *Notifications*

### 11.1 Responsibilities

- Receive a notification intent (`NotificationRequest`)
- Resolve template + channel + delivery provider
- Log the send result (`NotificationLog`)
- **Not** contain business logic about *when* or *why* to notify

### 11.2 Ubiquitous language — *Notifications*

| Term | Domain definition |
|---|---|
| **NotificationRequest** | A notification intent published by another context |
| **Channel** | The delivery medium (email today; SMS/push on the roadmap) |
| **Template** | A reusable content structure |
| **Delivery Provider** | The actual external service (SES, SendGrid) |
| **NotificationLog** | A record of what was sent, to whom, and when |

### 11.3 Non-negotiable design rule

`Notifications` is the most generic subdomain on the map: everyone depends on it, it depends on no one. No business rule from `Voting`, `Membership`, or `Consent & Compliance` should leak into this context.

---

## 12. SUPPORTING — *Consent & Compliance* (new)

### 12.1 Why it is split from Biometric Identity Verification

The source document explicitly requires compliance with Peruvian Law No. 29733: explicit consent for biometric data, data minimization, and the right to erasure. This responsibility **is not exclusive to biometrics** — it would also apply, for example, to communication opt-in in `Notifications`. Its lifecycle is also distinct: a `ConsentRecord` is granted once and can be revoked at any time, independent of whether the user ever uses the biometric system again. Classified as **Supporting** (not Generic) because correctly modeling Law 29733's requirements does require proprietary domain knowledge — it is not an off-the-shelf problem solved by an external provider.

### 12.2 Responsibilities

- Record the consent granted by a user, and for which scope (`ConsentScope`): biometric processing, receiving notifications, etc.
- Record and track data-erasure requests (`DataSubjectRequest`)
- Define retention policies per data category (`RetentionPolicy`)
- **Coordinate** (not directly execute) data revocation in the owning contexts: once an erasure request is confirmed, it notifies `Biometric Identity Verification` to revoke the `BiometricProfile` and deactivate the `userIndex`, but each owning context executes the deletion of its own data

### 12.3 Ubiquitous language — *Consent & Compliance*

| Term | Domain definition |
|---|---|
| **ConsentRecord** | A record that a user granted consent, for which scope, and under which policy version |
| **ConsentScope** | The specific scope of consent (e.g., `biometric-processing`, `email-notifications`) |
| **DataSubjectRequest** | A user's request to exercise a Law 29733 right (e.g., data erasure) |
| **RetentionPolicy** | The rule for how long and under what conditions a data category is kept |
| **Revocation / Erasure** | The act of invalidating a consent or executing an erasure request |
| **PolicyVersion** | The privacy-policy version under which a specific consent was granted |

### 12.4 Suggested Aggregate Root
`ConsentRecord` (or `DataSubjectRequest` for the erasure flow), invariant: an approved erasure request must trigger revocation in each context that owns personal data, but `Consent & Compliance` never takes ownership of that data — only the orchestration and audit record that revocation was requested and confirmed.

---

## 13. GENERIC / FUTURE — *Legacy System Reconciliation (RPA)*

The only legitimate use case for RPA: systems **without an API** (spreadsheets, legacy accounting software).

### 13.1 Ubiquitous language

| Term | Domain definition |
|---|---|
| **Accounting Reconciliation** | Syncing delinquency status between the legacy system and Membership's `Roster` |
| **Delinquent Owner** | A member who may be disqualified from voting |
| **RPA Bot** | An agent simulating human interaction with systems lacking an API |

---

## 14. Summary table for the team's strategic decision-making

| # | Subdomain | Type | Where to invest proprietary engineering? |
|---|---|---|---|
| 1 | Voting & Verifiable Ledger | **Core** | Highest priority — it is the product |
| 2 | Cryptographic Wallet Custody | Supporting | High — security-critical |
| 3 | Biometric Identity Verification | Supporting | Medium — proprietary orchestration |
| 4 | Document OCR & Face Match Provider | Generic | Minimal — adapter only |
| 5 | Blockchain Relay & Transaction Delivery | Supporting | Medium |
| 6 | IAM | Supporting | Low — rely on Auth0 |
| 7 | Community Management | Supporting | Medium — per-community configuration |
| 8 | Membership | Supporting | Medium — proprietary eligibility/delinquency rules |
| 9 | Verification (OTP) | Generic | Low |
| 10 | Notifications | Generic | Low |
| 11 | Consent & Compliance | Supporting | Medium — legal requirement (Law 29733) |
| 12 | Legacy System Reconciliation (RPA) | Generic/Future | Low, deferrable |

> **Excluded by team decision (not documented as bounded contexts):** Fraud & Risk Detection, Contract/Network Configuration, Results & Reporting.

---

## 15. Cross-context correlation

```
IAM.User (1)
   │ userId
   ├──► Membership.Membership (N)              — membership and eligibility
   ├──► Biometric.BiometricProfile (1)          — reference physical identity
   ├──► Wallet.UserWallet (1)                   — on-chain identity
   ├──► Verification.Challenge (N, per purpose) — one-off channel validations
   └──► Consent.ConsentRecord (N, per scope)    — granted consents

Community.Community (1)
   │ communityId
   └──► Membership.Membership (N)               — that community's members

Notifications does not directly correlate by userId: it only receives
the minimal data needed to deliver (email, template).

Consent & Compliance correlates by userId, but never stores or owns
the personal data of the contexts it coordinates — only the audit
record that a consent or erasure request existed.
```

---

## 16. Methodological note for Morocoders

This map **is not static**. Examples of when to revisit it:

- If `Biometric Identity Verification` migrates to the in-house path, it could move closer to **Core**.
- If `Community Management` starts including per-community billing logic, it is worth evaluating whether `Billing/Subscription` deserves its own Generic context.
- If the volume of erasure requests (`DataSubjectRequest`) grows and starts requiring multi-step approval flows, `Consent & Compliance` could move toward richer business rules, though it would remain Supporting.
- The three candidates excluded in this version (Fraud & Risk Detection, Contract/Network Configuration, Results & Reporting) can be revisited later if a concrete business driver emerges — they are not documented today to avoid over-fragmentation without real evidence.
