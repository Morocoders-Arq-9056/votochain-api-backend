## Custodia Criptografica de Billeteras — NestJS | DDD | CQRS | Monolito Modular

> BC de soporte. Guarda la **capacidad de firma** de cada persona: firma contenido de voto, nunca paga envios, nunca decide el voto, nunca entrega nada.

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
src/cryptographic-wallet-custody/
├── interfaces/
│   ├── rest/ (wallet.controller.ts, resources/, transform/)
│   ├── acl/wallet-context.facade.ts           # Fachada publicada (sign + capability)
│   └── filters/wallet-exception.filter.ts
├── application/
│   ├── acl/wallet-context-facade.impl.ts
│   └── internal/
│       ├── commandservices/wallet-command.service.impl.ts
│       ├── queryservices/wallet-query.service.impl.ts
│       ├── eventhandlers/wallet-event.logger.ts  # Solo @OnEvent interno (log)
│       └── outboundservices/
│           ├── kms/key-custody.service.ts                # Port: custodia + firma transitoria
│           ├── key-derivation/key-derivation.service.ts  # Port + WALLET_DERIVATION_STRATEGY
│           ├── signing-policy/signing-policy.service.ts  # Port + WALLET_SIGNING_POLICY
│           └── acl/
│               ├── external-iam.service.ts               # personExists(personId)
│               └── external-consent.service.ts           # notifyRetired() → CONSENT_CONTEXT_FACADE (§3.4)
├── domain/
│   ├── model/
│   │   ├── aggregates/user-wallet.aggregate.ts
│   │   ├── valueobjects/ (user-wallet-id, person-id, derivation-position)
│   │   ├── commands/ (provision, sign-vote-content, rotate, suspend, retire)
│   │   ├── queries/ (get-signing-capability-by-person, get-adminship-history-by-wallet)
│   │   └── events/ (6 hechos: provisioned, reconstructed, forgotten, rotated, suspended, retired)
│   ├── services/ (wallet-command.service.ts, wallet-query.service.ts + tokens)
│   ├── repositories/wallet.repository.ts      # + WALLET_REPOSITORY
│   └── exceptions/ (capability-already-exists, capability-not-found, illegal-wallet-state)
├── infrastructure/
│   ├── persistence/typeorm/ (entities/, assemblers/, adapters/)
│   ├── kms/hd-wallet/hd-key-custody.service.ts  # BIP-32, solo memoria (ver 4.2)
│   ├── kms/derivation/{hd,test}/                # HdKeyDerivation | TestKeyDerivation
│   └── kms/signing/{hsm,memory}/                 # HsmSigningPolicy | MemorySigningPolicy
└── cryptographic-wallet-custody.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer

> **Regla dura:** cero imports de `@nestjs/*`, `typeorm` o `class-validator` en `domain/`.

### 2.0 Interfaces de capacidad (sin esqueleto)

```typescript
export interface Signable { reconstructForSigning(contentRef: SignedContentRef): void; forget(): void; }
export interface CustodyStandable { rotate(newPosition: DerivationPosition): UserWallet; suspend(reason: string): void; retire(): void; }
```

`UserWallet implements Signable, CustodyStandable`. Sin esqueleto: el par transitorio (`reconstructForSigning`/`forget`) es unico — abre un solo `openFor` y lo cierra; el resto es trivialmente distinto (cada metodo cambia `standing`/`position` y registra su hecho). `WalletStanding` (`PROVISIONED | SIGNING_OPEN | ROTATED | SUSPENDED | RETIRED`) como `as const` + `type` union, con `parseWalletStanding()` vía `Object.values()` y `@IsIn(Object.values(WalletStanding))` en DTOs (nunca forma enum clásica / `as` / `@IsEnum`).

### 2.1 Aggregate Root: `UserWallet`

**Ubicacion:** `domain/model/aggregates/user-wallet.aggregate.ts`. Una capacidad de firma por persona; el uso transitorio (reconstruct → sign → forget) vive dentro del agregado para que sea atomico.

