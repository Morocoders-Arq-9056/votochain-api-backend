## Relay y Entrega de Transacciones — NestJS | DDD | CQRS | Monolito Modular

> BC de soporte. Lleva contenido **ya firmado** al ledger compartido e informa el resultado. Nunca firma, nunca decide el voto, nunca talla.

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
src/blockchain-relay-transaction-delivery/
├── interfaces/
│   ├── rest/ (delivery.controller.ts, resources/, transform/)
│   ├── acl/relay-context.facade.ts               # answerDeliveryStanding()
│   └── filters/relay-exception.filter.ts
├── application/
│   ├── acl/relay-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/delivery-command.service.impl.ts  # accept + DeliverOrder
│       ├── queryservices/delivery-query.service.impl.ts
│       ├── eventhandlers/ (delivery-confirmed.handler.ts, delivery-event.logger.ts)
│       └── outboundservices/
│           ├── ledger/ledger-gateway.service.ts  # Port: hand-over + observe outcome
│           ├── queue/delivery-queue.service.ts   # Port: orden de envio (BullMQ)
│           └── acl/external-voting.service.ts    # notifyConfirmed/Failed/Abandoned
├── domain/
│   ├── model/
│   │   ├── aggregates/delivery-order.aggregate.ts
│   │   ├── entities/sending-attempt.entity.ts
│   │   ├── valueobjects/ (delivery-order-id, signed-content-ref, payer-ref, sending-order-position, failure-reason)
│   │   ├── commands/ (accept-for-delivery, record-ledger-outcome)
│   │   ├── queries/ (standing-by-order, sending-order-by-payer, attempt-history-by-order)
│   │   └── events/ (7 hechos)
│   ├── services/ (delivery-command, delivery-query + tokens)
│   ├── repositories/delivery-order.repository.ts
│   └── exceptions/ (unsigned-content-refused, order-already-accepted, illegal-delivery-state)
├── infrastructure/
│   ├── persistence/typeorm/ (entities/, assemblers/, adapters/)
│   ├── ledger/polygon-amoy/polygon-amoy-ledger-gateway.ts  # Adapter RPC Amoy
│   └── queue/bullmq/bullmq-delivery-queue.ts              # Adapter BullMQ+Redis
└── blockchain-relay-transaction-delivery.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer

> Cero imports de `@nestjs/*`, `typeorm`, `class-validator` en `domain/`.

### 2.0 Interfaz `Deliverable` (sin esqueleto)

```typescript
export interface Deliverable {
  order(): void; recordSending(): void; recordConfirmation(): void;
  recordFailure(reason: FailureReason): void; retry(policy: RetryPolicy): void; abandon(reason: FailureReason): void;
}
```

`DeliveryOrder implements Deliverable`. Sin esqueleto: los guards son el audit trail y quedan explicitos en el agregado — confirmacion exacta desde ledger (`confirm only from SENT`), `LEDGER_REJECTED`/`RETRY_LIMIT_REACHED`/`COST_EXHAUSTED`/`ORDER_SUPERSEDED` como razones tipadas, no-overtaking por `(payer, position)`, y `RetryAfterConfirmationRefused` (post-`CONFIRMED` nada muta). `recordSending`/`recordFailure` son Factory create-methods de los hijos: crean `SendingAttempt` (`createSent(nro)` / `createFailed(nro, reason)`) y los anexan append-only.

### 2.1 Aggregate Root: `DeliveryOrder`

ACCEPTED → ORDERED → SENT → CONFIRMED (terminal) / FAILED → RETRIED → ORDERED / → ABANDONED (terminal).

