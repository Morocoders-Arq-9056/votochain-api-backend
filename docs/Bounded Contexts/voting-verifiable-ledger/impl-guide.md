## Votacion y Ledger Verificable — NestJS | DDD | CQRS | Monolito Modular

> **CORE DOMAIN.** Convierte intencion verificable en hecho on-chain. Solo `CONFIRMED` cuenta. Tres agregados pequenos por referencia de identidad.

---

## INDICE

1. [Estructura del Proyecto](#estructura)
2. [Domain Layer](#domain)
3. [Application Layer](#application)
4. [Infrastructure Layer](#infrastructure)
5. [Interfaces Layer](#interfaces)
6. [Esquema de Base de Datos](#database)
7. [Flujos CQRS por Caso de Uso](#flujos)
8. [Integracion con otros BCs](#integracion)
9. [Dependencias Externas](#dependencias)
10. [Auditoria y Correcciones Aplicadas](#auditoria)

---

<a name="estructura"></a>

## 1. Estructura del Proyecto

```
src/voting/
├── interfaces/
│   ├── rest/ (proposal / authorization / vote controllers, resources/, transform/)
│   ├── acl/voting-context.facade.ts          # Reservada (sin consumidores hoy)
│   └── filters/voting-exception.filter.ts
├── application/
│   ├── acl/voting-context-facade.impl.ts    # Reservada (sin consumidores hoy)
│   └── internal/
│       ├── commandservices/ (proposal, authorization, vote — CastVote ancla + UC5/UC6)
│       ├── queryservices/ (proposal-query, vote-query — tally, receipt, proof)
│       ├── eventhandlers/ (vote-cast.event-handler.ts (VoteCastEventHandler) -> UC5, proposal-closed.event-handler.ts (ProposalClosedEventHandler) -> UC8)
│       └── outboundservices/
│           ├── acl/ (external-community R1, external-membership R2, external-biometric R3,
│           │         external-wallet R4, external-relay R5, external-notifications R11)
│           ├── signing/signature-policy.service.ts   # Port + token SIGNATURE_POLICY
│           └── quorum/quorum-policy.service.ts       # Port + token QUORUM_POLICY
├── domain/
│   ├── model/
│   │   ├── aggregates/ (proposal, vote-authorization, vote)
│   │   ├── valueobjects/ (ids, voter-address, choice, ballot-options, eip712-signature,
│   │   │                  vote-nonce, quorum-snapshot, eligibility-snapshot, tx-reference)
│   │   ├── commands/ (draft/open/request-auth/cast/close/...)
│   │   ├── queries/ (by-id, by-community-status, tally, receipt)
│   │   └── events/ (19 hechos)
│   ├── services/ (3 command + 2 query, con tokens)
│   ├── repositories/ (proposal / authorization / vote + tokens)
│   └── exceptions/ (una por rechazo de negocio)
├── infrastructure/
│   ├── persistence/typeorm/ (entities/, assemblers/ con parseX, adapters/)
│   └── signing/ethers/ethers-signature-verification.service.ts
└── voting.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer

> Cero framework en `domain/`. La propuesta nunca contiene votos (solo conteos).

### 2.0 Interfaces de ciclo de vida (sin esqueletos)

```typescript
export interface Proposable { open(quorum: QuorumSnapshot): void; close(): void; tallyVotes(counts: Map<string, number>, turnout: number): void; }
export interface Authorizable { grant(eligibility: EligibilitySnapshot): void; deny(reason: AuthorizationDenialReason): void; consume(voteId: VoteId): void; expire(): void; }
export interface VoteTrackable { markQueued(): void; markSent(ref: TransactionReference): void; markConfirmed(ref: TransactionReference, blockNo: number): void; markFailed(reason: string, retryable: boolean): void; }
export const ProposalStatus = { DRAFT: 'DRAFT', OPEN: 'OPEN', CLOSED: 'CLOSED', TALLIED: 'TALLIED' } as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];
export function parseProposalStatus(v: string): ProposalStatus {
  if (!(Object.values(ProposalStatus) as string[]).includes(v)) throw new Error(`invalid proposal status: ${v}`);
  return v as ProposalStatus;
}
export const AuthorizationStatus = { PENDING: 'PENDING', CONSUMED: 'CONSUMED', EXPIRED: 'EXPIRED', DENIED: 'DENIED' } as const;
export type AuthorizationStatus = (typeof AuthorizationStatus)[keyof typeof AuthorizationStatus];
export function parseAuthorizationStatus(v: string): AuthorizationStatus {
  if (!(Object.values(AuthorizationStatus) as string[]).includes(v)) throw new Error(`invalid authorization status: ${v}`);
  return v as AuthorizationStatus;
}
export const VoteStatus = { SIGNED: 'SIGNED', QUEUED: 'QUEUED', SENT: 'SENT', CONFIRMED: 'CONFIRMED', FAILED: 'FAILED' } as const;
export type VoteStatus = (typeof VoteStatus)[keyof typeof VoteStatus];
export function parseVoteStatus(v: string): VoteStatus {
  if (!(Object.values(VoteStatus) as string[]).includes(v)) throw new Error(`invalid vote status: ${v}`);
  return v as VoteStatus;
}
// DTOs: un @IsIn(Object.values(X)) por cada unión — @IsIn(Object.values(ProposalStatus)), @IsIn(Object.values(AuthorizationStatus)), @IsIn(Object.values(VoteStatus)) (nunca `Object.values(A | B)` combinado, nunca forma enum clásica / `@IsEnum` / `as`)
```

Sin esqueletos: los guards H5 quedan explicitos en cada agregado — replay (`AuthorizationAlreadyConsumed` + unico parcial `PENDING` + unico parcial `CONFIRMED`), late (`ProposalNotOpen`), signer (`SignerMismatch`: `recovered.equals(voter)`), inmutabilidad del voto, y atomicidad consume+cast en un `uow.run`. Enums como `as const` + `type` union con `parseX()` vía `Object.values()` al rehidratar y `@IsIn(Object.values(X))` en DTOs, nunca forma enum clásica / `as` / `@IsEnum`.

### 2.1 `Proposal` — DRAFT → OPEN → CLOSED → TALLIED

```typescript
export const ProposalStatus = { DRAFT: 'DRAFT', OPEN: 'OPEN', CLOSED: 'CLOSED', TALLIED: 'TALLIED' } as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];
export class Proposal extends AggregateRoot implements Proposable {
  private constructor(private readonly _id: ProposalId, private readonly _communityId: CommunityId, private _status: ProposalStatus, private readonly _options: BallotOptions, private _quorum: QuorumSnapshot | null, private _tally: Tally | null) { super(); }
  static create(id: ProposalId, communityId: CommunityId, options: BallotOptions): Proposal {
    if (options.size < 2) throw new InvalidChoiceError('ballot needs >= 2 options');
    const p = new Proposal(id, communityId, ProposalStatus.DRAFT, options, null, null);
    p.registerEvent(new ProposalDraftedEvent(id, communityId));
    return p;
  }
  static rehydrate(...): Proposal { return new Proposal(...); } // sin eventos
  open(quorum: QuorumSnapshot): void {
    if (this._status !== ProposalStatus.DRAFT) throw new IllegalProposalTransitionError('open only from DRAFT');
    this._quorum = quorum; // se escribe una vez, nunca cambia
    this._status = ProposalStatus.OPEN;
    this.registerEvent(new ProposalOpenedEvent(this._id, quorum));
  }
  close(): void {
    if (this._status !== ProposalStatus.OPEN) throw new IllegalProposalTransitionError('close only from OPEN');
    this._status = ProposalStatus.CLOSED;
    this.registerEvent(new ProposalClosedEvent(this._id, new Date()));
  }
  tallyVotes(counts: Map<string, number>, turnout: number): void {
    if (this._status !== ProposalStatus.CLOSED) throw new IllegalProposalTransitionError('tally only from CLOSED');
    this._tally = new Tally(counts, turnout, this._quorum!.verdictFor(turnout));
    this._status = ProposalStatus.TALLIED;
    this.registerEvent(new ProposalTalliedEvent(this._id, this._tally));
    this.registerEvent(this._tally.quorumMet ? new QuorumReachedEvent(this._id, turnout) : new QuorumNotReachedEvent(this._id, turnout));
  }
  assertOpen(): void { if (this._status !== ProposalStatus.OPEN) throw new ProposalNotOpenError('ProposalNotOpen'); }
  assertChoice(c: Choice): void { if (!this._options.contains(c)) throw new InvalidChoiceError('InvalidChoice'); }
}
```

### 2.2 `VoteAuthorization` — PENDING → CONSUMED / EXPIRED / DENIED

```typescript
export class VoteAuthorization extends AggregateRoot implements Authorizable {
  static request(id: AuthorizationId, proposalId: ProposalId, voter: VoterAddress, ttlMin: number): VoteAuthorization {
    const a = new VoteAuthorization(id, proposalId, voter, AuthorizationStatus.PENDING, null, expiresAt(ttlMin));
    a.registerEvent(new VoteAuthorizationRequestedEvent(id, proposalId, voter));
    return a;
  }
  grant(eligibility: EligibilitySnapshot): void { /* exige PENDING + vigente */ this.registerEvent(new VoteAuthorizationGrantedEvent(...)); }
  deny(reason: AuthorizationDenialReason): void { this.registerEvent(new VoteAuthorizationDeniedEvent(...)); }
  consume(voteId: VoteId): void {
    if (this._status !== AuthorizationStatus.PENDING) throw new AuthorizationAlreadyConsumedError('AuthorizationAlreadyConsumed');
    if (this.isExpired()) throw new AuthorizationExpiredError('AuthorizationExpired');
    this._status = AuthorizationStatus.CONSUMED;
    this.registerEvent(new VoteAuthorizationConsumedEvent(this._id, voteId));
  }
  expire(): void { /* PENDING + ventana vencida -> EXPIRED */ }
}
```

Un `(proposal, voter)` admite como maximo un `PENDING` (finder + unico parcial). Consumir + castear es **un paso indivisible** (misma `uow.run`).

### 2.3 `Vote` — SIGNED / QUEUED / SENT → CONFIRMED / FAILED

```typescript
export class Vote extends AggregateRoot implements VoteTrackable {
  /** Ensambla el contenido firmable (puro, sin eventos): proposal + voter + choice + nonce. */
  static buildMessage(proposalId: ProposalId, voter: VoterAddress, choice: Choice, nonce: VoteNonce): string {
    return `vote:${proposalId.value}:${voter.value}:${choice.value}:${nonce.value}`;
  }
  static cast(id: VoteId, proposalId: ProposalId, voter: VoterAddress, choice: Choice, nonce: VoteNonce, sig: EIP712Signature, recovered: VoterAddress): Vote {
    if (!recovered.equals(voter)) throw new SignerMismatchError('SignerMismatch');
    const v = new Vote(id, proposalId, voter, choice, nonce, sig, null, VoteStatus.SIGNED);
    v.registerEvent(new VoteMessageBuiltEvent(id, proposalId, choice, nonce)); // scrutiny: el mensaje existió antes que la firma
    v.registerEvent(new VoteCastEvent(id, proposalId, voter, sig));
    return v;
  }
  markQueued(): void { /* SIGNED o re-try desde FAILED */ }
  markSent(ref: TransactionReference): void { /* QUEUED -> SENT */ }
  markConfirmed(ref: TransactionReference, blockNo: number): void { /* SENT -> CONFIRMED terminal */ }
  markFailed(reason: string, retryable: boolean): void { /* -> FAILED */ }
}
```

Un solo voto inmutable: un segundo `CONFIRMED` por `(proposal, voter)` es replay, no voto. Reintentos de maquina reusan identidad + firma.

### 2.4 Value Objects clave

`VoterAddress`: `of()` valida `0x + 40 hex`, guarda lowercase, `equals()` exacto — **== ecrecover**: el firmante recuperado debe igualar al declarado. `EIP712Signature { v, r, s }` sobre (proposal, voter, choice, nonce). `Choice` pertenece a `BallotOptions` (la propuesta ownea el ballot, `>= 2`, congelado al abrir). `VoteNonce` fresco por autorizacion (anti-replay). `QuorumSnapshot { threshold, basis }` congelado en `open()` con `verdictFor(turnout)`. `EligibilitySnapshot`: roster observado en UC3, congelado en `grant()`. `TransactionReference { txHash, blockNumber? }`: observado del chain, nunca inventado.

### 2.5 Events (19)

Proposal: `ProposalDraftedEvent/ProposalOpenedEvent/ProposalClosedEvent/ProposalTalliedEvent + QuorumReachedEvent/QuorumNotReachedEvent`. Autorizacion: `VoteAuthorizationRequestedEvent/VoteAuthorizationGrantedEvent/VoteAuthorizationDeniedEvent/VoteAuthorizationConsumedEvent/VoteAuthorizationExpiredEvent` (wire `eventName` inalterado). Voto: `VoteMessageBuiltEvent/VoteCastEvent/SignedVoteQueuedEvent/TransactionSentEvent/VoteConfirmedOnChainEvent/TransactionFailedEvent + ReplayRejectedEvent/LateVoteRejectedEvent`. Todos con `static eventName` (wire `'ProposalDrafted'`, `'ProposalOpened'`, `'ProposalClosed'`, `'VoteCast'`, etc. inalterado) y payload con VOs.

### 2.6 Servicios CQRS (puertos en `domain/services/`, con tokens)

```typescript
export const PROPOSAL_COMMAND_SERVICE = Symbol('PROPOSAL_COMMAND_SERVICE');
// Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query);
// cada método recibe el objeto comando/query — nunca primitivas sueltas ni `handle` sobrecargado.
export interface ProposalCommandService {
  draftProposal(cmd: DraftProposalCommand): Promise<ProposalId>;
  openProposal(cmd: OpenProposalCommand): Promise<void>;
  closeProposal(cmd: CloseProposalCommand): Promise<void>;
  tallyProposal(cmd: TallyProposalCommand): Promise<void>; // UC8
}
export const AUTHORIZATION_COMMAND_SERVICE = Symbol('AUTHORIZATION_COMMAND_SERVICE');
export interface VoteAuthorizationCommandService {
  requestVoteAuthorization(cmd: RequestVoteAuthorizationCommand): Promise<AuthorizationId>;
  grantVoteAuthorization(cmd: GrantVoteAuthorizationCommand): Promise<void>;
  denyVoteAuthorization(cmd: DenyVoteAuthorizationCommand): Promise<void>;
  expireVoteAuthorization(cmd: ExpireVoteAuthorizationCommand): Promise<void>;
}
export const VOTE_COMMAND_SERVICE = Symbol('VOTE_COMMAND_SERVICE');
export interface VoteCommandService {
  castVote(cmd: CastVoteCommand): Promise<VoteId>; // consume+cast atomico (H5)
  markVoteQueued(cmd: MarkVoteQueuedCommand): Promise<void>;
  markVoteSent(cmd: MarkVoteSentCommand): Promise<void>;
  markVoteConfirmed(cmd: MarkVoteConfirmedCommand): Promise<void>;
  markVoteFailed(cmd: MarkVoteFailedCommand): Promise<void>;
}
export const PROPOSAL_QUERY_SERVICE = Symbol('PROPOSAL_QUERY_SERVICE');
export interface ProposalQueryService {
  getProposalById(q: GetProposalByIdQuery): Promise<Proposal | null>;
  listProposalsByCommunityAndStatus(q: ListProposalsByCommunityAndStatusQuery): Promise<Proposal[]>;
  getTallyByProposal(q: GetTallyByProposalQuery): Promise<Tally | null>;
}
export const VOTE_QUERY_SERVICE = Symbol('VOTE_QUERY_SERVICE');
export interface VoteQueryService {
  getVoterReceiptByProposalAndVoter(q: GetVoterReceiptByProposalAndVoterQuery): Promise<VoterReceipt | null>;
  getVerifiableProofByVote(q: GetVerifiableProofByVoteQuery): Promise<VerifiableProof | null>;
}
```

---

<a name="application"></a>

## 3. Application Layer

### 3.1 UC4 CastVote (ancla) — dos agregados + Wallet en una transaccion de negocio

```typescript
@Injectable()
export class VoteCommandServiceImpl implements VoteCommandService {
  constructor(
    @Inject(PROPOSAL_REPOSITORY) private readonly proposals: ProposalRepository,
    @Inject(AUTHORIZATION_REPOSITORY) private readonly auths: VoteAuthorizationRepository,
    @Inject(VOTE_REPOSITORY) private readonly votes: VoteRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    private readonly events: EventEmitter2,
    private readonly wallet: ExternalWalletService,                 // R4 → WALLET_CONTEXT_FACADE
    @Inject(SIGNATURE_POLICY) private readonly signatures: SignaturePolicy,
    private readonly notifications: ExternalNotificationsService,  // R11 → NOTIFICATION_CONTEXT_FACADE
  ) {}
  async castVote(cmd: CastVoteCommand): Promise<VoteId> {
  const auth = await this.auths.findById(cmd.authorizationId) ?? throwNotFound(); // guards antes de firmar
  const proposal = await this.proposals.findById(auth.proposalId) ?? throwNotFound();
  proposal.assertOpen();            // si no -> LateVoteRejectedEvent
  proposal.assertChoice(cmd.choice); // si no -> InvalidChoice
  if (auth.isConsumedOrExpired()) throw new ReplayRejectedError(...);
  const nonce = VoteNonce.fresh();
  const contentRef = Vote.buildMessage(proposal.id, auth.voterAddress, cmd.choice, nonce);
  const sigRaw = await this.wallet.sign(auth.walletIdHint, contentRef); // R4, transitorio
  const recovered = VoterAddress.of(await this.signatures.recoverSigner(contentRef, sigRaw));
  if (!recovered.equals(auth.voterAddress)) throw new SignerMismatchError('SignerMismatch');
  const vote = await this.uow.run(async () => { // paso atomico H5
    const a = (await this.auths.findById(cmd.authorizationId))!;
    const voteId = VoteId.generate();
    a.consume(voteId); // cierra la ventana doble-cast
    const v = Vote.cast(voteId, a.proposalId, a.voterAddress, cmd.choice, nonce, EIP712Signature.from(sigRaw), recovered);
    await this.auths.save(a); await this.votes.save(v);
    return v;
  });
  this.publish(vote, auth); // VoteMessageBuiltEvent + VoteCastEvent + VoteAuthorizationConsumedEvent post-commit
  await this.notifications.voteCast(auth.voterAddress.value, vote.id.value); // R11 vía ExternalNotificationsService → NOTIFICATION_CONTEXT_FACADE
  return vote.id;
  }
  private publish(vote: Vote, auth: VoteAuthorization): void {
    for (const e of [...vote.pullDomainEvents(), ...auth.pullDomainEvents()]) this.events.emit(e.eventName, e);
  }
}
```

Si persistir falla tras firmar, la firma se descarta: reintento = nuevo `CastVoteCommand` contra la misma autorizacion aun-`PENDING`. UC4 no re-pregunta elegibilidad ni liveness (confia en la autorizacion congelada de UC3). Handlers con `@OnEvent(..., { async: true })` + `try/catch` (fallo de aviso/relay no revierte el commit); publicacion post-`uow.run` (outbox logico: primero commit, luego `emit`; outbox persistente como OQ si se exige exactly-once cross-BC). `EventEmitterModule.forRoot()` solo en `AppModule` — este modulo solo inyecta `EventEmitter2`.

### 3.2 UC1/UC2/UC7/UC8 + UC3 + UC5/UC6/UC9

| UC | Orquestacion |
|:--|:--|
| UC1 Draft | `Proposal.create()` → save → `ProposalDraftedEvent` |
| UC2 Open | `ExternalCommunityService.getPolicy()` (R1) → `proposal.open(snapshot)` → `ProposalOpenedEvent` |
| UC3 RequestAuth | `request()` → `ExternalMembership.isEligible()` (R2, congela snapshot) → `ExternalBiometric.isVerifiedNow()` (R3) → `grant()` / `deny(reason)` |
| UC5 DeliverVote | `@OnEvent(VoteCastEvent.eventName)` (VoteCastEventHandler) → `markVoteQueued(MarkVoteQueuedCommand)` → `ExternalRelayService.acceptSigned()` (R5) → `markVoteSent(MarkVoteSentCommand)` |
| UC6 HandleOutcome | Relay `DeliveryConfirmedEvent/DeliveryFailedEvent` → `markVoteConfirmed(MarkVoteConfirmedCommand)` (solo este cuenta) / `markVoteFailed(MarkVoteFailedCommand)` + aviso R11 |
| UC7/UC8 | `close()` → `ProposalClosedEvent` → handler (ProposalClosedEventHandler): tally solo `CONFIRMED` vs snapshot → `ProposalTalliedEvent + QuorumReachedEvent/QuorumNotReachedEvent` |
| UC9 Expire-sweep | cron: `PENDING` vencidos → `expire()` → `VoteAuthorizationExpiredEvent` |

### 3.3 Queries (read models)

`GetProposalById / ListProposalsByCommunityAndStatus / GetTallyByProposal / GetVoterReceiptByProposalAndVoter` → **Proposal Detail · Tally · Voter Receipt · Verifiable Proof** (choice + firma + txHash + recovered — verificable sin confiar en Morocoders).

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 Persistencia — 3 tablas, sin voto embebido

```typescript
@Entity('proposals')
export class ProposalOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() communityId: string;
  @Column() status: string; // parseProposalStatus al leer
  @Column('jsonb') options: string[];
  @Column('jsonb', { nullable: true }) quorumSnapshot: { threshold: number; basis: string } | null;
  @Column('jsonb', { nullable: true }) tally: { counts: Record<string, number>; turnout: number; quorumMet: boolean } | null;
}
@Entity('authorizations')
export class VoteAuthorizationOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() proposalId: string;
  @Column() voterAddress: string; // lowercase
  @Column() status: string;
  @Column({ nullable: true }) denialReason: string | null;
  @Column() expiresAt: Date;
  @Column('jsonb', { nullable: true }) eligibilitySnapshot: unknown | null;
}
@Entity('votes')
export class VoteOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() proposalId: string;
  @Column() voterAddress: string;
  @Column() choice: string;
  @Column() nonce: string;
  @Column('jsonb') signature: { v: number; r: string; s: string };
  @Column({ nullable: true }) txHash: string | null;
  @Column({ nullable: true }) blockNumber: number | null;
  @Column() status: string;
}
```

`jsonb` solo para detalles con forma de VO (options, snapshots, signature) — nunca para hijos con identidad (aqui no hay: tres raices separadas por H1).

### 4.2 Strategy: `SignaturePolicy` + `QuorumPolicy` (puertos application, sin hardcode)

Puertos en `application/internal/outboundservices/signing/signature-policy.service.ts` y `application/internal/outboundservices/quorum/quorum-policy.service.ts` (el dominio los consume — `recovered.equals(declarado)`, `verdictFor` — nunca los implementa):

```typescript
export const SIGNATURE_POLICY = Symbol('SIGNATURE_POLICY');
export interface SignaturePolicy { recoverSigner(contentRef: string, sig: string): Promise<string>; }
export const QUORUM_POLICY = Symbol('QUORUM_POLICY');
export interface QuorumPolicy { verdictFor(turnout: number, snapshot: QuorumSnapshot): boolean; }
```

`EthersSignaturePolicy` (real: reconstruye typed-data EIP-712 + `ecrecover` via `ethers-signature-verification.service.ts`) vs `FakeSignaturePolicy` (test: eco del firmante declarado). `ThresholdQuorumPolicy` (real: `turnout >= threshold`) vs `AlwaysMetQuorumPolicy` (test). El dominio solo compara `recovered.equals(declarado)` y consume `verdictFor`; swap por providers `SIGNATURE_POLICY` / `QUORUM_POLICY` — sin `if (env)` en aplicacion.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

| Metodo | Endpoint | Descripcion |
|:--|:--|:--|
| `POST` | `/api/v1/proposals` | Draft (UC1) → 201 + Location |
| `POST` | `/api/v1/proposals/:id/open` | Open (UC2) |
| `POST` | `/api/v1/proposals/:id/close` | Close (UC7) |
| `GET` | `/api/v1/proposals/:id` | Proposal Detail |
| `GET` | `/api/v1/proposals/:id/tally` | Tally / quorum (tras TALLIED) |
| `POST` | `/api/v1/authorizations` | RequestAuth (UC3) |
| `POST` | `/api/v1/votes` | CastVote (UC4, ancla) → receipt SIGNED (header `Idempotency-Key` requerido; ver §7.1) |
| `GET` | `/api/v1/votes/:id` | Verifiable Proof (choice+firma+tx+recovered) |
| `GET` | `/api/v1/votes/receipt?proposal=&voter=` | Voter Receipt (mi journey, sin choices ajenos) |

Controller delgado con `@UseFilters(VotingExceptionFilter)` (skill: filtro BC-scoped en el controller). Filtro `VotingExceptionFilter` (skill: toda excepción del agregado tiene entrada `@Catch`; error → HTTP; el hecho de scrutiny se registra antes de lanzar): `ProposalNotOpenError → 422` (registrado como `LateVoteRejectedEvent`), `InvalidChoiceError → 422`, `SignerMismatchError → 422`, `ReplayRejectedError → 409` (registrado como `ReplayRejectedEvent`), `AuthorizationAlreadyConsumedError → 409`, `AuthorizationExpiredError → 410`, `VoteNotFoundError → 404`, `IllegalProposalTransitionError → 409`.

### 5.1 Fachada publicada `VOTING_CONTEXT_FACADE` (primitivas; primer consumidor futuro: Reporting)

```typescript
export const VOTING_CONTEXT_FACADE = Symbol('VOTING_CONTEXT_FACADE');
export interface VotingContextFacade { getTally(proposalId: string): Promise<{ counts: Record<string, number>; turnout: number; quorumMet: boolean }>; getProof(voteId: string): Promise<{ choice: string; signature: { v: number; r: string; s: string }; txHash: string | null; recovered: string }>; }
```

Hoy sin consumidores cross-modulo (reads los consume la UI). Impl en `application/acl/voting-context-facade.impl.ts` delegando a los query services; primitivos (el consumidor traduce a sus VOs). `voting.module.ts` `exports: [VOTING_CONTEXT_FACADE]`. Si Relay/Voting llegan a importarse mutuamente, usar `forwardRef(() => ...)` en los modulos — hoy innecesario (dependencia unidireccional Voting → Relay via ACL).

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Schema `voting` (unicidades parciales = replay estructuralmente imposible; tally con `WHERE status='CONFIRMED'`):

```sql
CREATE SCHEMA IF NOT EXISTS voting;
CREATE TABLE voting.proposals (
  id TEXT PRIMARY KEY, community_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','OPEN','CLOSED','TALLIED')),
  options JSONB NOT NULL, quorum_snapshot JSONB NULL, tally JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE voting.authorizations (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES voting.proposals(id),
  voter_address TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('PENDING','CONSUMED','EXPIRED','DENIED')),
  denial_reason TEXT NULL, expires_at TIMESTAMPTZ NOT NULL, eligibility_snapshot JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE voting.votes (
  id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES voting.proposals(id),
  voter_address TEXT NOT NULL, choice TEXT NOT NULL, nonce TEXT NOT NULL,
  signature JSONB NOT NULL, tx_hash TEXT NULL, block_number INT NULL,
  status TEXT NOT NULL CHECK (status IN ('SIGNED','QUEUED','SENT','CONFIRMED','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, voter_address, nonce)
);
-- Dedup de transporte (NO es agregado, sin puerto en domain/, solo lo usa la capa interfaces):
-- SUPERSEDE 2026-10-03: la columna `receipt` fue eliminada por la migracion
-- 1759276800000-drop-request-log-receipt. Solo se guarda idempotency_key -> vote_id; un reintento
-- con la misma clave relee el voto por id en lugar de reproducir un snapshot de receipt.
CREATE TABLE voting.request_log (
  idempotency_key TEXT PRIMARY KEY, vote_id TEXT NOT NULL REFERENCES voting.votes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_auth_pending ON voting.authorizations (proposal_id, voter_address) WHERE status = 'PENDING';
CREATE UNIQUE INDEX uq_vote_confirmed ON voting.votes (proposal_id, voter_address) WHERE status = 'CONFIRMED';
CREATE INDEX idx_votes_proposal_status ON voting.votes (proposal_id, status);
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 UC4 CastVote (ancla) — resumen

```
POST /votes { authorizationId, choice }
  -> guards (auth PENDING, proposal OPEN, choice valida)
  -> buildMessage -> Wallet.sign (R4) -> recoverSigner == voter?
  -> [uow.run] consume(auth) + cast(vote) atomico -> commit
  -> publish(VoteCastEvent, VoteAuthorizationConsumedEvent) -> handler UC5 (VoteCastEventHandler) + aviso R11
  -> 201 receipt { voteId, SIGNED }
```

Reintento HTTP del mismo voto (no es concepto de dominio): `POST /votes` exige header `Idempotency-Key`; clave repetida retorna el receipt guardado en `voting.request_log` sin invocar el caso de uso. El dominio garantiza un solo `CONFIRMED` por `(proposal, voter)` via autorizacion consumida + `uq_vote_confirmed`.

### 7.2 UC5 → UC6 → UC8

```
@OnEvent(VoteCastEvent.eventName) -> markVoteQueued -> Relay.acceptSigned (R5) -> markVoteSent
Relay outcome -> markVoteConfirmed (factura al tally) | markVoteFailed (+retry misma identidad)
@OnEvent(ProposalClosedEvent.eventName) -> tally solo CONFIRMED vs snapshot -> ProposalTalliedEvent + QuorumReachedEvent/QuorumNotReachedEvent
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

| Relacion | Patron | Usado en |
|:--|:--|:--|
| R1 Community → Voting | OHS + ACL | UC2: policy → `QuorumSnapshot` congelado |
| R2 Membership → Voting | OHS + ACL | UC3: elegibilidad → `EligibilitySnapshot` congelado |
| R3 Biometric → Voting | Customer/Supplier | UC3: veredicto verified-now (ventana freshness) |
| R4 Voting → Wallet | Customer/Supplier | UC4: firma de un contenido; de vuelta solo la firma |
| R5 Voting → Relay | Customer/Supplier + OHS | UC5/UC6: signed-only; solo `DeliveryConfirmedEvent` alimenta tally |
| R11 Voting → Notifications | OHS | Aviso vote-cast receipt via `ExternalNotificationsService` (dispatch real al audit mailbox; intents, nunca decisiones) |

Voting publica `VOTING_CONTEXT_FACADE` (sin consumidores internos hoy; sus reads los consume la UI, no otro BC). Si Reporting se escinde, nace ahi el primer consumidor publicado.

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Dependencia | Puerto | Adaptador | Estado |
|:--|:--|:--|:--|
| ethers/viem (EIP-712) | `SignaturePolicy` (`SIGNATURE_POLICY`) | `ethers-signature-verification.service.ts` | Port & Adapter |
| Community/Membership/Biometric | `External{...}Service` | ACL en proceso | Consumidas (R1/R2/R3) |
| `WALLET_CONTEXT_FACADE` | `ExternalWalletService` | ACL en proceso | Consumida (R4) |
| `RELAY_CONTEXT_FACADE` | `ExternalRelayService` | ACL en proceso | Consumida (R5) |
| Notifications (dispatch) | `ExternalNotificationsService` | `ExternalNotificationsService` (dispatch real al audit mailbox) | Real (R11) |
| Postgres (`voting.*`) | 3 repository ports | 3 adapters + `TransactionContext` | Correcto |

`voting.auth.ttl-minutes=${VOTING_AUTH_TTL_MINUTES:15}`, `voting.chain.id=${CHAIN_ID:80002}` (Amoy).

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| D1 | Alta | `Proposal` owneando `Vote[]` embebidos | Rechazado (H1): 3 agregados por ID; sin contencion |
| D2 | Alta | `consume()` y `cast()` en tx separadas | Un `uow.run` atomico (H5); doble-cast imposible. Desviación intencional documentada de tactical-patterns (un agregado por tx): la autorización se consume —su lifecycle termina— y el voto nace en el mismo paso indivisible; sin estado compartido posterior ni segunda escritura. Alternativa eventual-consistente rechazada: reabriría la ventana de doble-cast |
| D3 | Alta | Tally contando `SIGNED/QUEUED/SENT` | Solo `CONFIRMED` (H4 intent vs fact) |
| D4 | Media | Re-preguntar elegibilidad/liveness en UC4 | Prohibido: UC4 confia en la autorizacion congelada |
| D5 | Media | `as ProposalStatus` / `as VoteStatus` en assemblers | `parseX()` vía `Object.values()` explícitos; enums como `as const` + `type` union + `@IsIn(Object.values(X))`; dato corrupto falla al leer |
| D6 | Media | `@OnEvent(VoteCastEvent.eventName)` suscrito desde Relay | Prohibido: handler interno (VoteCastEventHandler) llama `ExternalRelayService` |
| D7 | Baja | VoterAddress sin normalizar | `of()` valida `0x+40hex`, guarda lowercase |
| D8 | Baja | `choice` como string libre | `assertChoice` contra `BallotOptions` en UC4 |
| D9 | Media | Tentacion Composite Proposal+votes o assembler base compartido | No Composite (D1/H1/Inv.5): tally guarda counts-no-objetos, tres raices por ID; sin base assembler (cada `toDomain` con su `parseX`) |
| V1.0.7 | Baja | Naming v1.0.7: forma enum clásica / `in` / `@IsEnum`, eventos sin sufijo `Event`, handlers `<Stem>Handler` / `*.handler.ts` | Enums como `as const` + `type` union + `parseX()` vía `Object.values()` + `@IsIn(Object.values(X))`; eventos con sufijo `Event` (wire `eventName` inalterado, sin doble sufijo); handlers `VoteCastEventHandler`/`ProposalClosedEventHandler` en `*.event-handler.ts` con `@OnEvent(XEvent.eventName)` |

> **Project override (v1.0.7):** sufijo `Event` en TODOS los eventos (no solo en colisión); wire `eventName='X'` inalterado (fix-back tras replaceAll, evitar doble sufijo); comandos Voting UNCHANGED.

### Decisiones

1. **Voto transparente:** proof expone choice+firma+tx (H6). Ballot secreto seria otro concepto.
2. **Un voto inmutable:** sin re-vote (OQ1 parked); supersede necesitaria concepto explicito.
3. **201 con receipt `SIGNED`:** la intencion vuelve ya; `CONFIRMED` llega despues via UC6.

### Preguntas abiertas

OQ1 re-vote · OQ2 TTL de autorizacion · OQ3 quien cierra · OQ4 confirmaciones chain antes de CONFIRMED (reorgs) · OQ5 secreto vs transparencia · OQ6 suficiencia del tally minimo (Reporting escindido o no).

## 11. Testing (skill §Testing each layer)

- **domain** (plain unit): `Proposal` DRAFT→OPEN→CLOSED→TALLIED (transiciones ilegales rechazadas); `consume()` + `Vote.cast()` atómico (H5); replay/late/signer-mismatch rechazados; tally solo `CONFIRMED` (regresión TECH-DEBT-01).
- **application**: mocks de los 3 repos + `ExternalWalletService`/`SIGNATURE_POLICY` (Fake echo), o `overrideProvider(...)`.
- **infrastructure**: Testcontainers Postgres — `uq_auth_pending`, `uq_vote_confirmed`, round-trip + `parseProposalStatus()` corrupto.
- **interfaces**: supertest (UC1–UC4 + UC5/UC6/UC8; `Idempotency-Key` en `POST /votes`).