```typescript
import { AggregateRoot } from '../../../../shared/domain/model/aggregate-root';
import { UserWalletId } from '../valueobjects/user-wallet-id.value-object';
import { PersonId } from '../valueobjects/person-id.value-object';
import { DerivationPosition } from '../valueobjects/derivation-position.value-object';
import { WalletProvisionedEvent } from '../events/wallet-provisioned.event';
import { KeyReconstructedEvent } from '../events/key-reconstructed.event';
import { KeyForgottenEvent } from '../events/key-forgotten.event';
import { WalletRotatedEvent } from '../events/wallet-rotated.event';
import { WalletSuspendedEvent } from '../events/wallet-suspended.event';
import { WalletRetiredEvent } from '../events/wallet-retired.event';
export const WalletStanding = { PROVISIONED: 'PROVISIONED', SIGNING_OPEN: 'SIGNING_OPEN', ROTATED: 'ROTATED', SUSPENDED: 'SUSPENDED', RETIRED: 'RETIRED' } as const;
export type WalletStanding = (typeof WalletStanding)[keyof typeof WalletStanding];
export function parseWalletStanding(v: string): WalletStanding {
  if (!(Object.values(WalletStanding) as string[]).includes(v)) throw new Error(`invalid wallet standing: ${v}`);
  return v as WalletStanding;
}
// DTOs: @IsIn(Object.values(WalletStanding)) (nunca forma enum clásica / `@IsEnum` / `as`)
export class UserWallet extends AggregateRoot {
  private constructor(private readonly _id: UserWalletId, private readonly _personId: PersonId, private _position: DerivationPosition, private _standing: WalletStanding, private _openFor: SignedContentRef | null) { super(); }
  static provision(id: UserWalletId, personId: PersonId, position: DerivationPosition): UserWallet {
    const w = new UserWallet(id, personId, position, WalletStanding.PROVISIONED, null);
    w.registerEvent(new WalletProvisionedEvent(id, personId, position));
    return w;
  }
  static rehydrate(id: UserWalletId, personId: PersonId, position: DerivationPosition, standing: WalletStanding, openFor: SignedContentRef | null): UserWallet {
    return new UserWallet(id, personId, position, standing, openFor);
  }
  reconstructForSigning(contentRef: SignedContentRef): void {
    if (this._standing === WalletStanding.SUSPENDED) throw new IllegalWalletStateError('SigningNotAllowed_Suspended');
    if (this._standing === WalletStanding.RETIRED) throw new IllegalWalletStateError('SigningNotAllowed_Retired');
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('capability not provisioned');
    if (this._openFor !== null) throw new IllegalWalletStateError('ReconstructionAlreadyOpen');
    this._standing = WalletStanding.SIGNING_OPEN;
    this._openFor = contentRef;
    this.registerEvent(new KeyReconstructedEvent(this._id, contentRef));
  }
  forget(): void {
    if (this._standing !== WalletStanding.SIGNING_OPEN) throw new IllegalWalletStateError('nothing open to forget');
    const ref = this._openFor!;
    this._openFor = null;
    this._standing = WalletStanding.PROVISIONED;
    this.registerEvent(new KeyForgottenEvent(this._id, ref));
  }
  /** Rota a una posicion fresca: esta capacidad queda ROTATED (su posicion nunca vuelve a firmar) y nace la capacidad sucesora en PROVISIONED. El servicio salva ambas en el mismo UoW. */
  rotate(newPosition: DerivationPosition): UserWallet {
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('RotationNotAllowed');
    if (this._openFor !== null) throw new IllegalWalletStateError('ReconstructionOpen');
    this._standing = WalletStanding.ROTATED;
    this.registerEvent(new WalletRotatedEvent(this._id, this._position, newPosition));
    return UserWallet.provision(UserWalletId.generate(), this._personId, newPosition);
  }
  suspend(reason: string): void {
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('suspend only from PROVISIONED');
    this._standing = WalletStanding.SUSPENDED;
    this.registerEvent(new WalletSuspendedEvent(this._id, reason));
  }
  retire(): void {
    if (this._standing === WalletStanding.RETIRED) throw new IllegalWalletStateError('WalletConcluded');
    this._standing = WalletStanding.RETIRED;
    this._openFor = null;
    this.registerEvent(new WalletRetiredEvent(this._id, this._personId));
  }
  answerCapability(): { maySign: boolean; walletId: string; position: number } {
    return { maySign: this._standing === WalletStanding.PROVISIONED, walletId: this._id.value, position: this._position.value };
  }
}
```

**Invariantes:** `openFor <= 1` (un solo contenido abierto); nada firmable en reposo; `DerivationPosition` unica (una posicion, una capacidad); `RETIRED` terminal; firmante != pagador (R6 Separate Ways, sin integracion directa con Relay).

### 2.2 Value Objects