```typescript
export enum DeliveryStanding { ACCEPTED = 'ACCEPTED', ORDERED = 'ORDERED', SENT = 'SENT', CONFIRMED = 'CONFIRMED', FAILED = 'FAILED', RETRIED = 'RETRIED', ABANDONED = 'ABANDONED' }
export function parseDeliveryStanding(v: string): DeliveryStanding {
  if (!(v in DeliveryStanding)) throw new Error(`invalid delivery standing: ${v}`);
  return DeliveryStanding[v as keyof typeof DeliveryStanding];
}
export class DeliveryOrder extends AggregateRoot {
  private constructor(private readonly _id: DeliveryOrderId, private readonly _contentRef: SignedContentRef, private readonly _payerRef: PayerRef, private readonly _orderPosition: SendingOrderPosition, private _standing: DeliveryStanding, private readonly _attempts: SendingAttempt[]) { super(); }
  static accept(id: DeliveryOrderId, content: SignedContentRef, payer: PayerRef, pos: SendingOrderPosition, signedProof: boolean): DeliveryOrder {
    if (!signedProof) throw new UnsignedContentRefusedError('content must arrive already signed');
    const o = new DeliveryOrder(id, content, payer, pos, DeliveryStanding.ACCEPTED, []);
    o.registerEvent(new AcceptedForDelivery(id, content, payer));
    return o;
  }
  static rehydrate(id: DeliveryOrderId, content: SignedContentRef, payer: PayerRef, pos: SendingOrderPosition, standing: DeliveryStanding, attempts: SendingAttempt[]): DeliveryOrder {
    return new DeliveryOrder(id, content, payer, pos, standing, [...attempts]);
  }
  order(): void {
    if (this._standing !== DeliveryStanding.ACCEPTED && this._standing !== DeliveryStanding.RETRIED) throw new IllegalDeliveryStateError('order only from ACCEPTED/RETRIED');
    this._standing = DeliveryStanding.ORDERED;
    this.registerEvent(new OrderedForSending(this._id, this._payerRef, this._orderPosition));
  }
  recordSending(): void {
    if (this._standing !== DeliveryStanding.ORDERED) throw new IllegalDeliveryStateError('send only from ORDERED');
    this._attempts.push(new SendingAttempt(this._attempts.length + 1, 'SENT'));
    this._standing = DeliveryStanding.SENT;
    this.registerEvent(new SendingRecorded(this._id, this._attempts.length));
  }
  recordConfirmation(): void {
    if (this._standing !== DeliveryStanding.SENT) throw new IllegalDeliveryStateError('confirm only from SENT');
    this._standing = DeliveryStanding.CONFIRMED;
    this.registerEvent(new DeliveryConfirmed(this._id, this._contentRef));
  }
  recordFailure(reason: FailureReason): void {
    if (this._standing !== DeliveryStanding.SENT) throw new IllegalDeliveryStateError('fail only from SENT');
    this._attempts.push(new SendingAttempt(this._attempts.length + 1, 'FAILED', reason));
    this._standing = DeliveryStanding.FAILED;
    this.registerEvent(new DeliveryFailed(this._id, reason));
  }
  retry(policy: RetryPolicy): void {
    if (this._standing === DeliveryStanding.CONFIRMED) throw new IllegalDeliveryStateError('RetryAfterConfirmationRefused');
    if (this._standing !== DeliveryStanding.FAILED) throw new IllegalDeliveryStateError('retry only from FAILED');
    if (!policy.shouldRetry(this._attempts.length, this.lastReason())) throw new IllegalDeliveryStateError('RetryLimitReached');
    this._standing = DeliveryStanding.RETRIED;
    this.registerEvent(new DeliveryRetried(this._id, this._attempts.length + 1));
  }
  abandon(reason: FailureReason): void {
    if (this._standing !== DeliveryStanding.FAILED) throw new IllegalDeliveryStateError('abandon only from FAILED');
    this._standing = DeliveryStanding.ABANDONED;
    this.registerEvent(new DeliveryAbandoned(this._id, reason));
  }
  answerDeliveryStanding(): { standing: DeliveryStanding; reason: string | null } {
    const last = [...this._attempts].reverse().find((a) => a.reason !== null);
    return { standing: this._standing, reason: last?.reason?.value ?? null };
  }
  get id(): DeliveryOrderId { return this._id; }
}
```

**Invariantes:** solo-firmado (`UnsignedContentRefused`); sin adelantamiento por pagador (posicion densa por payer); intentos append-only, reintento dentro de la misma orden (at-most-once); `CONFIRMED`/`ABANDONED` terminales; pagador != capacidad de firma del votante.

### 2.2 Value Objects / Entidad interna

`DeliveryOrderId` (`dlo-uuid`), `SignedContentRef`, `PayerRef`: `of()` + `equals()`, nunca intercambiables. `SendingOrderPosition`: entero `>= 0`, denso por payer (rephrase del sequence counter). `SendingAttempt` (entidad interna): `{ nro, outcome: SENT|FAILED, reason? }`, inmutable, append-only. `FailureReason`: `LEDGER_REJECTED | COST_EXHAUSTED | RETRY_LIMIT_REACHED | ORDER_SUPERSEDED`, con `isRetryable()`.

### 2.3 Events (7) y puertos

`AcceptedForDelivery | OrderedForSending | SendingRecorded | DeliveryConfirmed | DeliveryFailed | DeliveryRetried | DeliveryAbandoned` — `implements DomainEvent`, `static eventName`, VOs tipados. `DeliveryConfirmed/Failed/Abandoned` los consume Voting (R5). Repository: `findById`, `findOpenByContent`, `findByPayer`, `nextPositionForPayer`, `save`.

