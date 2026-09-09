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
│           ├── kms/key-custody.service.ts      # Port: custodia + derivacion HD
│           └── acl/external-iam.service.ts     # personExists(personId)
├── domain/
│   ├── model/
│   │   ├── aggregates/user-wallet.aggregate.ts
│   │   ├── valueobjects/ (user-wallet-id, person-id, derivation-position)
│   │   ├── commands/ (provision, sign-vote-content, rotate, suspend, retire)
│   │   ├── queries/ (get-signing-capability-by-person, get-stewardship-history-by-wallet)
│   │   └── events/ (6 hechos: provisioned, reconstructed, forgotten, rotated, suspended, retired)
│   ├── services/ (wallet-command.service.ts, wallet-query.service.ts + tokens)
│   ├── repositories/wallet.repository.ts      # + WALLET_REPOSITORY
│   └── exceptions/ (capability-already-exists, capability-not-found, illegal-wallet-state)
├── infrastructure/
│   ├── persistence/typeorm/ (entities/, assemblers/, adapters/)
│   └── kms/hd-wallet/hd-key-custody.service.ts  # BIP-32, solo memoria (ver 4.2)
└── cryptographic-wallet-custody.module.ts
```

---

<a name="domain"></a>

## 2. Domain Layer

> **Regla dura:** cero imports de `@nestjs/*`, `typeorm` o `class-validator` en `domain/`.

### 2.0 Interfaces de capacidad (sin esqueleto)

```typescript
export interface Signable { reconstructForSigning(contentRef: string): void; forget(): void; }
export interface CustodyStandable { rotate(newPosition: DerivationPosition): void; suspend(reason: string): void; retire(): void; }
```

`UserWallet implements Signable, CustodyStandable`. Sin esqueleto: el par transitorio (`reconstructForSigning`/`forget`) es unico — abre un solo `openFor` y lo cierra; el resto es trivialmente distinto (cada metodo cambia `standing`/`position` y registra su hecho). `WalletStanding` (`PROVISIONED | SIGNING_OPEN | ROTATED | SUSPENDED | RETIRED`) vive en dominio con `parseWalletStanding()`.

### 2.1 Aggregate Root: `UserWallet`

**Ubicacion:** `domain/model/aggregates/user-wallet.aggregate.ts`. Una capacidad de firma por persona; el uso transitorio (reconstruct → sign → forget) vive dentro del agregado para que sea atomico.

```typescript
import { AggregateRoot } from '../../../../shared/domain/model/aggregate-root';
import { UserWalletId } from '../valueobjects/user-wallet-id.value-object';
import { PersonId } from '../valueobjects/person-id.value-object';
import { DerivationPosition } from '../valueobjects/derivation-position.value-object';
import { WalletProvisioned } from '../events/wallet-provisioned.event';
import { KeyReconstructed } from '../events/key-reconstructed.event';
import { KeyForgotten } from '../events/key-forgotten.event';
import { WalletRotated } from '../events/wallet-rotated.event';
import { WalletSuspended } from '../events/wallet-suspended.event';
import { WalletRetired } from '../events/wallet-retired.event';
export enum WalletStanding { PROVISIONED = 'PROVISIONED', SIGNING_OPEN = 'SIGNING_OPEN', ROTATED = 'ROTATED', SUSPENDED = 'SUSPENDED', RETIRED = 'RETIRED' }
export function parseWalletStanding(v: string): WalletStanding {
  if (!(v in WalletStanding)) throw new Error(`invalid wallet standing: ${v}`);
  return WalletStanding[v as keyof typeof WalletStanding];
}
export class UserWallet extends AggregateRoot {
  private constructor(private readonly _id: UserWalletId, private readonly _personId: PersonId, private _position: DerivationPosition, private _standing: WalletStanding, private _openFor: string | null) { super(); }
  static provision(id: UserWalletId, personId: PersonId, position: DerivationPosition): UserWallet {
    const w = new UserWallet(id, personId, position, WalletStanding.PROVISIONED, null);
    w.registerEvent(new WalletProvisioned(id, personId, position));
    return w;
  }
  static rehydrate(id: UserWalletId, personId: PersonId, position: DerivationPosition, standing: WalletStanding, openFor: string | null): UserWallet {
    return new UserWallet(id, personId, position, standing, openFor);
  }
  reconstructForSigning(contentRef: string): void {
    if (this._standing === WalletStanding.SUSPENDED) throw new IllegalWalletStateError('SigningNotAllowed_Suspended');
    if (this._standing === WalletStanding.RETIRED) throw new IllegalWalletStateError('SigningNotAllowed_Retired');
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('capability not provisioned');
    if (this._openFor !== null) throw new IllegalWalletStateError('ReconstructionAlreadyOpen');
    if (!contentRef?.trim()) throw new IllegalWalletStateError('content required');
    this._standing = WalletStanding.SIGNING_OPEN;
    this._openFor = contentRef;
    this.registerEvent(new KeyReconstructed(this._id, contentRef));
  }
  forget(): void {
    if (this._standing !== WalletStanding.SIGNING_OPEN) throw new IllegalWalletStateError('nothing open to forget');
    const ref = this._openFor!;
    this._openFor = null;
    this._standing = WalletStanding.PROVISIONED;
    this.registerEvent(new KeyForgotten(this._id, ref));
  }
  rotate(newPosition: DerivationPosition): void {
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('RotationNotAllowed');
    const old = this._position;
    this._position = newPosition;
    this.registerEvent(new WalletRotated(this._id, old, newPosition));
  }
  suspend(reason: string): void {
    if (this._standing !== WalletStanding.PROVISIONED) throw new IllegalWalletStateError('suspend only from PROVISIONED');
    this._standing = WalletStanding.SUSPENDED;
    this.registerEvent(new WalletSuspended(this._id, reason));
  }
  retire(): void {
    if (this._standing === WalletStanding.RETIRED) throw new IllegalWalletStateError('WalletConcluded');
    this._standing = WalletStanding.RETIRED;
    this._openFor = null;
    this.registerEvent(new WalletRetired(this._id, this._personId));
  }
  answerCapability(): { maySign: boolean; walletId: string; position: number } {
    return { maySign: this._standing === WalletStanding.PROVISIONED, walletId: this._id.value, position: this._position.value };
  }
}
```

**Invariantes:** `openFor <= 1` (un solo contenido abierto); nada firmable en reposo; `DerivationPosition` unica (una posicion, una capacidad); `RETIRED` terminal; firmante != pagador (R6 Separate Ways, sin integracion directa con Relay).

### 2.2 Value Objects

`UserWalletId` (`wal-uuid`, `generate()` + `of()` + `equals()`), `PersonId` (igual forma, owned por IAM — aqui solo referencia), `DerivationPosition` (entero `>= 0`, `of()` valida). `SignedContentRef` es `string` opaco: el contenido lo ownea Voting, aqui solo identidad.

### 2.3 Commands / Queries

`ProvisionWalletCommand(personId)`, `SignVoteContentCommand(walletId, contentRef)`, `RotateWalletCommand(walletId, newPosition)`, `SuspendWalletCommand`, `RetireWalletCommand` — clases planas que validan en el constructor. Queries: `GetSigningCapabilityByPersonQuery` y `GetStewardshipHistoryByWalletQuery`.

### 2.4 Domain Events (6)

`WalletProvisioned | KeyReconstructed | KeyForgotten | WalletRotated | WalletSuspended | WalletRetired` — clases en `domain/model/events/`, `implements DomainEvent`, con `static eventName` y payload tipado con VOs (nunca strings pelados para identidad de negocio).

### 2.5 Puertos de dominio

```typescript
export const WALLET_COMMAND_SERVICE = Symbol('WALLET_COMMAND_SERVICE');
export interface WalletCommandService {
  provision(cmd: ProvisionWalletCommand): Promise<UserWalletId>;
  signContent(cmd: SignVoteContentCommand): Promise<string>;
  rotate(cmd: RotateWalletCommand): Promise<void>;
  suspend(walletId: UserWalletId, reason: string): Promise<void>;
  retire(walletId: UserWalletId): Promise<void>;
}
export const WALLET_REPOSITORY = Symbol('WALLET_REPOSITORY');
export interface WalletRepository {
  findById(id: UserWalletId): Promise<UserWallet | null>;
  findLiveByPerson(personId: PersonId): Promise<UserWallet | null>;
  existsPosition(position: DerivationPosition): Promise<boolean>;
  save(wallet: UserWallet): Promise<void>;
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
  async signContent(cmd: SignVoteContentCommand): Promise<string> {
    const wallet = await this.uow.run(async () => {
      const w = (await this.wallets.findById(cmd.walletId)) ?? (() => { throw new CapabilityNotFoundError(cmd.walletId.value); })();
      w.reconstructForSigning(cmd.contentRef); // KeyReconstructed
      await this.wallets.save(w);
      return w;
    });
    let signed: string;
    try {
      signed = await this.custody.signTransient(wallet.id.value, cmd.contentRef); // solo memoria
    } finally {
      const closed = await this.uow.run(async () => {
        const w = (await this.wallets.findById(cmd.walletId))!;
        if (w.standing === WalletStanding.SIGNING_OPEN) { w.forget(); await this.wallets.save(w); }
        return w;
      });
      this.publish(closed); // KeyForgotten — siempre, aun si sign fallo
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

`getCapabilityByPerson()` delega a `answerCapability()` del agregado (pull de solo lectura, sin hechos ni efectos). `getHistoryByWallet()` reconstruye stewardship desde eventos persistidos (scrutiny).

### 3.3 Ports de salida

```typescript
export const KEY_CUSTODY_SERVICE = Symbol('KEY_CUSTODY_SERVICE');
export interface KeyCustodyService {
  derivePosition(personId: string): Promise<number>;
  signTransient(walletId: string, contentRef: string): Promise<string>; // firma y olvida
}
```

### 3.4 Event handler y ACL publicada

`WalletEventLogger` — `@OnEvent(...)` solo log, nunca suscrito desde otro modulo (bus global sin aislamiento). `WalletContextFacadeImpl` expone `sign(contentRef)` + `answerCapability(personId)`; Voting la consume via `ExternalWalletService`. Handler `Retired → Consent`: `@OnEvent(WalletRetired.eventName, { async: true })` en modulo propio, con `try/catch` (fallo de aviso no revierte el `retire` ya commiteado; log + reintento de transporte, nunca re-apertura del agregado).

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

### 4.3 Strategy: `KeyDerivation` + `SigningPolicy` (ports de dominio)

```typescript
export interface KeyDerivationStrategy { derivePath(personId: string, position: number): string; }
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

Resources con `class-validator`; assemblers `XxxCommandFromResourceAssembler` (resource → command, `X.of()` en el borde); `WalletExceptionFilter`: `CapabilityNotFoundError → 404`, `CapabilityAlreadyExistsError → 409`, `IllegalWalletStateError → 422`. Fachada `WALLET_CONTEXT_FACADE` con `sign(walletId, contentRef)` + `answerCapability(personId)` en primitivos — el consumidor traduce a sus VOs.

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
```

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 UC2 SignVoteContent (ancla)

```
POST /api/v1/wallets/:id/sign { contentRef }
 -> SignVoteContentCommand -> signContent [uow.run #1: reconstructForSigning -> save]
 -> KeyCustodyService.signTransient (memoria, fuera de la tx)
 -> [uow.run #2, finally: forget si sigue SIGNING_OPEN -> save]
 -> publish tras cada commit (emit tras run resuelto) -> 200 { signedContent }
```

### 7.2 UC1 Provision / UC4-6 Stewardship

`provision`: `ExternalIamService.personExists()` → `existsPosition()` → `UserWallet.provision()` → save → `WalletProvisioned` post-commit. `rotate/suspend/retire`: cargar → metodo del agregado → save → publicar post-commit. UC6 sin comando externo de persona: lo dispara el hecho de coordinacion de Consent & Compliance.

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

| Relacion | Patron | Mecanismo |
|:--|:--|:--|
| Voting → Wallet (R4) | Customer/Supplier (Voting cliente) | `ExternalWalletService` consume `WALLET_CONTEXT_FACADE.sign()`; un contenido cruza, nada firmable cruza |
| Wallet ⋮ Relay (R6) | **Separate Ways** | Sin integracion directa. Firmante firma, pagador paga; se encuentran solo en el flujo de Voting |
| IAM → Wallet | Referencia identidad | `ExternalIamService.personExists()` en UC1 |
| Consent → Wallet | Coordinacion | Hecho de erasure dispara `retire()`; `WalletRetired` confirma la parte propia |

Handler interno ante `WalletRetired`: notifica a Consent via su fachada (llamada ACL en proceso, no `@OnEvent` cross-modulo).

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
| D5 | Media | `@OnEvent(KeyReconstructed)` consumido desde Voting | Prohibido: Voting llama la fachada; handler solo interno |
| D6 | Baja | Cast `as` en assembler | `parseWalletStanding()` explicito |
| D7 | Baja | Composite para capability + stewardship | No Composite (Inv.5): `answerCapability()` retorna DTO pull, historial por ID-refs, sin arbol de objetos |

### Decisiones de diseno

1. **Dos transacciones + `finally`:** el signing externo no cabe en la tx de dominio; el `finally` garantiza cierre.
2. **`POST /:id/sign` RPC:** es un command CQRS, no CRUD; aceptado.
3. **Sin resume de suspension:** no modelado (OQ1); suspender lleva a rotar/retirar.

### Preguntas abiertas (de domain-model.md)

OQ1 resume vs rotar/retirar · OQ2 rotacion verificable del pasado · OQ3 razones visibles a la persona · OQ4 firma en vuelo al borrar · OQ5 frontera exacta de auditoria de "nada firmable".