`UserWalletId` (`wal-uuid`, `generate()` + `of()` + `equals()`), `PersonId` (igual forma, owned por IAM — aqui solo referencia), `DerivationPosition` (entero `>= 0`, `of()` valida), `SignedContentRef` (`of()` + `equals()`: referencia al contenido en firma, owneado por Voting — aqui solo identidad, nunca string pelado). Regla: `string` solo para motivos libres (`reason` de `suspend`: texto no vacio); todo lo que identifica, VO.

### 2.3 Commands / Queries

`ProvisionWalletCommand(personId)`, `SignVoteContentCommand(walletId, contentRef)`, `RotateWalletCommand(walletId, newPosition)`, `SuspendWalletCommand`, `RetireWalletCommand` — clases planas que validan en el constructor. Queries: `GetSigningCapabilityByPersonQuery` y `GetAdminshipHistoryByWalletQuery`.

### 2.4 Domain Events (6)

`WalletProvisionedEvent | KeyReconstructedEvent | KeyForgottenEvent | WalletRotatedEvent | WalletSuspendedEvent | WalletRetiredEvent` — clases en `domain/model/events/`, `implements DomainEvent`, con `static eventName` (wire inalterado `'WalletProvisioned'`, `'KeyReconstructed'`, `'KeyForgotten'`, `'WalletRotated'`, `'WalletSuspended'`, `'WalletRetired'`) y payload tipado con VOs (nunca strings pelados para identidad de negocio).

### 2.5 Puertos de dominio

```typescript
export const WALLET_COMMAND_SERVICE = Symbol('WALLET_COMMAND_SERVICE');
export interface WalletCommandService {
  // Regla skill ddd-guideliness v1.0.11: methodName = lowerCamel(Clase sin Command|Query)
  provisionWallet(cmd: ProvisionWalletCommand): Promise<UserWalletId>;
  signVoteContent(cmd: SignVoteContentCommand): Promise<string>;
  rotateWallet(cmd: RotateWalletCommand): Promise<void>;
  suspendWallet(cmd: SuspendWalletCommand): Promise<void>;
  retireWallet(cmd: RetireWalletCommand): Promise<void>;
}
export const WALLET_QUERY_SERVICE = Symbol('WALLET_QUERY_SERVICE');
export interface WalletQueryService {
  getSigningCapabilityByPerson(q: GetSigningCapabilityByPersonQuery): Promise<{ maySign: boolean; walletId: string; position: number }>;
  getAdminshipHistoryByWallet(q: GetAdminshipHistoryByWalletQuery): Promise<AdminshipEntry[]>;
}
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');
export interface WalletRepository {
  findById(id: UserWalletId): Promise<UserWallet | null>;
  findLiveByPerson(personId: PersonId): Promise<UserWallet | null>;
  existsPosition(position: DerivationPosition): Promise<boolean>;
  save(wallet: UserWallet): Promise<void>; // persiste el agregado + anexa sus eventos a wallet.events en el mismo UoW
  findEventsByWallet(id: UserWalletId): Promise<DomainEvent[]>; // scrutiny: log de eventos por capability
}
```

---

<a name="application"></a>

## 3. Application Layer

### 3.1 Command Service — ancla UC2 SignVoteContent

```typescript
@Injectable()
export class WalletCommandServiceImpl implements WalletCommandService {
  constructor(@Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository, @Inject(KEY_CUSTODY_SERVICE) private readonly custody: KeyCustodyService, @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork, private readonly events: EventEmitter2) {}
  async signVoteContent(cmd: SignVoteContentCommand): Promise<string> {
    const wallet = await this.uow.run(async () => {
      const w = (await this.wallets.findById(cmd.walletId)) ?? (() => { throw new CapabilityNotFoundError(cmd.walletId.value); })();
      w.reconstructForSigning(cmd.contentRef); // KeyReconstructedEvent
      await this.wallets.save(w);
      return w;
    });
    let signed: string;
    try {
      signed = await this.custody.signTransient(wallet.id.value, cmd.contentRef.value); // solo memoria, VO desenvuelto en el borde
    } finally {
      const closed = await this.uow.run(async () => {
        const w = (await this.wallets.findById(cmd.walletId))!;
        if (w.standing === WalletStanding.SIGNING_OPEN) { w.forget(); await this.wallets.save(w); }
        return w;
      });
      this.publish(closed); // KeyForgottenEvent — siempre, aun si sign fallo
    }
    this.publish(wallet);
    return signed!;
  }
  private publish(w: UserWallet): void {
    for (const e of w.pullDomainEvents()) this.events.emit(e.eventName, e);
  }
}
```