---

<a name="application"></a>

## 3. Application Layer

### 3.1 Command Service — ancla UC2 DeliverOrder

```typescript
@Injectable()
export class DeliveryCommandServiceImpl implements DeliveryCommandService {
  constructor(@Inject(DELIVERY_ORDER_REPOSITORY) private readonly orders: DeliveryOrderRepository, @Inject(LEDGER_GATEWAY) private readonly ledger: LedgerGatewayService, @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueueService, @Inject(RETRY_POLICY) private readonly retries: RetryPolicy, @Inject(FEE_POLICY) private readonly fees: FeePolicy, @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork, private readonly events: EventEmitter2) {}
  async accept(cmd: AcceptForDeliveryCommand): Promise<DeliveryOrderId> { // cmd trae idempotencyKey: reintento HTTP reusa la orden abierta
    const order = await this.uow.run(async () => {
      const open = await this.orders.findOpenByContent(cmd.contentRef);
      if (open) return open; // idempotente por contentRef abierto + idempotencyKey
      if (await this.orders.findOpenByContent(cmd.contentRef)) throw new OrderAlreadyAcceptedError('OrderAlreadyAccepted');
      const pos = await this.orders.nextPositionForPayer(cmd.payerRef);
      const o = DeliveryOrder.accept(DeliveryOrderId.generate(), cmd.contentRef, cmd.payerRef, pos, cmd.signedProof);
      await this.orders.save(o);
      return o;
    });
    this.publish(order);
    await this.queue.enqueue(order.id.value);
    return order.id;
  }
  async deliver(orderId: DeliveryOrderId): Promise<void> { // UC2: order -> send -> observe -> confirm | fail -> retry | abandon
    const ordered = await this.uow.run(async () => {
      const o = (await this.orders.findById(orderId)) ?? (() => { throw new OrderNotFoundError(); })();
      o.order(); await this.orders.save(o); return o;
    });
    this.publish(ordered);
    const sent = await this.uow.run(async () => {
      const o = (await this.orders.findById(orderId))!;
      o.recordSending(); await this.orders.save(o); return o;
    });
    this.publish(sent);
    const outcome = await this.ledger.submit(sent.id.value); // fuera de la tx
    const closed = await this.uow.run(async () => {
      const o = (await this.orders.findById(orderId))!;
      if (outcome.confirmed) o.recordConfirmation();
      else {
        o.recordFailure(FailureReason.of(outcome.reason));
        if (!this.fees.canAfford(o)) o.abandon(FailureReason.of('COST_EXHAUSTED'));
        else if (outcome.retryable) { try { o.retry(this.retries); } catch { o.abandon(FailureReason.of('RETRY_LIMIT_REACHED')); } }
        else o.abandon(FailureReason.of(outcome.reason));
      }
      await this.orders.save(o); return o;
    });
    this.publish(closed); // el handler interno avisa a Voting (R5)
  }
  private publish(o: DeliveryOrder): void {
    for (const e of o.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
```

Confirmacion y reintento en carrera se resuelven por standing: si `recordConfirmation()` gano, el reintento tardio falla con `RetryAfterConfirmationRefused`. Doble observacion del ledger se ignora (standing ya salio de `SENT`).

### 3.2 Queries, ports y handlers

`getStandingByOrder` → `answerDeliveryStanding()`; `getSendingOrderByPayer` (por que espera una orden tardia); `getAttemptHistoryByOrder` (scrutiny). Ports: `LedgerGatewayService.submit()` → `{ confirmed, reason, retryable }`; `DeliveryQueueService.enqueue()`. `DeliveryConfirmedHandler` + `DeliveryFailedHandler` + `DeliveryAbandonedHandler`: `@OnEvent(<evt>.eventName, { async: true })` en este modulo → `ExternalVotingService.notifyConfirmed/Failed/Abandoned()` (R5, ACL en proceso, con `try/catch` + log; fallo de aviso no revierte la orden). Ningun `@OnEvent` vive en otro modulo.

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 Persistencia — padre + tabla hija

```typescript
@Entity('orders')
export class DeliveryOrderOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;
  @Column() contentRef: string;
  @Column() payerRef: string;
  @Column('int') orderPosition: number;
  @Column() standing: string;
  @OneToMany(() => SendingAttemptOrmEntity, (a) => a.order, { cascade: true })
  attempts: SendingAttemptOrmEntity[];
}
@Entity('sending_attempts')
export class SendingAttemptOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string; // orderId:nro
  @Column() attemptNo: number;
  @Column() outcome: string;   // SENT | FAILED
  @Column({ nullable: true }) reason: string | null;
  @ManyToOne(() => DeliveryOrderOrmEntity, (o) => o.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' }) order: DeliveryOrderOrmEntity;
}
```