`reconstruct → sign → forget` atomico en intencion (dos `run()` con `finally` que garantiza `forget`); un segundo `SignVoteContent` concurrente falla con `ReconstructionAlreadyOpen`; nunca se reutiliza una reconstruccion entre contenidos. El `signTransient` del KMS corre fuera de la tx; el `finally{forget}` cierra `SIGNING_OPEN → PROVISIONED` aun si el signing lanzo.

### 3.2 Query Service — pull, no push

`getSigningCapabilityByPerson()` delega a `answerCapability()` del agregado (pull de solo lectura, sin hechos ni efectos). `getAdminshipHistoryByWallet()` lee `wallet.events` vía `findEventsByWallet()` (el adapter anexa los eventos drenados en cada `save()`, mismo UoW — scrutiny sobre hechos persistidos, nunca reconstrucción en memoria).

### 3.3 Ports de salida

```typescript
export const KEY_CUSTODY_SERVICE = Symbol('KEY_CUSTODY_SERVICE');
export interface KeyCustodyService {
  derivePosition(personId: string): Promise<number>;
  signTransient(walletId: string, contentRef: string): Promise<string>; // firma y olvida
}
```

Nota Strategy (skill: un algoritmo intercambiable por puerto): `derivePosition` + `signTransient` viajan juntos porque la ceremonia de custodia los acopla (derivar sin custodiar, o custodiar sin firmar-transitorio, no es un adaptador válido — HSM vs memoria cambian ambos a la vez). Si un vendor separara derivación de firma, se divide en `KeyDerivationStrategy` + `SigningPolicy` (parked, con test que lo exija).

### 3.4 Event handler y ACL publicada

`WalletEventLogger` — `@OnEvent(...)` solo log, nunca suscrito desde otro modulo (bus global sin aislamiento; exento de renombre `*EventHandler`, se mantiene + nota). `WalletContextFacadeImpl` expone `sign(contentRef)` + `answerCapability(personId)`; Voting la consume via `ExternalWalletService`. Handler `Retired → Consent`: `@OnEvent(WalletRetiredEvent.eventName, { async: true })` en modulo propio, inyecta `ExternalConsentService.notifyRetired()` (ACL → `CONSENT_CONTEXT_FACADE`), con `try/catch` (fallo de aviso no revierte el `retire` ya commiteado; log + reintento de transporte, nunca re-apertura del agregado). Ciclo Wallet↔Consent (Consent coordina `retire`, Wallet confirma): `forwardRef(() => ConsentModule)` en ambos lados.

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

### 4.1 Persistencia TypeORM

```typescript
@Entity('wallets')
export class WalletOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn() id: string;               // wal-uuid (generado en aplicacion)
  @Column() personId: string;
  @Column('int') derivationPosition: number; // UNIQUE
  @Column() standing: string;                // parseWalletStanding al leer
  @Column({ nullable: true }) openFor: string | null; // referencia opaca, nunca secreto
}
```

Assembler `toDomain` via `UserWallet.rehydrate` + VOs (`parseWalletStanding`, nunca `as`); adapter `WalletRepositoryImpl` lee `TransactionContext.current ?? orm`. Unicidad de posicion: constraint `UNIQUE` + `existsPosition()` (la carrera la gana la DB).

### 4.2 KMS / HSM + HD BIP-32 (solo memoria)

`infrastructure/kms/hd-wallet/hd-key-custody.service.ts` implementa `KeyCustodyService`: deriva la clave de `personId + position` contra el secreto maestro (HSM/KMS en prod, variable de entorno en dev), firma el contenido y **descarta el material en el mismo tick** — jamas persiste, jamas cachea, jamas loguea. Tests con doble en memoria tras la misma interfaz. Frontera de auditoria abierta (OQ5): que cuenta como "material firmable" requiere revision de seguridad.

### 4.3 Strategy: `KeyDerivation` + `SigningPolicy` (puertos application, sin hardcode)

Puertos en `application/internal/outboundservices/key-derivation/key-derivation.service.ts` y `application/internal/outboundservices/signing-policy/signing-policy.service.ts` (el dominio nunca los implementa; `HdKeyCustodyService` los compone):

```typescript
export const WALLET_DERIVATION_STRATEGY = Symbol('WALLET_DERIVATION_STRATEGY');
export interface KeyDerivationStrategy { derivePath(personId: string, position: number): string; }
export const WALLET_SIGNING_POLICY = Symbol('WALLET_SIGNING_POLICY');
export interface SigningPolicy { sign(digest: Buffer, path: string): Promise<string>; }
```

`HdKeyDerivation` (BIP-32 `m/…/{position}`) vs `TestKeyDerivation` (ruta fija `test/{position}`); `HsmSigningPolicy` (llamada HSM/KMS) vs `MemorySigningPolicy` (dev/test). `HdKeyCustodyService` compone ambas: `derivePath()` → `sign()` → forget. Swap por providers (`WALLET_DERIVATION_STRATEGY`, `WALLET_SIGNING_POLICY`): prod `Hd+Hsm`, dev/test `Test+Memory` — sin `if (env)` en el servicio.

---

<a name="interfaces"></a>

## 5. Interfaces Layer

| Metodo | Endpoint | Descripcion |
|:--|:--|:--|
| `POST` | `/api/v1/wallets` | `ProvisionWalletCommand` → 201 + `Location` |
| `POST` | `/api/v1/wallets/:id/sign` | `SignVoteContentCommand` (RPC-style, aceptado en CQRS) |
| `POST` | `/api/v1/wallets/:id/rotate` | `RotateWalletCommand` |
| `POST` | `/api/v1/wallets/:id/suspend` | suspend con `reason` |
| `POST` | `/api/v1/wallets/:id/retire` | retire (coordinacion erasure) |
| `GET` | `/api/v1/wallets?personId=` | capability (UC3, read-only) |

Resources con `class-validator`; assemblers `XxxCommandFromResourceAssembler` (resource → command, `X.of()` en el borde). Controller con `@UseFilters(WalletExceptionFilter)` (`interfaces/rest/filters/`, skill: filtro BC-scoped en el controller): `CapabilityNotFoundError → 404`, `CapabilityAlreadyExistsError → 409`, `IllegalWalletStateError → 422`. Fachada `WALLET_CONTEXT_FACADE` con `sign(walletId, contentRef)` + `answerCapability(personId)` en primitivos — el consumidor traduce a sus VOs; `wallet-custody.module.ts` `exports: [WALLET_CONTEXT_FACADE]` (solo el facade, nunca internals).

---

<a name="database"></a>

## 6. Esquema de Base de Datos

Schema `wallet` (misma instancia Postgres). Ninguna columna guarda material de firma — invariante estructural.