Hija en tabla propia (no `jsonb`): los intentos tienen identidad y se consultan por separado. Assembler con `parseDeliveryStanding()` / `parseFailureReason()` — nunca `as`.

### 4.2 Cola BullMQ + Redis y RPC Polygon Amoy

`bullmq-delivery-queue.ts`: `enqueue()` publica `{ orderId }` al topic `delivery.send`; un worker del modulo consume y llama `deliver()`. Reintentos de transporte (BullMQ) != reintentos de dominio (`retry()`): la cola re-ejecuta, el agregado decide el efecto at-most-once. `polygon-amoy-ledger-gateway.ts`: envia la transaccion firmada via RPC Amoy y observa confirmacion/fallo; solo traduce outcome, el significado lo decide Voting.

### 4.3 Strategy: `RetryPolicy` + `FeePolicy` (ports de dominio, sin hardcode)

```typescript
export interface RetryPolicy { shouldRetry(attempts: number, reason: FailureReason | null): boolean; }
export interface FeePolicy { canAfford(order: { payerRef: PayerRef }): boolean; }
```

`BoundedRetryPolicy(max)` (prod `relay.retry.max`, default 5) vs `NoRetryPolicy` (test: un solo intento); `BalanceFeePolicy(ledger)` vs `AlwaysAffordFeePolicy` (test). Agregado y servicio ya no conocen `MAX_RETRIES` ni `COST_EXHAUSTED` hardcodeado: `retry(policy)` y `fees.canAfford()` deciden; swap por providers `RETRY_POLICY` / `FEE_POLICY`.

### 4.4 Template Method fuera de agregados: `BaseLedgerGateway`

```typescript
export abstract class BaseLedgerGateway implements LedgerGatewayService {
  async submit(orderId: string): Promise<LedgerOutcome> {
    const tx = await this.buildTx(orderId);
    const hash = await this.broadcast(tx);
    return this.observe(hash); // hooks abajo
  }
  protected abstract buildTx(orderId: string): Promise<unknown>;
  protected abstract broadcast(tx: unknown): Promise<string>;
  protected abstract observe(hash: string): Promise<LedgerOutcome>;
}
```

Unico Template fuera de agregados. `PolygonAmoyGateway extends BaseLedgerGateway` solo sobreescribe los hooks (construir + broadcast via RPC Amoy + observar confirmacion/fallo); por-BC se anade otro gateway heredando sin tocar el flujo.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

| Metodo | Endpoint | Descripcion |
|:--|:--|:--|
| `POST` | `/api/v1/deliveries` | `AcceptForDeliveryCommand` → 202 + `Location: /api/v1/deliveries/:id` |
| `GET` | `/api/v1/deliveries/:id` | standing + reason (UC3) |
| `GET` | `/api/v1/deliveries?payer=` | sending order por pagador |
| `GET` | `/api/v1/deliveries/:id/attempts` | historial de intentos |

`RelayContextFacade.answerStanding(orderId)` en primitivos (Voting traduce). Filtro: `OrderNotFound → 404`, `UnsignedContentRefused → 422`, `IllegalDeliveryState → 409`.

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Schema `relay`:

```sql
CREATE SCHEMA IF NOT EXISTS relay;
CREATE TABLE relay.orders (
  id TEXT PRIMARY KEY, content_ref TEXT NOT NULL, payer_ref TEXT NOT NULL,
  order_position INT NOT NULL, standing TEXT NOT NULL
    CHECK (standing IN ('ACCEPTED','ORDERED','SENT','CONFIRMED','FAILED','RETRIED','ABANDONED')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payer_ref, order_position), UNIQUE (idempotency_key)
);
CREATE UNIQUE INDEX uq_orders_open_content ON relay.orders (content_ref) WHERE standing NOT IN ('CONFIRMED','ABANDONED');
CREATE TABLE relay.sending_attempts (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES relay.orders(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL, outcome TEXT NOT NULL CHECK (outcome IN ('SENT','FAILED')),
  reason TEXT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, attempt_no)
);
CREATE INDEX idx_orders_payer ON relay.orders (payer_ref, order_position);
```

`UNIQUE(payer, position)` = no-overtaking estructural; `content_ref` ya NO es `UNIQUE` total sino parcial sobre no-terminales (`uq_orders_open_content`) — reintentar tras terminal no choca. `AcceptForDeliveryCommand` trae `idempotencyKey` (`UNIQUE(idempotency_key)`): reintento HTTP del mismo intake retorna la orden existente. `SendingCost` no es columna en MVP: costo incobrable = `recordFailure(COST_EXHAUSTED)` via `FeePolicy`.

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 UC1 AcceptDelivery