```sql
CREATE SCHEMA IF NOT EXISTS wallet;
CREATE TABLE wallet.wallets (
  id TEXT PRIMARY KEY, person_id TEXT NOT NULL,
  derivation_position INT NOT NULL UNIQUE, standing TEXT NOT NULL
    CHECK (standing IN ('PROVISIONED','SIGNING_OPEN','ROTATED','SUSPENDED','RETIRED')),
  open_for TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallets_person ON wallet.wallets (person_id);
-- Log de scrutiny: el adapter anexa los eventos drenados en cada save(), mismo UoW.
CREATE TABLE wallet.events (
  seq BIGSERIAL PRIMARY KEY, wallet_id TEXT NOT NULL REFERENCES wallet.wallets(id),
  event_name TEXT NOT NULL, payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_wallet ON wallet.events (wallet_id, seq);
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 UC2 SignVoteContent (ancla)

```
POST /api/v1/wallets/:id/sign { contentRef }
 -> SignVoteContentCommand -> signVoteContent [uow.run #1: reconstructForSigning -> save]
 -> KeyCustodyService.signTransient (memoria, fuera de la tx)
 -> [uow.run #2, finally: forget si sigue SIGNING_OPEN -> save]
 -> publish tras cada commit (emit tras run resuelto) -> 200 { signedContent }
```

### 7.2 UC1 Provision / UC4-6 Adminship

`provisionWallet`: `ExternalIamService.personExists()` → `existsPosition()` → `UserWallet.provision()` → save → `WalletProvisionedEvent` post-commit. `rotateWallet`: cargar → `rotate(newPosition)` (esta queda `ROTATED`) + `save` de la sucesora `PROVISIONED` en el mismo UoW → publicar ambos post-commit. `suspendWallet/retireWallet`: cargar → metodo del agregado → save → publicar post-commit. UC6 sin comando externo de persona: lo dispara el hecho de coordinacion de Consent & Compliance.

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

| Relacion | Patron | Mecanismo |
|:--|:--|:--|
| Voting → Wallet (R4) | Customer/Supplier (Voting cliente) | `ExternalWalletService` consume `WALLET_CONTEXT_FACADE.sign()`; un contenido cruza, nada firmable cruza |
| Wallet ⋮ Relay (R6) | **Separate Ways** | Sin integracion directa. Firmante firma, pagador paga; se encuentran solo en el flujo de Voting |
| IAM → Wallet | Referencia identidad | `ExternalIamService.personExists()` en UC1 |
| Consent → Wallet | Coordinacion | Hecho de erasure dispara `retire()`; `WalletRetiredEvent` confirma la parte propia |

Handler interno ante `WalletRetiredEvent`: notifica a Consent via su fachada (llamada ACL en proceso, no `@OnEvent` cross-modulo).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

| Dependencia | Puerto | Adaptador | Estado |
|:--|:--|:--|:--|
| KMS/HSM + BIP-32 | `KeyCustodyService` | `HdKeyCustodyService` (`infrastructure/kms/hd-wallet/`) | Port & Adapter correcto |
| Postgres (`wallet.wallets`) | `WalletRepository` | `WalletRepositoryImpl` + `TransactionContext` | Correcto |
| IAM facade | `ExternalIamService` | ACL en proceso | Consumida |
| `EventEmitterModule.forRoot()` | — | Solo en `app.module.ts` | Nunca en el modulo feature |

`wallet.kms.key-id=${WALLET_KMS_KEY_ID}` (requerido en prod), `wallet.hd.network=${WALLET_HD_NETWORK:mainnet}`.

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

| # | Severidad | Hallazgo | Correccion |
|:--|:--|:--|:--|
| D1 | Alta | Tentacion de persistir clave derivada "para rendimiento" | Prohibido: firma solo en memoria, `forget()` en `finally` |
| D2 | Alta | `SIGNING_OPEN` como segundo agregado/entidad | Rechazado: `openFor` es campo del agregado; atomicidad intacta |
| D3 | Media | Fachada tipada con VOs del consumidor | Primitivos; traduccion en `ExternalWalletService` |
| D4 | Media | Publicar eventos dentro de `uow.run()` | Solo tras `run()` resuelto (post-commit) |
| D5 | Media | `@OnEvent(KeyReconstructedEvent.eventName)` consumido desde Voting | Prohibido: Voting llama la fachada; handler solo interno |
| D6 | Baja | Cast `as` en assembler | `parseWalletStanding()` vía `Object.values()` explícito; enum como `as const` + `@IsIn(Object.values(...))` |
| D7 | Baja | Composite para capability + adminship | No Composite (Inv.5): `answerCapability()` retorna DTO pull, historial por ID-refs, sin arbol de objetos |
| V1.0.7 | Baja | Naming v1.0.7: forma enum clásica / `in` / `@IsEnum`, eventos sin sufijo `Event` | Enums como `as const` + `type` union + `parseX()` vía `Object.values()` + `@IsIn(Object.values(X))`; eventos con sufijo `Event` (wire `eventName` inalterado, sin doble sufijo); `WalletEventLogger` exento (se mantiene + nota); `@OnEvent(XEvent.eventName)`; comandos Wallet UNCHANGED |

> **Project override (v1.0.7):** sufijo `Event` en TODOS los eventos (no solo en colisión); wire `eventName='X'` inalterado (fix-back tras replaceAll, evitar doble sufijo); `WalletEventLogger` exento.

### Decisiones de diseno

1. **Dos transacciones + `finally`:** el signing externo no cabe en la tx de dominio; el `finally` garantiza cierre.
2. **`POST /:id/sign` RPC:** es un command CQRS, no CRUD; aceptado.
3. **Sin resume de suspension:** no modelado (OQ1); suspender lleva a rotar/retirar.

### Preguntas abiertas (de domain-model.md)

OQ1 resume vs rotar/retirar · OQ2 rotacion verificable del pasado · OQ3 razones visibles a la persona · OQ4 firma en vuelo al borrar · OQ5 frontera exacta de auditoria de "nada firmable".

## Testing (skill §Testing cada capa)

- **domain** (plain unit): `provision()` → `reconstructForSigning` → `forget()`; segundo sign concurrente → `ReconstructionAlreadyOpen`; `rotate` deja `ROTATED` + sucesora `PROVISIONED`.
- **application**: mocks de `WalletRepository` + `KEY_CUSTODY_SERVICE` (memoria), o `overrideProvider(...)`.
- **infrastructure**: Testcontainers Postgres — `UNIQUE(position)`, `wallet.events` anexados en mismo UoW, sin columna de material firmable.
- **interfaces**: supertest (`POST wallets → :id/sign → rotate/suspend/retire`).