```
POST /api/v1/deliveries { contentRef, payerRef, signedProof }
 -> accept() [uow]: findOpenByContent (OrderAlreadyAccepted) -> nextPositionForPayer
 -> DeliveryOrder.accept (rechaza si !signedProof) -> save -> publish -> queue.enqueue
 -> 202 + Location
```

### 7.2 UC2 DeliverOrder (ancla)

```
worker BullMQ -> deliver(orderId)
 -> [uow] order() -> publish(OrderedForSending)
 -> [uow] recordSending() -> publish(SendingRecorded)
 -> ledger.submit() [fuera de tx]
 -> [uow] recordConfirmation | recordFailure -> retry (-> order de nuevo) | abandon
 -> publish -> handler interno -> ExternalVotingService.notify* (R5)
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

| Relacion | Patron | Mecanismo |
|:--|:--|:--|
| Voting → Relay (R5) | Customer/Supplier + OHS | Intake solo-firmado; `DeliveryConfirmed/Failed/Abandoned` → Voting UC6 via `ExternalVotingService` |
| Wallet ⋮ Relay (R6) | **Separate Ways** | Cero integracion directa; `payerRef` es referencia opaca, nunca la signing capability |
| Relay → Notifications | Via Voting | Relay no notifica personas; Voting decide el aviso con el reason |

Solo `CONFIRMED` cuenta para el tally (R5: intent vs fact).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Dependencia | Puerto | Adaptador | Estado |
|:--|:--|:--|:--|
| BullMQ + Redis (cola) | `DeliveryQueueService` | `bullmq-delivery-queue.ts` | Requiere Redis en dev/prod |
| Polygon Amoy RPC | `LedgerGatewayService` | `polygon-amoy-ledger-gateway.ts` | RPC URL + clave pagadora como secretos |
| Postgres (`relay.*`) | `DeliveryOrderRepository` | Adapter + `TransactionContext` | Correcto |
| Voting facade | `ExternalVotingService` | ACL en proceso | Consumida (out) |

`relay.amoy.rpc-url=${AMOY_RPC_URL}`, `relay.amoy.payer-key=${AMOY_PAYER_KEY}` (secreto, nunca en log), `relay.queue.redis-url=${REDIS_URL}`, `relay.retry.max=${RELAY_MAX_RETRIES:5}`.

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| D1 | Alta | Reintento como segunda orden del mismo contenido | Prohibido: `retry()` muta la misma orden, attempts append-only |
| D2 | Alta | `SendingAttempt` en `jsonb` sin identidad | Tabla hija `sending_attempts` |
| D3 | Media | `recordConfirmation` y `retry` en carrera | Resuelto por standing: post-`CONFIRMED`, reintento → `RetryAfterConfirmationRefused` |
| D4 | Media | Fachada con VOs de Relay | Primitivos; Voting traduce |
| D5 | Media | `@OnEvent(DeliveryConfirmed)` suscrito desde Voting | Prohibido: handler interno + ACL `ExternalVotingService` |
| D6 | **Alta** | Confundir reintento de cola (BullMQ) con reintento de dominio | Separados: BullMQ re-ejecuta `deliver()`; el agregado decide idempotencia por standing + `UNIQUE` parcial |
| D7 | Baja | `as DeliveryStanding` en assembler | `parseDeliveryStanding()` explicito |
| D8 | Media | `MAX_RETRIES` / `COST_EXHAUSTED` hardcodeados en agregado/servicio | Extraidos a `RetryPolicy.shouldRetry` + `FeePolicy` (providers, testeables) |
| D9 | Media | Duda Composite orden + intentos | **KEEP — unico Composite permitido:** `DeliveryOrder` ownea `SendingAttempt[]`, padre + tabla hija (intentos con identidad consultable) |

### Decisiones

1. **202 Accepted en intake:** la entrega es asincrona (cola + ledger); el cliente consulta standing.
2. **`UNIQUE(payer, position)`:** el no-overtaking es constraint, no solo codigo.
3. **Costo como fallo con razon:** `COST_EXHAUSTED` → abandona o espera por `reason` (OQ2), nunca espera silenciosa.

### Preguntas abiertas

OQ1 cota de reintentos · OQ2 costo incobrable: esperar/abandonar/pedir mas · OQ3 entregas en vuelo al borrar (el ledger no se des-hace) · OQ4 razones visibles al votante · OQ5 alcance del sending order (por pagador vs global).
