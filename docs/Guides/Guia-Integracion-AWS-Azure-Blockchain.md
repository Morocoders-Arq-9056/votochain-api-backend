---
title: "Guía de Integración — AWS (biometría) + Azure (OCR) + Blockchain ($0)"
layer: "implementation-guide"
last-reviewed: "2026-10-27"
owner: "morocoders-team"
status: "draft"
version: "0.1.0"
---

# Guía de Integración — AWS + Azure + Blockchain

> Guía paso a paso para convertir los tres adaptadores **stub** de Votachain en
> integraciones reales: **Azure AI Document Intelligence** (OCR del documento de
> identidad), **AWS Rekognition** (biometría: liveness + comparación facial) y
> **Polygon Amoy** (blockchain, costo real $0).
>
> Sources: `docs/Bounded Contexts/{document-ocr-face-match-provider,biometric-identity-verification,blockchain-relay-transaction-delivery,cryptographic-wallet-custody}/impl-guide.md`,
> `docs/Bounded Contexts/context-mapping.md` (R3/R5/R6/R7/R8/R12), `docs/BrainStorming/VotoChain_Flujo_Biometrico_Wallet_ModeloB.md`.
> Plan de ejecución: `docs/Plan/Sprint-05-OCR-Azure-Real.md`, `Sprint-06-Biometric-AWS-Rekognition.md`, `Sprint-07-Blockchain-Real-Amoy.md`.

## ÍNDICE

- [1. Diagnóstico: qué es real y qué es stub hoy](#1-diagnóstico-qué-es-real-y-qué-es-stub-hoy)
- [2. Decisiones de diseño (cerradas)](#2-decisiones-de-diseño-cerradas)
- [3. Matriz de costo](#3-matriz-de-costo)
- [4. Orden de ejecución](#4-orden-de-ejecución)
- [5. Parte I — Fundamentos comunes](#5-parte-i--fundamentos-comunes)
- [6. Parte II — Azure AI Document Intelligence (OCR)](#6-parte-ii--azure-ai-document-intelligence-ocr)
- [7. Parte III — AWS Rekognition (biometría)](#7-parte-iii--aws-rekognition-biometría)
- [8. Parte IV — Blockchain en Polygon Amoy](#8-parte-iv--blockchain-en-polygon-amoy)
- [9. Parte V — Custodia de llaves](#9-parte-v--custodia-de-llaves)
- [10. Apéndice A — Variables de entorno](#10-apéndice-a--variables-de-entorno)
- [11. Apéndice B — Migraciones](#11-apéndice-b--migraciones)
- [12. Apéndice C — Checklist de release](#12-apéndice-c--checklist-de-release)
- [13. Apéndice D — Invariantes que la guía no rompe](#13-apéndice-d--invariantes-que-la-guía-no-rompe)
- [14. Referencias](#14-referencias)

---

<a name="1-diagnóstico-qué-es-real-y-qué-es-stub-hoy"></a>

## 1. Diagnóstico: qué es real y qué es stub hoy

Auditoría del código (rama `feat/shared-outbox-erasure`) antes de escribir esta guía.

| Componente | Archivo | Estado | Consecuencia real |
|---|---|---|---|
| Executor Rekognition | `src/document-ocr-face-match-provider/infrastructure/executor/rekognition/rekognition-executor.service.ts` | **STUB** — `return { readable: true }` / `{ holds: true }` | Todo examen concluye `MATCH`. Las ramas `NO_MATCH` y `UNREADABLE` son inalcanzables |
| Executor GDocAI | `.../executor/gdoc-ai/gdoc-ai-executor.service.ts` | **STUB** — idem | Además, Document AI **no tiene face-match**: el adapter miente sobre el dominio |
| Matcher vendor-a / vendor-b | `src/biometric-identity-verification/infrastructure/matching/vendor-{a,b}/` | **STUB** — score fijo `0.95` / `0.97` | `judgesMatch()` siempre `true`; el `attemptId` nunca se desreferencia |
| Gateway Amoy | `src/blockchain-relay-transaction-delivery/infrastructure/ledger/polygon-amoy/polygon-amoy-ledger.gateway.ts` | **STUB** — solo `getBlockNumber()`, hash fabricado, `observe()` siempre `confirmed:true` | El voto llega a `CONFIRMED` sin tocar la red. **La garantía "confirmado en blockchain" es vacua** |
| Cola BullMQ | `.../infrastructure/queue/bullmq/bullmq-delivery-queue.ts` | **STUB** — `EventEmitter2` en proceso | Sin serialización → colisión de nonce cuando haya envío real |
| Política HSM | `src/cryptographic-wallet-custody/infrastructure/kms/signing/hsm/hsm-signing-policy.service.ts` | **STUB** — firma local con `keccak256("votachain-hsm:"+seed)` | `WALLET_KMS_KEY_ID` solo llega a un `logger.debug` |
| `ExternalVotingService` | `.../outboundservices/acl/external-voting.service.ts` | **STUB** — no-ops | `DeliveryConfirmedEvent` no llega a Voting |
| Azure | — | **AUSENTE** | Cero apariciones en `src/` y en el diseño |
| BullMQ / Redis client / AWS SDK / Azure SDK | `package.json` | **AUSENTES** | `docker-compose.yml` sí tiene `redis:7-alpine`, pero nadie se conecta |

### 1.1 Tres defectos de fondo (no son "solo cablear SDK")

Cablear los SDK no sirve si no se arreglan antes estos tres puntos:

**(a) Los puertos son demasiado estrechos.** Ninguno puede transportar el material que el vendor necesita:

```ts
// src/document-ocr-face-match-provider/application/internal/outboundservices/executor/document-executor.service.ts
observeExtraction(examinationId: string): Promise<{ readable: boolean; reason: string | null }>;
observeComparison(examinationId: string): Promise<{ holds: boolean }>;

// src/biometric-identity-verification/application/internal/outboundservices/matching/face-matching.service.ts
judgesMatch(attemptId: string): Promise<boolean>;

// src/blockchain-relay-transaction-delivery/application/internal/outboundservices/ledger/ledger-gateway.service.ts
submit(orderId: string): Promise<LedgerOutcome>;
```

Un `examinationId` no lleva una imagen. Un `attemptId` no lleva un selfie. Un `orderId` no lleva una transacción firmada.

**(b) No existe ingesta.** Cero `multipart`, cero `multer`, cero `S3`, cero columna binaria, cero bucket. `DocumentRef` es un string opaco (`"dni-12345678"`), no un handle a bytes. `POST /examinations/:id/examine` no recibe cuerpo: **al vendor no se le pasa nada**.

**(c) `contentRef` del Relay no es el payload firmado.** En `src/voting/application/internal/eventhandlers/vote-cast.event-handler.ts:51-54`:

```ts
private static txPayloadOf(event: VoteCastEvent): string {
  return `signed:${event.proposalId.value}:${event.voterAddress.value}:${rawSig.v}:${rawSig.r}:${rawSig.s}`;
}
```

El Relay recibe la **firma**, pero no el `choice` ni el `nonce`. Y lo que se firma (`Vote.buildMessage`) es un string `vote:{proposalId}:{voter}:{choice}:{nonce}` que el Relay no puede reconstruir para verificar la firma ni derivar el `ecrecover` del contrato. **Tal como está, el Relay es incapaz de enviar una transacción verificable.**

### 1.2 El bug que aparecerá al hacer la blockchain real

Hoy `VoteCastEventHandler` marca `CONFIRMED` **en línea** (línea 41-42) usando el `outcome.confirmed` de `acceptSigned` — que es `true` porque el gateway fake siempre confirma. En cuanto el gateway sea real:

1. `acceptSigned` devuelve `confirmed: false` (la tx aún no está minada) → el handler marca `FAILED` y programa reintento.
2. Minada la tx, `DeliveryConfirmedEvent` → `ExternalVotingService.notifyConfirmed` → `markVoteConfirmed` → **`IllegalProposalTransitionError`** (o doble transición) si el handler inline ya había marcado algo.

Por eso esta guía incluye, explícitamente, **quitar la transición inline** y dejar que la verdad la diga el ledger (ver [§8.7](#87-externalvotingservice-real-y-el-fin-del-confirmed-inline)).

---

<a name="2-decisiones-de-diseño-cerradas"></a>

## 2. Decisiones de diseño (cerradas)

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| D-1 | Reparto de vendors | **Azure = OCR**, **AWS = biometría** | Azure AI Document Intelligence tiene un modelo de lectura robusto y barato (500 pág/mes F0). AWS Rekognition tiene colección de rostros + liveness de sesión, que Azure exige orquestar aparte |
| D-2 | Modelo de OCR | **`prebuilt-read` + parsing propio de DNI/CE** | `prebuilt-idDocument` está entrenado para DL/pasaportes US/EU: sus campos no cubren el layout del DNI peruano. `prebuilt-read` + reglas de negocio propias sí |
| D-3 | Referencia biométrica | **Rekognition Face Collection** (`IndexFaces` → `FaceId`) | Es la vía nativa de AWS y ya existe el modelo mental de `BiometricProfile` del doc (`rekognitionFaceId`). La alternativa self-hosted (`face-api.js`) queda como roadmap |
| D-4 | Umbral de match | **Lo juzga el BC**, el adapter solo devuelve el score | El impl-guide (D4) lo exige: "el listón nunca sale del BC". Hoy la comparación vive dentro del adapter — esta guía lo corrige |
| D-5 | Liveness | **Sesión de AWS**, no afirmación del cliente | Hoy `CompleteLivenessCommand(attemptId, present: boolean)` lo afirma el navegador: es un agujero de confianza. La verdad la lee el backend |
| D-6 | Evidencia (imágenes) | **Efímera, en Redis con TTL**, nunca en Postgres | El invariante "no se almacenan imágenes crudas" y "la evidencia muere con el examen" se conservan sin un bucket S3 ($0) |
| D-7 | Cadena | **Polygon Amoy (80002)** + **nodo local Hardhat en CI** | $0 real indefinido. Amoy = testnet público con POL del faucet; CI = cadena determinista local |
| D-8 | Anclaje on-chain | **1 tx por voto** (una por propuesta+firmante) | Encaja con el dominio actual (`DeliveryOrder` por contenido firmado). El modo batch (`anchorProposal` con raíz Merkle) queda implementado en el contrato para cuando exista presupuesto real |
| D-9 | Secreto de la voto | **Compromiso en la cadena + revelado al cierre** | `prebuilt-idDocument`… no: `choiceCommitment = keccak256(choice, salt)` se escribe en la cadena; el `choice` se revela tras el cierre. Cierra la pregunta abierta O3 (forma del secreto de voto) |
| D-10 | Custodia de la semilla | **Ruta gratis por defecto**; **AWS KMS documentado como opción de pago** | KMS **no tiene free tier** (~$1/llave/mes). No se puede prometer "$0" con KMS |
| D-11 | Credenciales cloud | **IAM role (AWS)** y **Entra ID (Azure)** en prod; API key solo en dev | Evita llaves estáticas en el entorno. Ambas rutas son gratuitas |
| D-12 | Transporte de la cola | **BullMQ + Redis real** en prod/CI; el adaptador en proceso se queda para dev/test | Redis ya está en `docker-compose.yml`. BullMQ es MIT |

---

<a name="3-matriz-de-costo"></a>

## 3. Matriz de costo

Precios de referencia consultados (oct-2026). **Verificar antes de facturar**: cambian.

### 3.1 Por escenario

| Recurso | Dev local | CI | Demo / Staging | Producción (piloto) |
|---|---|---|---|---|
| **Azure AI Document Intelligence** | F0 — $0 | F0 — $0 | F0 — $0 (500 pág/mes) | F0 hasta 500 pág/mes; S0 $1.50/1000 pág |
| **AWS Rekognition** | Cuenta propia dev — ~$0 | Cuenta propia dev — ~$0 | Free tier $0 (1.000 img/mes × 12 meses, cuentas nuevas) | $0.001/imagen tras el free tier |
| **Polygon Amoy (gas)** | $0 (POL del faucet) | $0 | $0 | $0 |
| **RPC Amoy** | Público `https://polygon-amoy.drpc.org` — $0 | `hardhat node` local — $0 | Público o Alchemy free tier — $0 | Alchemy/Infura free tier hasta agotar cuota |
| **Postgres** | `docker-compose` — $0 | Contenedor — $0 | Servicio free tier — $0 | RDS free tier (12 meses) o el que ya exista |
| **Redis** | `docker-compose` — $0 | Contenedor — $0 | Upstash free tier — $0 | El que ya exista |
| **Clave maestra (KMS)** | `WALLET_MASTER_SEED` local — $0 | Secret del CI — $0 | Secret de la plataforma — $0 | **AWS KMS ~$1/llave/mes — ⚠ DE PAGO** |
| **Total** | **$0** | **$0** | **$0** | **$0 o ~$1/mes (solo si se elige KMS)** |

> **El único ítem con costo real es AWS KMS.** Y no es opcional: es *la opción de pago*. La ruta gratuita es "semilla maestra derivada de un secreto de la plataforma, cifrada en reposo". Ver [§9](#9-parte-v--custodia-de-llaves).

### 3.2 Consumption real de los free tiers

| Servicio | Unidad | Consumo por voter | Techo gratis | Votantes/mes |
|---|---|---|---|---|
| Azure Document Intelligence | 1 página = 1 req | 2 páginas (frente + reverso del DNI) | 500 pág/mes (F0, **sin vencimiento**) | **~250** |
| Azure F0 (restricciones) | — | — | 1 req/s · 4 MB/archivo · solo 2 primeras páginas | — |
| AWS Rekognition Group 1 | 1 imagen | enrollment: 2 (retrato DNI + selfie) · pre-voto: 1 (selfie) | 1.000 img/mes × 12 meses | **~330** en free tier |
| AWS Liveness | 1 sesión | 1 por verificación | cotizado por sesión (no por frame) | — |

**Consecuencia de diseño:** con F0 de Azure y el free tier de Rekognition, un piloto de **~250 miembros** es sostenible con $0. Pasado ese punto, S0 de Azure ($1.50/1000 pág) y las fotos de AWS ($0.001/img) siguen siendo pennies: 1.000 votos ≈ $1 de AWS + $1.50 de Azure.

---

<a name="4-orden-de-ejecución"></a>

## 4. Orden de ejecución

```
FASE 0 — Cuentas y credenciales (½ día, todo manual)
  ├─ Azure: crear recurso "Document Intelligence" F0 → endpoint + key (dev) / Entra (prod)
  ├─ AWS:   IAM role/usuario + política least-privilege + región us-east-1
  ├─ Polygon: faucet → 0.5 POL en la wallet relayer; guardar AMOY_PAYER_KEY
  └─ Redis:docker compose up -d redis

FASE 1 — Fundamentos (Sprint-05, parte 1)  ~2 días
  ├─ multipart + multer + límites de tamaño/tipo
  ├─ EVIDENCE_STORE (Redis TTL) + InMemory
  ├─ ensanchar EXECUTOR_PORT y MATCHING_PORT
  └─ env + Joi + .env.example

FASE 2 — Azure OCR (Sprint-05, parte 2)     ~3 días
  ├─ adaptador DocumentAnalysisClient (prebuilt-read)
  ├─ parser DNI/CE + mapeo a UnreadableReason/Verdict
  └─ wiring + tests

FASE 3 — AWS biometría (Sprint-06)         ~4 días
  ├─ colección de rostros + DetectFaces/IndexFaces
  ├─ referenceRef + migración
  ├─ SearchFacesByImage + umbral en el BC
  ├─ liveness por sesión
  └─ DeleteFaces en el erasure

FASE 4 — Blockchain (Sprint-07)            ~5 días
  ├─ contrato Solidity + deploy Amoy
  ├─ envelope firmado compartido + EIP-712 estructurado
  ├─ gateway real + hash/block reales
  ├─ ExternalVotingService real
  └─ BullMQ + fee policy + CI local

FASE 5 — Cierre                            ~1 día
  ├─ e2e en cadena local
  └─ checklist de costo y de release
```

**Dependencias duras:** FASE 2 necesita FASE 1. FASE 3 necesita FASE 1 (evidencia) y el `FaceId` que produce FASE 2 (el retrato sale del documento, no del selfie). FASE 4 es independiente de FASE 2/3 y puede ejecutarse en paralelo.

---

<a name="5-parte-i--fundamentos-comunes"></a>

## 5. Parte I — Fundamentos comunes

Esta parte es la que hace posible todo lo demás. Sin ella, los tres adaptadores siguen siendo stub.

### 5.1 Dependencias

```bash
# OCR / Azure
pnpm add @azure/ai-form-recognizer@^5.1.0 @azure/identity@^4.14.0

# Biometría / AWS
pnpm add @aws-sdk/client-rekognition@^3.1158

# Ingesta
pnpm add multer@^2.2.0
pnpm add -D @types/multer

# Blockchain / transporte
pnpm add bullmq@^6.5.0 ioredis@^6.0.0
```

> `multer@2.2.0` **ya está instalado** como dependencia transitiva de `@nestjs/platform-express`, pero **no** como dependencia directa y **sin** `@types/multer`. Sin los tipos, `FileInterceptor` y `Express.Multer.File` no compilan. Declararlos explícitamente.

> `@azure/ai-form-recognizer` v5 exporta `DocumentAnalysisClient`, `DocumentModelAdministrationClient` y `AzureKeyCredential`. El nombre del paquete sigue diciendo "form-recognizer" pero **el servicio se llama Azure AI Document Intelligence** — mismo servicio, SDK v5 (`@azure/ai-document-intelligence` no existe en npm).

### 5.2 Ingesta de evidencia (multipart)

Hoy `POST /api/v1/examinations` recibe un JSON `{personId, documentRef}`. Pasa a recibir archivos.

**Controller** (`src/document-ocr-face-match-provider/interfaces/rest/controllers/examination.controller.ts`):

```ts
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@Post()
@UseInterceptors(
  FileInterceptor('images', 2, {
    limits: { fileSize: 4 * 1024 * 1024, files: 2 }, // 4 MB = techo de Azure F0
    fileFilter: (_req, file, cb) => {
      const ok = ['image/jpeg', 'image/png'].includes(file.mimetype);
      cb(null, ok);
    },
  }),
)
async requestExamination(
  @UploadedFiles() images: Express.Multer.File[] | undefined,
  @Body() body: RequestExaminationResource,
): Promise<...> {
  // El id lo genera la capa REST: es la clave de la evidencia Y del examen.
  // El dominio nunca ve los bytes: el comando lleva identidad, no evidencia.
  const id = ExaminationId.generate();
  const evidence = this.evidenceMapper.toEvidence(images, body);
  await this.evidenceStore.put(id.value, evidence);
  try {
    return await this.commandService.requestDocumentExamination(
      new RequestDocumentExaminationCommand(id, PersonId.of(body.personId), DocumentRef.of(body.documentRef)),
    );
  } catch (e) {
    await this.evidenceStore.remove(id.value); // el 409/403 no deja huérfanos; la TTL limpia el resto
    throw e;
  }
}
```

**Reglas duras:**

| Regla | Valor | Motivo |
|---|---|---|
| Tamaño máximo por archivo | 4 MB | Azure F0 (`S0` sube a 500 MB) |
| Tipo MIME | `image/jpeg`, `image/png` | Rekognition y Document Intelligence solo aceptan JPEG/PNG |
| Cantidad | 1..2 (frente, reverso) | El DNI peruano es anverso + reverso |
| Almacenamiento | **memoria, luego Redis con TTL** | Invariante: la evidencia muere con el examen |
| Logs | **nunca** el buffer ni el nombre de archivo con PII | `documentRef` puede contener el número de DNI |

> `fileFilter` que rechaza por tipo no debe convertirse en `UnreadableReason.MISMATCHED_TYPE`: ese es un **veredicto sobre el documento**, no un error de transporte. El tipo inválido es un `400` de validación (no se crea examen, no se genera hecho). `MISMATCHED_TYPE` es para cuando el archivo es válido pero su contenido no corresponde al tipo declarado (p. ej. el usuario subió una foto de un recibo declarando DNI).

### 5.3 El almacén de evidencia transitorio

Nuevo puerto en la capa application del BC OCR. **No** es un repositorio de dominio: la evidencia no es un agregado.

```ts
// src/document-ocr-face-match-provider/application/internal/outboundservices/evidence/evidence-store.service.ts
export const EVIDENCE_STORE = Symbol('EVIDENCE_STORE');

export interface EvidenceStore {
  /** Guarda la evidencia con TTL. Se sobrescribe si ya había una (reexamen). */
  put(examinationId: string, evidence: DocumentEvidence): Promise<void>;
  /** Toma (y destruye) la evidencia. Consume una vez: si no hay, devuelve null. */
  take(examinationId: string): Promise<DocumentEvidence | null>;
  /** Borra la evidencia sin leerla (limpieza tras un rechazo). */
  remove(examinationId: string): Promise<void>;
}
```

**`DocumentEvidence`** — tipo de application, no de domain. El dominio **no** ve imágenes:

```ts
// src/document-ocr-face-match-provider/application/internal/outboundservices/evidence/document-evidence.ts
export interface DocumentEvidence {
  readonly documentType: string;        // 'DNI' | 'CE' | 'PASSPORT'
  readonly front: Buffer;              // bytes JPEG/PNG — jamás se loguea ni persiste en Postgres
  readonly back: Buffer | null;        // opcional
}
```

**Adaptadores:**

```ts
// src/document-ocr-face-match-provider/infrastructure/evidence/redis/redis-evidence.store.ts
@Injectable()
export class RedisEvidenceStore implements EvidenceStore {
  private readonly logger = new Logger(RedisEvidenceStore.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async put(examinationId: string, evidence: DocumentEvidence): Promise<void> {
    const ttl = this.config.get<number>('ocr.ttlMinutes', 30) * 60;
    await this.redis.set(this.key(examinationId), JSON.stringify(this.encode(evidence)), 'EX', ttl);
  }

  async take(examinationId: string): Promise<DocumentEvidence | null> {
    const raw = await this.redis.getdel(this.key(examinationId)); // atómico: consume una vez
    if (!raw) return null;
    return this.decode(JSON.parse(raw) as EncodedEvidence);
  }

  private key(examinationId: string): string { return `ocr:evidence:${examinationId}`; }
}
```

> `GETDEL` (Redis ≥ 6.2) hace el take atómico: si dos workers intentan consumir la misma evidencia, solo uno la obtiene. Es la misma garantía "single-use" que ya usa `consumed` en `ocr.examinations`, pero para los bytes.

**Codificación**: `Buffer` → `base64` para viajar por Redis. **Nunca** por el outbox ni por eventos (el outbox persiste `payload JSONB` en Postgres).

**Variante dev/test**: `InMemoryEvidenceStore` con un `Map` + TTL, seleccionado por `EVIDENCE_STORE_DRIVER=redis|memory` (default `memory` en `NODE_ENV=test`).

> **¿Por qué Redis y no S3?** S3 cuesta ($0.005/GB, mínimo 1 mes) y obliga a gestionar URLs firmadas y su ciclo de vida. Redis ya está en el compose, la evidencia muere en 30 minutos, y `GETDEL` da la semántica de consumo único gratis. Si el volumen creciera, el puerto `EVIDENCE_STORE` permite cambiar a S3 sin tocar el dominio.

### 5.4 Ensanchar los puertos de vendor

**`EXECUTOR_PORT`** — el adapter necesita los bytes:

```ts
// src/document-ocr-face-match-provider/application/internal/outboundservices/executor/document-executor.service.ts
export const EXECUTOR_PORT = Symbol('EXECUTOR_PORT');

export interface DocumentExecutorService {
  /** Observa si el documento se pudo leer; si no, una razón cerrada. */
  observeExtraction(evidence: DocumentEvidence): Promise<{ readable: boolean; reason: string | null }>;
  /** Observa si el rostro del documento sostiene la comparación. */
  observeComparison(evidence: DocumentEvidence): Promise<{ holds: boolean }>;
}
```

**`MATCHING_PORT`** — el adapter devuelve el **score**, el BC juzga (D-4):

```ts
// src/biometric-identity-verification/application/internal/outboundservices/matching/face-matching.service.ts
export const MATCHING_PORT = Symbol('MATCHING_PORT');

export interface FaceMatchingService {
  /**
   * Observa la similitud entre la referencia viva de la persona y la captura
   * actual. Devuelve el score normalizado 0..1; el UMBRAL LO JUZGA EL BC
   * (`biometric.matchThreshold`). El vendor nunca decide el veredicto.
   */
  observeSimilarity(capture: FaceCapture): Promise<{ score: number }>;
}
```

> **Cambio de contrato importante.** El puerto antes devolvía `boolean` y el adapter comparaba contra el umbral. Eso es exactamente lo que el audit D-4 prohíbe ("Vendor reporta score; BC juzga boolean contra umbral propio"). Con el score de vuelta, la comparación vive en `BiometricCommandServiceImpl.recordVerdict`:
>
> ```ts
> const { score } = await this.matching.observeSimilarity(capture);
> const match = score >= this.config.get<number>('biometric.matchThreshold', 0.82);
> ```
>
> El `fake` de test devuelve `score: 1`; `vendor-a`/`vendor-b` (los stubs actuales) se convierten en adaptadores de **score fijo** (`0.95` / `0.97`) que ya no mienten sobre el umbral.

**`FaceCapture`** — tipo de application del BC Biometric:

```ts
export interface FaceCapture {
  readonly selfie: Buffer;       // bytes JPEG/PNG de la captura actual
  readonly sessionId: string | null; // sesión de liveness de AWS, si aplica
}
```

### 5.5 Configuración y variables de entorno

Tres lugares deben quedar sincronizados (hoy ya hay drift: `OTP_HASHER` falta en `.env.example` y 6 vars `OUTBOX_*`/`VOTING_AUTH_*` no están en el Joi):

1. `src/shared/infrastructure/persistence/configuration/validation.schema.ts` — Joi (fuente de verdad del arranque).
2. `src/shared/infrastructure/<tech>/configuration/<tech>.config.ts` — mapeo `process.env` → namespace.
3. `.env.example` — valores locales.

Namespaces nuevos: `ocr` (ya existe → se amplía), `biometric` (ya existe → se amplía), `aws` (nuevo), `azure` (nuevo), `relay` (ya existe → se amplía), `wallet` (ya existe).

Ver [Apéndice A](#10-apéndice-a--variables-de-entorno) para la matriz completa.

---

<a name="6-parte-ii--azure-ai-document-intelligence-ocr"></a>

## 6. Parte II — Azure AI Document Intelligence (OCR)

### 6.1 Crear el recurso (FASE 0, manual)

1. Portal de Azure → **Azure AI services → Azure AI Document Intelligence** → *Create*.
2. **Pricing tier: `F0` (Free)** — 500 páginas/mes, 1 req/s, 4 MB/archivo, solo 2 primeras páginas.
3. **Región**: la misma que el resto de la app (p. ej. `eastus`). La región se fija en la URL del endpoint.
4. **Claves**: *Keys and Endpoint* → `endpoint` + `KEY1`.
5. En producción, en vez de key: **Microsoft Entra ID** → App registration → *API permissions* → `Cognitive Services User` → `DefaultAzureCredential` en el backend (sin llaves estáticas).

**Costos**: F0 no expira. Si se pasa de 500 pág/mes, S0 = $1.50 por 1.000 páginas (primeros 1M).

### 6.2 Autenticación

```ts
// src/shared/infrastructure/azure/configuration/azure.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('azure', () => ({
  documentIntelligence: {
    endpoint: process.env['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'] ?? '',
    key: process.env['AZURE_DOCUMENT_INTELLIGENCE_KEY'] ?? '',
    tenantId: process.env['AZURE_TENANT_ID'] ?? '',
    clientId: process.env['AZURE_CLIENT_ID'] ?? '',
    clientSecret: process.env['AZURE_CLIENT_SECRET'] ?? '',
    model: process.env['AZURE_DOCUMENT_INTELLIGENCE_MODEL'] ?? 'prebuilt-read',
  },
}));
```

**Selector de credencial** (en el adapter, no en el dominio):

```ts
// src/document-ocr-face-match-provider/infrastructure/executor/azure-document-intelligence/azure-credential.factory.ts
export function buildAzureCredential(config: ConfigService): KeyCredential | TokenCredential {
  const key = config.get<string>('azure.documentIntelligence.key', '');
  if (key) return new AzureKeyCredential(key);
  return new DefaultAzureCredential({
    tenantId: config.get<string>('azure.documentIntelligence.tenantId', '') || undefined,
    clientId: config.get<string>('azure.documentIntelligence.clientId', '') || undefined,
    clientSecret: config.get<string>('azure.documentIntelligence.clientSecret', '') || undefined,
  });
}
```

> `DefaultAzureCredential` con `AZURE_TENANT_ID`/`CLIENT_ID`/`CLIENT_SECRET` explícitos es un **service principal** acotado a tu tenant. Es preferible al `managed identity` solo si el backend corre fuera de Azure; en Azure App Service / Container Apps, `DefaultAzureCredential` sin parámetros ya usa la managed identity (gratis).

### 6.3 Llamada al servicio

```ts
// src/document-ocr-face-match-provider/infrastructure/executor/azure-document-intelligence/azure-document-intelligence.executor.service.ts
import { DocumentAnalysisClient } from '@azure/ai-form-recognizer';

@Injectable()
export class AzureDocumentIntelligenceExecutorService implements DocumentExecutorService {
  private readonly logger = new Logger(AzureDocumentIntelligenceExecutorService.name);
  private readonly client: DocumentAnalysisClient;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('azure.documentIntelligence.endpoint', '');
    if (!endpoint) throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is required');
    this.client = new DocumentAnalysisClient(endpoint, buildAzureCredential(this.config));
    this.model = this.config.get<string>('azure.documentIntelligence.model', 'prebuilt-read');
  }

  async observeExtraction(evidence: DocumentEvidence): Promise<{ readable: boolean; reason: string | null }> {
    const analysis = await this.analyze(evidence.front);
    const parsed = this.parser.parse(evidence.documentType, analysis);
    if (!parsed.readable) return { readable: false, reason: parsed.reason };
    return { readable: true, reason: null };
  }

  async observeComparison(evidence: DocumentEvidence): Promise<{ holds: boolean }> {
    // El retrato del documento se resuelve en el BC Biometric (AWS). Aquí el
    // executor OCR sólo declara si el documento sostiene la comparación.
    // Implementación: detección de rostro sobre el frente (ver §6.6).
    const holds = await this.faceMatcher.holds(evidence.front, evidence.selfie ?? null);
    return { holds };
  }

  private async analyze(buffer: Buffer): Promise<AnalyzeResult> {
    const poller = await this.client.beginAnalyzeDocument(this.model, buffer, {
      outputContentFormat: 'text',
      pollingInterval: 1000,
    });
    return await poller.pollUntilDone();
  }
}
```

**Notas operativas del SDK v5:**

| Detalle | Valor |
|---|---|
| Método | `beginAnalyzeDocument(modelId, document, options)` → `Promise<AnalysisPoller>` |
| Espera | `await poller.pollUntilDone()` (LRO: el análisis es asíncrono en el servicio) |
| Documento | `Buffer` / `Readable` / `Blob` — **`Buffer` es lo más simple** |
| Resultado útil | `result.content` (texto completo), `result.pages[].words[]` (`content`, `confidence`, `span`, `polygon`), `result.languages` |
| Modelos disponibles | `prebuilt-read` (texto), `prebuilt-layout` (estructura), `prebuilt-document` (campos clave-valor), `prebuilt-idDocument` (DL/pasaportes US/EU) |
| Errores | `RestError` con `status`; 429 = throttling (F0 es 1 req/s) |

### 6.4 Modelo de análisis: `prebuilt-read` + parsing propio

**Por qué no `prebuilt-idDocument`:** su esquema de campos está entrenado para **Driver License (US/CA) y pasaportes**. El DNI peruano (tarjeta con foto, 8 dígitos, código FMR de 10 dígitos, dos apellidos y dos nombres, tres fechas) y la CE peruana (alfanumérica) **no encajan** en ese esquema: se devolverían campos vacíos o, peor, se mapearían mal (p. ej. confundir el número de documento con el ID del pasaporte). La alternativa correcta es leer el texto y aplicar las reglas de negocio del DNI/CE.

**Implementación del parser** (`infrastructure/executor/azure-document-intelligence/dni-field.parser.ts`):

```ts
export interface ParsedDocument {
  readonly readable: boolean;
  readonly reason: UnreadableReason | null;   // set cerrado del BC
  readonly documentNumber: string | null;     // 8 dígitos (DNI) o alfanumérico (CE)
  readonly fullName: string | null;
  readonly birthDate: string | null;          // ISO
  readonly expiryDate: string | null;         // ISO
  readonly rawTextLength: number;
  readonly averageWordConfidence: number;
}

export class DniFieldParser {
  private static readonly DNI_NUMBER = /\b(\d{8})\b/;
  private static readonly FMR_CODE = /\b(\d{10})\b/;          // código + DNI pegados
  private static readonly CE_NUMBER = /\b([A-Z]\d{7,8}[A-Z]?)\b/;
  private static readonly EXPIRY = /\b(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b/g;

  parse(documentType: string, analysis: AnalyzeResult): ParsedDocument { /* ... */ }
}
```

**Reglas de mapeo al set cerrado de 5 razones** (`UnreadableReason`):

| Situación detectada | `UnreadableReason` |
|---|---|
| Texto casi vacío (< 8 palabras) o confianza media < 0.55 | `BLURRY` |
| Confianza media 0.55–0.75 **y** palabras clave (DNI/fecha) incompletas | `BLURRY` |
| reflejo → contraste de imagen no disponible en DI, pero se infiere de baja confianza media con texto parcial | `GLARE` |
| No se encontró el campo `documentNumber` con el formato del tipo declarado | `MISMATCHED_TYPE` |
| Se encontró `expiryDate` < hoy | `EXPIRED` |
| Texto completo pero el documento está recortado (falta la banda de la fecha de nacimiento) | `CROPPED` |

> **Regla de oro del dominio**: el adapter **no decide** el veredicto, solo produce la razón dentro del set cerrado. El `DocumentExamination.recordExtraction(readable, reason)` y `recordVerdict(Verdict)` siguen siendo la autoridad. Ningún string nuevo sale del adapter: si el parser necesita una razón que no está en el set, se registra el caso y se mapea a la más cercana — **nunca** se extiende el set sobre la marcha.

**El `Verdict` completo** (quién decide MATCH vs NO_MATCH):

```
readable = false                                  → Verdict.UNREADABLE
readable = true ∧ retrato no detectable            → Verdict.NO_MATCH
readable = true ∧ retrato detectado ∧ comparación  → Verdict.MATCH  (holds)
readable = true ∧ retrato detectado ∧ no coincide  → Verdict.NO_MATCH
```

Es decir: `MATCH` exige **dos** hechos — documento legible **y** rostro coincidente. El `UNREADABLE` es terminal para ese intento (el usuario debe reintentar con otra foto, `requestReexamination` con ID nuevo).

### 6.5 El retrato del DNI → `FaceId` de Rekognition

El documento de identidad **contiene** el retrato. Ese retrato es la referencia biométrica de por vida. La comparación selfie↔retrato ocurre **una sola vez**, en el enrollment.

**Orden correcto (no al revés):**

```
1. El usuario sube el frente del DNI           → Azure lee el texto (legibilidad, campos)
2. El usuario sube el selfie                    → AWS detecta el rostro
3. AWS IndexFaces(frente del DNI, bbox del rostro) → FaceId   ← la referencia
4. AWS IndexFaces(selfie) no: el retrato del documento es la referencia canónica
5. En cada voto: AWS SearchFacesByImage(selfie) → Similarity
```

**Detección del rostro sobre el frente del DNI** (AWS, dentro del BC Biometric — ver [§7](#7-parte-iii--aws-rekognition-biometría)):

```ts
const detect = await rekognition.send(new DetectFacesCommand({
  Image: { Bytes: frontBuffer },
  Attributes: ['ALL'],
  QualityFilter: 'AUTO',
}));

const face = (detect.FaceDetails ?? [])
  .filter((f) => (f.Confidence ?? 0) >= 99)
  .sort((a, b) => (b.BoundingBox?.Width ?? 0) * (b.BoundingBox?.Height ?? 0)
                 - (a.BoundingBox?.Width ?? 0) * (a.BoundingBox?.Height ?? 0))[0];
```

**Mapa de `QualityControl` a la razón cerrada** (esta es la parte que da valor real al servicio):

| `QualityControl` | Umbral | Razón |
|---|---|---|
| `Brightness` | < 30 o > 240 | `GLARE` |
| `Sharpness` | < 40 | `BLURRY` |
| `Confidence` | < 90 | `BLURRY` |
| `FaceOccluded.Value` | true | `CROPPED` |

**Indexado sin recortar la imagen** — `IndexFaces` acepta un `Detection.BoundingBox` en coordenadas relativas, así que **no hace falta `sharp` ni manipulating bytes**:

```ts
const indexed = await rekognition.send(new IndexFacesCommand({
  CollectionId: collectionId,
  Image: { Bytes: frontBuffer },
  ExternalImageId: personId,           // referencia por identidad, no datos del documento
  Detection: { BoundingBox: face.BoundingBox, Confidence: face.Confidence },
  QualityFilter: 'AUTO',
  MaxFaces: 1,
}));

const faceId = indexed.FaceRecords?.[0]?.FaceId;
if (!faceId) throw new Error('face not indexed');
```

### 6.6 Wiring del módulo

```ts
// src/document-ocr-face-match-provider/document-ocr-face-match-provider.module.ts
providers: [
  // ... los existentes
  AzureDocumentIntelligenceExecutorService,
  DniFieldParser,
  { provide: EVIDENCE_STORE, useClass: ... }, // Redis | InMemory según env
  {
    provide: EXECUTOR_PORT,
    inject: [ConfigService, AzureDocumentIntelligenceExecutorService, RekognitionExecutorService, GdocAiExecutorService],
    useFactory: (config, azure, rekognition, gdocAi): DocumentExecutorService => {
      const executor = config.get<string>('ocr.executor', 'azure-document-intelligence');
      if (executor === 'rekognition') return rekognition;
      if (executor === 'gdoc-ai') return gdocAi;
      return azure;
    },
  },
]
```

`OCR_EXECUTOR` pasa a ser `azure-document-intelligence | rekognition | gdoc-ai` (default `azure-document-intelligence`). El valor nuevo debe añadirse al `Joi.valid(...)` de `validation.schema.ts` o **el arranque falla** (el `Joi` valida en boot).

> Los adaptadores `rekognition` y `gdoc-ai` se **mantienen** (Strategy, un solo cambio de línea para cambiar de vendor) pero deben dejar de mentir: mientras no tengan SDK real, su doc-comment debe decir explícitamente `STUB` y el factory debe **prohibirlos en producción**:
>
> ```ts
> if (config.get('app.nodeEnv') === 'production' && executor !== 'azure-document-intelligence') {
>   throw new Error('only azure-document-intelligence is allowed in production');
> }
> ```

### 6.7 Tests

| Capa | Qué probar | Cómo |
|---|---|---|
| Domain | `recordExtraction` → `recordComparison` → `recordVerdict`; `UNREADABLE` terminal | unit puro, ya cubierto |
| Parser | 12 fixtures: DNI bueno, DNI borroso, DNI vencido, CE, pasaporte, recibo, foto de pantalla,etc. | unit con `AnalyzeResult` fabricated (sin red) |
| Adapter | `observeExtraction` con un `DocumentAnalysisClient` fake | `overrideProvider` de Nest |
| E2E | `POST /examinations` (multipart) → `examine` → `MATCH` → `consumeMatch` | supertest + Testcontainers Postgres |

**Fixture de referencia**: 6 fotos de DNI de prueba (no usar documentos reales de terceros; usar los datasets públicos de prueba de Azure DI: `https://learn.microsoft.com/azure/ai-services/document-intelligence/prebuilt/id-document` incluye imágenes de muestra).

### 6.8 Límites y troubleshooting

| Síntoma | Causa probable | Acción |
|---|---|---|
| `RestError 400 "Invalid request"` | Content-Type no soportado o archivo > 4 MB en F0 | Validar MIME/tamaño en el controller antes de llamar |
| `RestError 429` | F0 limita a 1 req/s | Serializar el worker de OCR, o subir a S0 |
| `RestError 404` (modelo) | `prebuilt-idDocument` no habilitado en la región | Usar `prebuilt-read` (siempre disponible) |
| Poll never finishes | `pollingInterval` muy alto con F0 | Dejar `1000` ms y `pollUntilDone()` con timeout externo (`AbortSignal.timeout(30_000)`) |
| `content` vacío pero el documento es legible | Imagen rotada 90° o HEIC | Rechazar HEIC en el controller (`image/jpeg`, `image/png` only) |

---

<a name="7-parte-iii--aws-rekognition-biometría"></a>

## 7. Parte III — AWS Rekognition (biometría)

### 7.1 Cuenta, región y IAM (FASE 0, manual)

1. Cuenta AWS (o root de una organización de prueba). Crear un **rol de IAM** para el backend (task role / instance profile) — **no** access keys en el entorno.
2. **Región**: `us-east-1` (la colección de rostros vive en la región; cambiar de región = rehacer la colección).
3. Política least-privilege (ajustar el ARN del rol):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RekognitionFace",
      "Effect": "Allow",
      "Action": [
        "rekognition:DetectFaces",
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces",
        "rekognition:ListFaces"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RekognitionCollections",
      "Effect": "Allow",
      "Action": ["rekognition:CreateCollection", "rekognition:DescribeCollection", "rekognition:DeleteCollection"],
      "Resource": "*"
    },
    {
      "Sid": "RekognitionLiveness",
      "Effect": "Allow",
      "Action": ["rekognition:CreateFaceLivenessSession", "rekognition:GetFaceLivenessSessionResults"],
      "Resource": "*"
    }
  ]
}
```

> `Resource: "*"` es inevitable en Rekognition (no soporta resource-level permissions para la mayoría de estas acciones). Compensar con: región fijada, credenciales de rol acotadas, y logging de CloudTrail.

### 7.2 La colección de rostros

```ts
// src/biometric-identity-verification/infrastructure/matching/rekognition/rekognition-face-collection.service.ts
@Injectable()
export class RekognitionFaceCollectionService implements OnModuleInit {
  private readonly logger = new Logger(RekognitionFaceCollectionService.name);

  constructor(
    private readonly rekognition: RekognitionClient,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const collectionId = this.config.get<string>('aws.rekognition.collectionId', 'votachain-biometric');
    try {
      await this.rekognition.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
      this.logger.log(`face collection ${collectionId} present`);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      await this.rekognition.send(new CreateCollectionCommand({
        CollectionId: collectionId,
        FaceAttributes: 'ALL',
        FaceDetectionSettings: { QualityFilter: 'AUTO' },
      }));
      this.logger.log(`face collection ${collectionId} created`);
    }
  }
}
```

> **Coste de la colección**: el *face vector* se cobra a $0.00001/vector/mes (≈$0.01 por 1.000). El free tier cubre 1.000 vectores/mes durante los primeros 12 meses. Un votante = 1 vector. **1.000 vectores ≈ 1.000 votantes ≈ $0.01/mes.** Irrelevante.

> **Cuidado con `onModuleInit`**: si el backend corre con varias réplicas, todas intentarán crear la colección. `CreateCollection` es idempotente en la práctica pero devuelve `ResourceAlreadyExistsException`; se captura y se continúa.

### 7.3 La referencia viva: `referenceRef`

**Problema**: `biometric.profiles` no tiene dónde guardar el `FaceId` de AWS, y el diseño prohíbe guardar imágenes o descriptores.

**Solución**: guardar un **handle opaco** en la columna nueva `reference_ref`, con su propio VO. El dominio sabe que "existe una referencia viva" y que "para re-verificar hay que entregar la captura al proveedor"; **no sabe** que es un `FaceId` de AWS ni que hay un vector facial en otro lado.

```ts
// src/biometric-identity-verification/domain/model/valueobjects/reference-ref.value-object.ts
export class ReferenceRef {
  private constructor(public readonly value: string) {}
  static of(value: string): ReferenceRef {
    if (!value?.trim()) throw new Error('referenceRef required');
    return new ReferenceRef(value.trim());
  }
  equals(other: ReferenceRef): boolean { return this.value === other.value; }
}
```

```ts
// src/biometric-identity-verification/domain/model/aggregates/biometric-profile.aggregate.ts
export class BiometricProfile extends AggregateRoot {
  private constructor(
    private readonly _id: BiometricProfileId,
    private readonly _personId: PersonId,
    private _standing: ProfileStanding,
    private readonly _reference: ReferenceRef | null,   // handle opaco del proveedor
  ) { super(); }

  static enroll(i: { id: BiometricProfileId; personId: PersonId; reference: ReferenceRef }): BiometricProfile { /* ... */ }
  static rehydrate(i: { /* ... */ reference: ReferenceRef | null }): BiometricProfile { /* ... */ }

  answerReferenceStanding(): { live: boolean } {
    return { live: this._standing === ProfileStanding.ENROLLED && this._reference !== null };
  }

  get reference(): ReferenceRef | null { return this._reference; }
}
```

**Migración** (ver [Apéndice B](#11-apéndice-b--migraciones)):

```sql
ALTER TABLE biometric.profiles ADD COLUMN IF NOT EXISTS reference_ref VARCHAR(256) NULL;
ALTER TABLE biometric.profiles ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NULL;
```

> `provider` (`'aws-rekognition'`) documenta de dónde salió el handle, para poder migrar a otro vendor sin adivinar. No lo lee el dominio para decidir nada: es metadato de infraestructura.

**Invariante estructural nueva**: `standing = 'ENROLLED'` **exige** `reference_ref IS NOT NULL`. Se refuerza con un `CHECK`:

```sql
ALTER TABLE biometric.profiles
  ADD CONSTRAINT ck_live_profile_has_reference
  CHECK (standing <> 'ENROLLED' OR reference_ref IS NOT NULL);
```

> Esto cambia la regla del aggregate `enroll()`: ahora `enroll` necesita el handle. El flujo de enrollment se invierte: **el vendor indexa primero, el agregado se enrola después** (el handle es un hecho del exterior que la persona ya ha demostrado). Si `IndexFaces` falla, no hay perfil.

### 7.4 El umbral vive en el BC

```ts
// src/biometric-identity-verification/application/internal/commandservices/biometric-command.service.impl.ts
async recordVerdict(command: RecordVerdictCommand): Promise<void> {
  // El vendor ANTES del run: la red no vive dentro de la transacción.
  const { score } = await this.matching.observeSimilarity(command.capture);
  // EL BC juzga contra SU umbral. El listón no sale del BC (audit D4).
  const threshold = this.config.get<number>('biometric.matchThreshold', 0.82);
  const match = score >= threshold;

  const updated = await this.uow.run(async () => {
    const attempt = await this.requireAttempt(command.attemptId);
    attempt.recordVerdict(match, command.now);
    await this.attempts.save(attempt);
    return attempt;
  });
  this.publish(updated);
}
```

**El score se normaliza a 0..1** en el adapter (Rekognition devuelve `Similarity` 0–100):

```ts
const matches = result.FaceMatches ?? [];
const similarity = matches.length > 0 ? (matches[0].Similarity ?? 0) / 100 : 0;
return { score: similarity };
```

**Joi debe acotar el umbral** (hoy no lo hace: `Joi.number()` acepta `2` o `-1`):

```ts
FACE_MATCH_THRESHOLD: Joi.number().min(0).max(1).default(0.82),
```

### 7.5 Liveness real (cierra un agujero de confianza)

**Estado actual**: `CompleteLivenessCommand(attemptId, present: boolean)` — el **navegador** afirma que la persona está viva. Un atacante puede llamar al endpoint con `present: true`.

**Realidad con AWS**: el veredicto de liveness lo emite AWS y **no se puede falsear desde el cliente** porque el cliente solo ejecuta el reto, no decide el resultado.

**Flujo:**

```
1. Frontend: POST /api/v1/biometric/attempts                  → { attemptId }
2. Frontend: POST /api/v1/biometric/attempts/:id/liveness/session
      Backend → CreateFaceLivenessSession → { sessionId, streamingUrl }
      Backend → persiste sessionId en biometric.attempts
3. Frontend: usa el SDK de UI de Face Liveness (Amplify) con el streamingUrl
      → el vídeo se transmite a AWS → AWS clasifica
4. Frontend: POST /api/v1/biometric/attempts/:id/liveness/result   { sessionId }
      Backend → GetFaceLivenessSessionResults(sessionId)
      Backend → mapea a LivenessOutcome.PRESENT | ABSENT
      Backend → VerificationAttempt.completeLiveness(present)   ← la verdad viene de AWS
```

**Adaptador:**

```ts
// src/biometric-identity-verification/infrastructure/matching/rekognition/rekognition-liveness.service.ts
@Injectable()
export class RekognitionLivenessService {
  constructor(private readonly rekognition: RekognitionClient) {}

  async openSession(): Promise<{ sessionId: string; streamingUrl: string }> {
    const res = await this.rekognition.send(new CreateFaceLivenessSessionCommand({}));
    if (!res.SessionId || !res.StreamingUrl) throw new Error('liveness session not created');
    return { sessionId: res.SessionId, streamingUrl: res.StreamingUrl };
  }

  async readDecision(sessionId: string): Promise<{ present: boolean; confidence: number }> {
    const res = await this.rekognition.send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
    // `Status` = 'Completed' | 'InProgress' | ...
    if (res.Status !== 'Completed') return { present: false, confidence: 0 };
    const decision = res.FaceLivenessSessionResult?.Decision;   // 'Live' | 'NotLive' | 'Unknown'
    const confidence = res.FaceLivenessSessionResult?.Confidence ?? 0;
    return { present: decision === 'Live', confidence };
  }
}
```

> **Verificar el enum `Decision` contra la referencia de la API** antes de mergear: AWS documenta `Live` / `NotLive` / `Unknown`. El adapter mapea `Live` → `PRESENT` y cualquier otro → `ABSENT` (fail-closed).

**Cambio de dominio** — `CompleteLivenessCommand` deja de llevar el booleano:

```ts
// src/biometric-identity-verification/domain/model/commands/complete-liveness.command.ts
export class CompleteLivenessCommand {
  constructor(
    public readonly attemptId: VerificationAttemptId,
    public readonly sessionId: string,   // el backend valida contra el proveedor
  ) {}
}
```

Y el application service pide la verdad al provider antes de tocar el agregado:

```ts
async completeLiveness(command: CompleteLivenessCommand): Promise<void> {
  const decision = await this.liveness.readDecision(command.sessionId); // red FUERA del tx
  const updated = await this.uow.run(async () => {
    const attempt = await this.requireAttempt(command.attemptId);
    attempt.completeLiveness(decision.present);
    await this.attempts.save(attempt);
    return attempt;
  });
  this.publish(updated);
}
```

> **Riesgo de replay**: el mismo `sessionId` no debe poder reutilizarse. El `sessionId` se persiste en `biometric.attempts.liveness_session_id` (columna nueva, única) y el `VerificationAttempt` solo admite `completeLiveness` una vez (ya está garantizado por `assertStanding(CHALLENGE_OPEN)`).

> **Dependencia de frontend**: el SDK de UI de Face Liveness de AWS es el que captura los frames. Si el frontend no puede integrarlo (o el equipo quiere evitar un SDK propietario), la alternativa es dejar el `present` del cliente — **pero documentarlo como deuda de seguridad explícita**, no como diseño final.

### 7.6 Borrado y Ley 29733 (el punto que se suele olvidar)

El derecho de supresión del BC Biometric (`revokeBiometricProfile`) hoy solo marca `REVOKED` en Postgres. Con la referencia en AWS, **el vector facial queda en el proveedor** si no se borra.

**El `revoke` debe eliminar la evidencia del proveedor**, no solo la fila local:

```ts
// src/biometric-identity-verification/application/internal/commandservices/biometric-command.service.impl.ts
async revokeBiometricProfile(command: RevokeBiometricProfileCommand): Promise<void> {
  const { profile, expired } = await this.uow.run(async () => {
    const p = await this.profiles.findById(command.profileId);
    if (!p) throw new ReferenceRequiredError('no profile');
    p.revoke();
    const open = await this.attempts.findOpenByProfile(p.id);
    for (const a of open) a.expire(FailureReason.REFERENCE_ENDED);
    await this.profiles.save(p);
    for (const a of open) await this.attempts.save(a);
    return { profile: p, expired: open };
  });
  this.publish(profile);
  for (const a of expired) this.publish(a);

  // Borrado en el proveedor: sin esto, el vector facial sobrevive al borrado.
  if (profile.reference) {
    await this.matching.forget(profile.reference.value);   // DeleteFaces
  }
}
```

Y `forget()` en el adapter:

```ts
async forget(referenceRef: string): Promise<void> {
  await this.rekognition.send(new DeleteFacesCommand({
    CollectionId: this.collectionId,
    FaceIds: [referenceRef],
  }));
}
```

> **Orden y consistencia**: el borrado en el proveedor ocurre **después** del commit local (fail-safe: si el proveedor falla, el perfil local ya está revocado y el `ReconciliationJob` puede reintentar). Documentar esa decisión en el ADR del erasure. El idempotencia del `DeleteFaces` (`FaceId` inexistente → no error) permite reintentar sin miedo.

> **El `ReferenceRef` es dato personal** (apunta a un vector facial). Por eso `biometric.profiles.reference_ref` entra en el inventario de datos de la Ley 29733 y debe anonimizarse o borrarse en el erasure (el `revoke` deja el perfil con `standing='REVOKED'` y `reference_ref` **anulado**, no necesariamente borrado: la traza de "hubo una referencia" es parte de la auditoría).

### 7.7 Wiring del módulo

```ts
// src/biometric-identity-verification/biometric-identity-verification.module.ts
providers: [
  // ...
  { provide: AWS_REKOGNITION_CLIENT, useFactory: (config: ConfigService) => new RekognitionClient({ region: config.get<string>('aws.region', 'us-east-1') }) },
  RekognitionFaceCollectionService,
  RekognitionMatchingService,
  RekognitionLivenessService,
  {
    provide: MATCHING_PORT,
    inject: [ConfigService, RekognitionMatchingService, VendorAMatchingService, VendorBMatchingService, FakeMatchingService],
    useFactory: (config, rekognition, vendorA, vendorB, fake): FaceMatchingService => {
      const matcher = config.get<string>('biometric.matcher', 'rekognition');
      if (matcher === 'vendor-a') return vendorA;
      if (matcher === 'vendor-b') return vendorB;
      if (matcher === 'fake') return fake;
      return rekognition;
    },
  },
]
```

`FACE_MATCHER` pasa a ser `rekognition | vendor-a | vendor-b | fake` (default `rekognition`).

### 7.8 Tests

| Capa | Qué probar |
|---|---|
| Domain | `recordVerdict` con score ≥ umbral y < umbral; `REVOKED` no reescribe veredictos pasados; `expire(REFERENCE_ENDED)` por intento abierto |
| Adapter | `RekognitionMatchingService` con `RekognitionClient` fake: `Similarity: 95` → `score 0.95`; sin match → `0` |
| Adapter | `RekognitionLivenessService`: `Decision: 'Live'` → `present: true`; `'NotLive'` → `false`; `Status != 'Completed'` → `false` (fail-closed) |
| Application | `recordVerdict` NO marca `VERIFIED` si `score < umbral` — **test de la auditoría D4** |
| Infra | `DeleteFaces` se invoca en `revokeBiometricProfile` |
| E2E | `POST /attempts` → `:id/liveness` → `:id/comparison` → `:id/verdict` → `standing` |

**Test que no debe faltar** (es el que documenta D4):

```ts
it('the BC judges the threshold, not the vendor', async () => {
  matching.observeSimilarity = vi.fn().mockResolvedValue({ score: 0.81 });
  config.get = vi.fn().mockReturnValue(0.82);
  await service.recordVerdict(new RecordVerdictCommand(attemptId, now, capture));
  expect(attempt.standing).toBe(AttemptStanding.NOT_VERIFIED);
});
```

### 7.9 Costos

| Ítem | Precio |
|---|---|
| Free tier (cuentas nuevas, 12 meses) | 1.000 imágenes/mes (Group 1 y 2) + 1.000 vectores/mes de metadatos de rostro |
| Créditos AWS | $200 para clientes nuevos (desde julio 2025) |
| Tras el free tier | $0.001/imagen (primeros 1M/mes) |
| Almacenamiento de vector facial | $0.00001/vector/mes |
| Liveness | cotizado por sesión de liveness |

**1 votante ≈ 3 imágenes/mes** (1 frente de DNI al enrolar + 1 selfie al enrolar + 1 selfie por voto) → 1.000 imágenes ≈ 330 votos/mes en free tier. Más allá, $0.003/voto.

---

<a name="8-parte-iv--blockchain-en-polygon-amoy"></a>

## 8. Parte IV — Blockchain en Polygon Amoy

### 8.1 Cuenta, faucet y RPC (FASE 0, manual)

| Ítem | Valor | Costo |
|---|---|---|
| Red | **Polygon Amoy** (PoS testnet, padre Sepolia) | $0 |
| Chain ID | **80002** | — |
| RPC público | `https://polygon-amoy.drpc.org` (o `https://rpc-amoy.polygon.technology`) | $0, con rate limit |
| RPC con cuota | Alchemy / Infura free tier | $0 hasta agotar |
| Faucet | `https://faucet.polygon.technology` | 0.5 POL/24h por dirección |
| Explorador | `https://amoy.polygonscan.com` | $0 |
| Wallet del relayer | 1 clave privada en `AMOY_PAYER_KEY` | $0 |

**Procedimiento:**

```bash
# 1) Crear la wallet del relayer (nunca en el repo)
npx hardhat init --type node  # o cualquier wallet
# La clave va a AMOY_PAYER_KEY (secreto). Publicar la dirección (p. ej. 0xabc...) en AMOY_PAYER_ADDRESS

# 2) Faucet: 0.5 POL a la dirección del relayer

# 3) Verificar
cast balance 0xTU_DIRECCION --rpc-url https://polygon-amoy.drpc.org
```

> **El relayer nunca firma el contenido del voto.** Solo paga el gas. La firma es de la wallet derivada del votante (R6, Separate Ways). Si el relayer firmara, se rompería la verificabilidad individual.

### 8.2 El contrato

`contracts/VotoChainLedger.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotoChainLedger
 * @notice Registro inmutable de votos verificados por firma EIP-712.
 *
 * Garantias:
 *  - Una sola transaccion por (propuesta, votante)  -> anti-replay a nivel de cadena.
 *  - La firma se valida con ecrecover sobre el digest EIP-712 -> el votante es quien voto.
 *  - El contenido del voto viaja como COMPROMISO (keccak256(choice, salt)); la opcion
 *    permanece oculta en la cadena hasta el revelado posterior al cierre.
 *  - El cierre de una propuesta ancla la raiz Merkle de los compromisos -> el
 *    escrutinio es recomputable por cualquier tercero.
 */
contract VotoChainLedger {
    // --- EIP-712 ---
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId)");
    bytes32 private constant VOTE_TYPEHASH =
        keccak256("Vote(bytes32 proposalId,address voter,bytes32 choiceCommitment,bytes32 nonce)");

    string public constant DOMAIN_NAME = "VotoChain";
    string public constant DOMAIN_VERSION = "1";

    // --- Modelo ---
    struct VoteRecord {
        bytes32 proposalId;
        address voter;
        bytes32 choiceCommitment;
        bytes32 nonce;         // keccak256 del VoteNonce (uuid) — ver §8.4
        uint8 choice;      // 0 hasta el revelado
        bytes32 salt;      // bytes32(0) hasta el revelado
        bool revealed;
        uint64 submittedAt;
        uint64 revealedAt;
    }

    struct Proposal {
        uint8 choiceCount;
        bool opened;
        bool closed;
        uint64 opensAt;
        uint64 closesAt;
        uint256 count;
        bytes32 merkleRoot;
    }

    // --- Estado ---
    address public immutable owner;
    bytes32 public immutable domainSeparator;

    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(bytes32 => Proposal) public proposals;
    mapping(bytes32 => VoteRecord[]) private records;
    mapping(bytes32 => mapping(address => uint256)) private recordIndex;

    // --- Eventos ---
    event VoteSubmitted(
        bytes32 indexed proposalId,
        address indexed voter,
        bytes32 indexed choiceCommitment,
        bytes32 nonce,
        uint64 submittedAt
    );
    event ChoiceRevealed(bytes32 indexed proposalId, address indexed voter, uint8 choice);
    event ProposalOpened(bytes32 indexed proposalId, uint8 choiceCount, uint64 opensAt, uint64 closesAt);
    event ProposalClosed(bytes32 indexed proposalId, uint256 count, bytes32 merkleRoot, uint64 closedAt);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // --- Errores ---
    error NotOwner();
    error ProposalNotOpen();
    error ProposalNotClosed();
    error AlreadyVoted();
    error BadChoice();
    error OutOfWindow();
    error BadSignature();
    error UnknownVote();
    error AlreadyRevealed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        // Se usa block.chainid para que el separador de dominio nunca pueda
        // desincronizarse de la red donde se despliega.
        domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid
            )
        );
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // --- Administracion (owner = wallet del relayer) ---

    function openProposal(
        bytes32 proposalId,
        uint8 choiceCount,
        uint64 opensAt,
        uint64 closesAt
    ) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        p.choiceCount = choiceCount;
        p.opened = true;
        p.closed = false;
        p.opensAt = opensAt;
        p.closesAt = closesAt;
        emit ProposalOpened(proposalId, choiceCount, opensAt, closesAt);
    }

    /// @notice Cierra la propuesta y ancla la raiz Merkle de los compromisos.
    function closeProposal(bytes32 proposalId, bytes32 merkleRoot) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        p.closed = true;
        p.merkleRoot = merkleRoot;
        emit ProposalClosed(proposalId, p.count, merkleRoot, uint64(block.timestamp));
    }

    // --- Voto ---

    /**
     * @notice Registra un voto. El llamante debe ser el firmante.
     * @param choiceCommitment keccak256(abi.encodePacked(uint8(choice), bytes32(salt)))
     * @param nonce            keccak256 del VoteNonce del voto (anti-replay de la autorización)
     */
    function submitVote(
        bytes32 proposalId,
        bytes32 choiceCommitment,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        Proposal storage p = proposals[proposalId];
        if (!p.opened || p.closed) revert ProposalNotOpen();
        if (block.timestamp < p.opensAt || block.timestamp > p.closesAt) revert OutOfWindow();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        bytes32 structHash = keccak256(
            abi.encode(VOTE_TYPEHASH, proposalId, msg.sender, choiceCommitment, nonce)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != msg.sender) revert BadSignature();

        hasVoted[proposalId][msg.sender] = true;
        records[proposalId].push(
            VoteRecord({
                proposalId: proposalId,
                voter: msg.sender,
                choiceCommitment: choiceCommitment,
                nonce: nonce,
                choice: 0,
                salt: bytes32(0),
                revealed: false,
                submittedAt: uint64(block.timestamp),
                revealedAt: 0
            })
        );
        recordIndex[proposalId][msg.sender] = records[proposalId].length;
        p.count += 1;

        emit VoteSubmitted(proposalId, msg.sender, choiceCommitment, nonce, uint64(block.timestamp));
    }

    /// @notice Revela la opcion tras el cierre y verifica el compromiso.
    function revealChoice(bytes32 proposalId, uint8 choice, bytes32 salt) external {
        Proposal storage p = proposals[proposalId];
        if (!p.closed) revert ProposalNotClosed();
        // El rango de la opcion se valida AQUI (en el submit solo viaja el compromiso).
        if (choice >= p.choiceCount) revert BadChoice();
        uint256 idx = recordIndex[proposalId][msg.sender];
        if (idx == 0) revert UnknownVote();
        VoteRecord storage rec = records[proposalId][idx - 1];
        if (rec.revealed) revert AlreadyRevealed();
        if (keccak256(abi.encodePacked(uint8(choice), salt)) != rec.choiceCommitment) revert BadChoice();
        rec.choice = choice;
        rec.salt = salt;
        rec.revealed = true;
        rec.revealedAt = uint64(block.timestamp);
        emit ChoiceRevealed(proposalId, msg.sender, choice);
    }

    // --- Lecturas ---

    function voteCount(bytes32 proposalId) external view returns (uint256) {
        return proposals[proposalId].count;
    }

    function getVotes(bytes32 proposalId, uint256 offset, uint256 limit)
        external view returns (VoteRecord[] memory)
    {
        VoteRecord[] storage all = records[proposalId];
        uint256 total = all.length;
        if (offset >= total) return new VoteRecord[](0);
        uint256 size = total - offset;
        if (size > limit) size = limit;
        VoteRecord[] memory out = new VoteRecord[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = all[offset + i];
        }
        return out;
    }

    function getVote(bytes32 proposalId, address voter)
        external view returns (VoteRecord memory)
    {
        uint256 idx = recordIndex[proposalId][voter];
        if (idx == 0) revert UnknownVote();
        return records[proposalId][idx - 1];
    }
}
```

**Decisiones de diseño del contrato y su porqué:**

| Decisión | Por qué |
|---|---|
| `hasVoted[proposalId][voter]` | Una sola tx por (propuesta, votante). Es el anti-replay **definitivo**: aunque el backend reintente, la cadena rechaza la segunda |
| `signer == msg.sender` | El firmante **es** el votante. Nadie puede registrar el voto de otro |
| `choiceCommitment` en el struct firmado | Si el struct llevara `choice` en claro, el compromiso sería inútil: la cadena vería la opción. **El compromiso es lo que se firma y lo que se publica** |
| `choice` + `salt` revelados post-cierre | La opción no se expone antes del cierre; después, el escrutinio es público y verificable. El rango `choice < choiceCount` se valida en `revealChoice` (en el `submit` solo viaja el compromiso) |
| `proposals[proposalId].choiceCount` | El contrato puede rechazar `choice` fuera de rango sin conocer la lista de opciones |
| `opensAt` / `closesAt` | La ventana de votación se valida **en la cadena**, no solo en el backend |
| `block.chainid` en el constructor | El separador de dominio nunca puede desincronizarse de la red |
| `closeProposal(proposalId, merkleRoot)` | Ancla el escrutinio con **1 tx por propuesta**, sin revelar nada |
| `getVotes` paginado | El backend y los auditores necesitan volcar los votos para recomputar el Merkle |

#### 8.2.1 El compromiso: qué puede y qué no puede ver el operador

Esto es importante y suele pasarse por alto:

- **Lo que el contrato nunca ve**: la opción voted, hasta el revelado. La cadena no filtra el secreto de la voto.
- **Lo que el operador sí puede ver**: en el modelo actual (wallet custodiada, firma server-side), el backend **necesita** el compromiso para firmarlo → el backend conoce `choice` y `salt`.
- **Consecuencia**: el compromiso protege frente a la **divulgación pública** y da una **fase de revelado auditable**, pero **no** da secreto frente al operador.
- **Para secreto real frente al operador** harían falta dos cambios de producto: (a) wallet no custodiada (el votante firma con su propia clave → el operador nunca ve el voto), o (b) esquema de umbral (MPC) entre el votante y el custodio. Ambos están fuera del MVP.

**Documentar esto como decisión consciente** (es la pregunta abierta O3 del context-mapping) y reflejarlo en el texto de consentimiento: *"el voto es público en la cadena tras el cierre; durante la votación, la opción viaja como compromiso cifrado por commitment"*.

#### 8.2.2 Commitment computation

```ts
// src/shared/infrastructure/signing/vote-commitment.ts
import { AbiCoder, keccak256 } from 'ethers';

const CODER = AbiCoder.defaultAbiCoder();

/** Compromiso del voto: keccak256(abi.encodePacked(uint8(choice), bytes32(salt))). */
export function computeChoiceCommitment(choice: number, salt: string): string {
  if (!Number.isInteger(choice) || choice < 0 || choice > 255) throw new Error('choice out of range');
  if (!/^0x[0-9a-fA-F]{64}$/.test(salt)) throw new Error('salt must be 32 bytes hex');
  return keccak256(CODER.encode(['uint8', 'bytes32'], [choice, salt]));
}
```

El mismo cálculo en el cliente (para el modelo con sal del votante) es:
`keccak256(encodePacked(['uint8','bytes32'], [choice, salt]))`.

### 8.3 Hardhat: proyecto, deploy y ABI

```
contracts/
├── contracts/VotoChainLedger.sol
├── hardhat.config.ts
├── test/votachain-ledger.spec.ts
├── scripts/deploy.ts
└── artifacts/            # generado, gitignored
```

**`contracts/hardhat.config.ts`** (TypeScript nativo de Hardhat 3; el repo es `"type": "module"`):

```ts
import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: { version: '0.8.28', settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat: { chainId: 31337 },
    amoy: {
      url: process.env.AMOY_RPC_URL ?? 'https://polygon-amoy.drpc.org',
      chainId: 80002,
      accounts: process.env.AMOY_PAYER_KEY ? [process.env.AMOY_PAYER_KEY] : [],
    },
  },
};

export default config;
```

**`contracts/scripts/deploy.ts`**:

```ts
import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const factory = await ethers.getContractFactory('VotoChainLedger');
  const ledger = await factory.deploy();
  await ledger.waitForDeployment();
  const address = await ledger.getAddress();
  console.log(`VotoChainLedger deployed at ${address}`);
  console.log(`AMOY_LEDGER_ADDRESS=${address}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

```bash
cd contracts
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox
npx hardhat compile
npx hardhat deploy --network amoy
# -> copiar la direccion a AMOY_LEDGER_ADDRESS
```

**El ABI en el backend**: no leer `artifacts/` en runtime (no existe en el bundle de producción). Se embebe como constante TypeScript:

```ts
// src/blockchain-relay-transaction-delivery/infrastructure/ledger/polygon-amoy/ledger-abi.ts
export const VOTACHAIN_LEDGER_ABI = [
  'function submitVote(bytes32 proposalId, bytes32 choiceCommitment, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function voteCount(bytes32 proposalId) view returns (uint256)',
  'function getVotes(bytes32 proposalId, uint256 offset, uint256 limit) view returns (tuple[])',
  'function getVote(bytes32 proposalId, address voter) view returns (tuple)',
  'function hasVoted(bytes32 proposalId, address voter) view returns (bool)',
  'function proposals(bytes32 proposalId) view returns (uint8, bool, bool, uint64, uint64, uint256, bytes32)',
  'event VoteSubmitted(bytes32 indexed proposalId, address indexed voter, bytes32 indexed choiceCommitment, bytes32 nonce, uint64 submittedAt)',
] as const;
```

> Alternativa válida: `dotenv` + `JSON.parse(fs.readFileSync(...))` en el build. La constante embebida es más simple y no depende del filesystem en runtime.

### 8.4 El envelope firmado compartido (Shared Kernel)

**Problema que resuelve**: hoy el Relay recibe `signed:{proposalId}:{voter}:{v}:{r}:{s}` — sin `choice`, sin `nonce` y sin el mensaje firmado. No puede verificar ni enviar la tx.

**Solución**: un VO compartido con el contenido firmado completo, en **formato de cable estable**.

```ts
// src/shared/domain/model/valueobjects/signed-vote-envelope.value-object.ts
/**
 * Contenido firmado de un voto, listo para el ledger.
 * Compartido por Voting (lo produce), Wallet (lo firma) y Relay (lo verifica
 * y lo envia). Identidad por referencia: no lleva datos del documento ni
 * imagenes; solo lo imprescindible para probar la firma en la cadena.
 *
 * Wire: vote|<proposalId>|<voter>|<choiceCommitment>|<nonce>|<v>|<r>|<s>
 *   - `nonce` : el VoteNonce es un uuid (`randomUUID`): viaja tal cual, sin convertir.
 *               (Se hashea a bytes32 al firmar; JSON no serializa BigInt, asi que el
 *               envelope nunca lleva un BigInt.)
 *   - `v/r/s` : hex sin o con `0x`, se normaliza (strip + minusculas).
 */
export class SignedVoteEnvelope {
  private constructor(
    public readonly proposalId: string,
    public readonly voter: string,
    public readonly choiceCommitment: string,
    public readonly nonce: string,
    public readonly v: number,
    public readonly r: string,
    public readonly s: string,
  ) {}

  private static normHex(h: string): string {
    return (h ?? '').replace(/^0x/i, '').toLowerCase();
  }

  static of(i: {
    proposalId: string;
    voter: string;
    choiceCommitment: string;
    nonce: string | bigint;
    v: number;
    r: string;
    s: string;
  }): SignedVoteEnvelope {
    if (!i.proposalId?.trim()) throw new Error('proposalId required');
    if (!/^0x[0-9a-fA-F]{40}$/.test(i.voter ?? '')) throw new Error('invalid voter address');
    if (!/^0x[0-9a-fA-F]{64}$/.test(i.choiceCommitment ?? '')) throw new Error('invalid choiceCommitment');
    // El nonce es un uuid (VoteNonce.fresh() = randomUUID), no un numero.
    if (!String(i.nonce ?? '').trim()) throw new Error('invalid nonce');
    if (i.v !== 27 && i.v !== 28) throw new Error('invalid v');
    const r = SignedVoteEnvelope.normHex(i.r);
    const s = SignedVoteEnvelope.normHex(i.s);
    if (!/^[0-9a-f]{64}$/.test(r) || !/^[0-9a-f]{64}$/.test(s)) {
      throw new Error('invalid signature');
    }
    return new SignedVoteEnvelope(
      i.proposalId.trim(),
      i.voter.toLowerCase(),
      i.choiceCommitment.toLowerCase(),
      String(i.nonce),
      i.v,
      r,
      s,
    );
  }

  toWire(): string {
    return ['vote', this.proposalId, this.voter, this.choiceCommitment, this.nonce, String(this.v), this.r, this.s].join('|');
  }

  static fromWire(wire: string): SignedVoteEnvelope {
    const parts = (wire ?? '').split('|');
    if (parts.length !== 8 || parts[0] !== 'vote') throw new Error('invalid signed vote envelope');
    const [, proposalId, voter, choiceCommitment, nonce, v, r, s] = parts;
    return SignedVoteEnvelope.of({ proposalId, voter, choiceCommitment, nonce, v: Number(v), r, s });
  }
}
```

> **Por qué el Shared Kernel y no el dominio de Voting**: lo consumen **tres** contextos (Voting lo produce, Wallet lo firma, Relay lo transporta y lo verifica) — es el mismo criterio que el `SignedContentRef` ya promovido. Y el formato de cable es la "Published Language" que permite al Relay verificar la firma sin entender el vocabulario de Voting (R5: "Relay nunca reescribe").

**Helpers de infraestructura compartidos** (aquí sí vive `ethers`):

```ts
// src/shared/infrastructure/signing/vote-typed-data.ts
import { keccak256, toUtf8Bytes } from 'ethers';
import type { SignedVoteEnvelope } from '../../domain/model/valueobjects/signed-vote-envelope.value-object.js';

export const VOTE_TYPED_DATA_TYPES = {
  Vote: [
    { name: 'proposalId', type: 'bytes32' },
    { name: 'voter', type: 'address' },
    { name: 'choiceCommitment', type: 'bytes32' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export function votocoinEip712Domain(chainId: number): { name: string; version: string; chainId: number } {
  return { name: 'VotoChain', version: '1', chainId };
}

/** proposalId (uuid) -> bytes32. */
export function proposalIdHash(proposalId: string): string {
  return keccak256(toUtf8Bytes(proposalId));
}

/**
 * VoteNonce (uuid de la autorización) -> bytes32. El contrato solo ve el hash,
 * que es determinista y anti-replay sin exponer el uuid interno.
 */
export function voteNonceHash(nonce: string): string {
  return keccak256(toUtf8Bytes(nonce));
}

/** Envelope -> valor tipado para ethers. */
export function toTypedVoteValue(envelope: SignedVoteEnvelope): {
  proposalId: string; voter: string; choiceCommitment: string; nonce: string;
} {
  return {
    proposalId: proposalIdHash(envelope.proposalId),
    voter: envelope.voter,
    choiceCommitment: envelope.choiceCommitment,
    nonce: voteNonceHash(envelope.nonce),
  };
}
```

> **Esto elimina la duplicación actual**: `EthersSignatureVerificationService` (Voting) y `votocoinEip712Domain` (Wallet) hoy **duplican** el dominio EIP-712 hardcodeado en dos archivos distintos que hay que mantener sincronizados a mano. Con el módulo compartido, ambos importan la misma definición.

### 8.5 El cambio del tipo firmado (obligatorio)

El tipo firmado **cambia** de `{content: string}` a los cuatro campos estructurados:
`Vote(bytes32 proposalId, address voter, bytes32 choiceCommitment, bytes32 nonce)`.
El `nonce` es `keccak256` del `VoteNonce` (uuid) — ver `voteNonceHash` en §8.4.
Sin este cambio, el contrato no puede validar `voter`, `choice` ni `nonce`.

| Archivo | Cambio |
|---|---|
| `src/cryptographic-wallet-custody/infrastructure/kms/eip712/eip712-envelope.ts` | **Se elimina**; su contenido pasa a `src/shared/infrastructure/signing/vote-typed-data.ts` |
| `src/cryptographic-wallet-custody/infrastructure/kms/hd-wallet/hd-key-custody.service.ts` | `signTransient` recibe el wire del envelope → `SignedVoteEnvelope.fromWire(...)` → `toTypedVoteValue(...)` → `TypedDataEncoder.hash(...)` |
| `src/voting/infrastructure/signing/ethers/ethers-signature-verification.service.ts` | `recoverSigner` usa `VOTE_TYPED_DATA_TYPES` y `votocoinEip712Domain` del módulo compartido (ya no hardcodea) |
| `src/voting/domain/model/aggregates/vote.aggregate.ts` | `buildMessage(...)` **se elimina**: el contenido firmado ya no es un string, es el envelope |
| `src/voting/application/internal/commandservices/vote-command.service.impl.ts` | Construye el envelope (con `choiceCommitment`) y lo firma |
| `src/voting/application/internal/queryservices/vote-query.service.impl.ts` | `getVerifiableProofByVote` re-deriva el valor tipado desde el voto persistido |

**Nuevo flujo de firma** (`vote-command.service.impl.ts`):

```ts
async castVote(command: CastVoteCommand): Promise<VoteId> {
  const auth = await this.requireAuthorization(command.authorizationId);
  // La opcion se compromete ANTES de firmar: lo que viaja es el compromiso.
  const salt = randomBytes(32);
  const choiceCommitment = computeChoiceCommitment(command.choice.value, hexlify(salt));
  const envelope = SignedVoteEnvelope.of({
    proposalId: auth.proposalId.value,
    voter: auth.voterAddress.value,
    choiceCommitment,
    nonce: auth.nonce.value.toString(),
    v: 0, r: '0'.repeat(64), s: '0'.repeat(64),   // se rellenan tras firmar
  });

  const signed = await this.wallet.sign(auth.personId.value, envelope.toWire());
  const sig = EIP712Signature.from(signed);                    // v:r:s (VO del dominio, ya existe)
  const signedEnvelope = SignedVoteEnvelope.of({
    proposalId: envelope.proposalId,
    voter: envelope.voter,
    choiceCommitment: envelope.choiceCommitment,
    nonce: envelope.nonce,
    v: sig.v, r: sig.r, s: sig.s,
  });

  const recovered = await this.signatures.recoverSigner(signedEnvelope.toWire(), signed);
  if (!VoterAddress.of(recovered).equals(auth.voterAddress)) throw new SignerMismatchError('SignerMismatch');
  // ...
}
```

> **El `salt` y el `choice` se guardan cifrados** en la fila del voto para poder revelar tras el cierre. La DB es el lugar natural: `voting.votes` gana `choice_salt BYTEA NULL` + `choice_commitment TEXT NULL`. El compromiso también queda en `relay.orders.content_ref` (dentro del envelope).

### 8.6 El gateway real

```ts
// src/blockchain-relay-transaction-delivery/infrastructure/ledger/polygon-amoy/polygon-amoy-ledger.gateway.ts
import { Contract, JsonRpcProvider, JsonRpcSigner, type PreparedTransaction } from 'ethers';
import { VOTACHAIN_LEDGER_ABI } from './ledger-abi.js';

@Injectable()
export class PolygonAmoyGateway extends BaseLedgerGateway {
  private readonly logger = new Logger(PolygonAmoyGateway.name);
  private readonly provider: JsonRpcProvider;
  private readonly iface = new Interface(VOTACHAIN_LEDGER_ABI);

  constructor(
    private readonly config: ConfigService,
    @Inject(DELIVERY_ORDER_REPOSITORY) private readonly orders: DeliveryOrderRepository,
  ) {
    super();
    this.provider = new JsonRpcProvider(this.config.get<string>('relay.amoyRpcUrl', ''), {
      chainId: 80002,
      name: 'amoy',
    });
  }

  /** El payload firmado viaja en el contentRef del pedido (R5: solo firmado). */
  protected async buildTx(orderId: string): Promise<PreparedTransaction> {
    const order = await this.orders.findById(DeliveryOrderId.of(orderId));
    if (!order) throw new OrderNotFoundError();
    const envelope = SignedVoteEnvelope.fromWire(order.contentRef.value);
    const data = this.iface.encodeFunctionData('submitVote', [
      proposalIdHash(envelope.proposalId),
      envelope.choiceCommitment,
      voteNonceHash(envelope.nonce),
      envelope.v,
      `0x${envelope.r}`,
      `0x${envelope.s}`,
    ]);
    return { to: this.ledgerAddress(), data, value: 0 };
  }

  protected async broadcast(tx: PreparedTransaction): Promise<string> {
    const signer = await this.signer();
    const hash = await signer.sendTransaction(tx);
    this.logger.log(`broadcast ${hash}`);
    return hash;
  }

  protected async observe(hash: string): Promise<LedgerOutcome> {
    let receipt;
    try {
      receipt = await this.provider.waitForTransaction(hash, 1, this.config.get<number>('relay.confirmTimeoutMs', 60_000));
    } catch {
      // Minado lento o timeout: reintentable, la misma orden sigue viva.
      return { confirmed: false, reason: null, retryable: true };
    }
    if (!receipt) return { confirmed: false, reason: null, retryable: true };
    if (receipt.status === 1) return { confirmed: true, reason: null, retryable: false };
    // Un revert NO es reintentable: reintentaria el mismo fallo deterministico.
    return { confirmed: false, reason: 'LEDGER_REJECTED', retryable: false };
  }

  private async signer(): Promise<JsonRpcSigner> {
    const pk = this.config.get<string>('relay.payerKey', '');
    if (!pk) throw new Error('AMOY_PAYER_KEY is required to broadcast');
    return new JsonRpcSigner(this.provider, pk);
  }

  private ledgerAddress(): string {
    const address = this.config.get<string>('relay.ledgerAddress', '');
    if (!address) throw new Error('AMOY_LEDGER_ADDRESS is required');
    return address;
  }
}
```

**Puntos críticos:**

| Punto | Por qué |
|---|---|
| `chainId: 80002` en el provider | `ethers` **lanza** si la red no coincide. Evita firmar y enviar a otra cadena |
| Chequeo explícito del chainId al arrancar | Un `JsonRpcProvider` puede resolver la red por URL; validar una vez contra `AMOY_CHAIN_ID` |
| `waitForTransaction` con timeout | Devuelve "pendiente" ≠ "fallido". Devolver `confirmed:false, retryable:true` reintenta **la misma orden** (at-most-once: el agregado no crea una segunda) |
| `receipt.status === 0` ⇒ no reintentable | Un revert es determinista; reintentar quemaría gas sin chances |
| `AMOY_PAYER_KEY` nunca se loguea | `logger.log` del hash sí; de la clave no |
| `voteNonceHash(envelope.nonce)` | El VoteNonce es un uuid: se hashea a `bytes32` (el contrato no ve el uuid) |

**Ampliar el set cerrado de `FailureReason`**: el caso "minado lento" no encaja en `{LEDGER_REJECTED, COST_EXHAUSTED, RETRY_LIMIT_REACHED, ORDER_SUPERSEDED}`. Se propone añadir `MINING_TIMEOUT`:

```ts
// src/blockchain-relay-transaction-delivery/domain/model/valueobjects/failure-reason.value-object.ts
export const FailureReason = {
  LEDGER_REJECTED: 'LEDGER_REJECTED',
  COST_EXHAUSTED: 'COST_EXHAUSTED',
  RETRY_LIMIT_REACHED: 'RETRY_LIMIT_REACHED',
  ORDER_SUPERSEDED: 'ORDER_SUPERSEDED',
  MINING_TIMEOUT: 'MINING_TIMEOUT',   // nuevo: la tx no se mino a tiempo; reintentable
} as const;
```

> No requiere migración: `relay.sending_attempts.reason` es `TEXT` sin `CHECK`. Verificar que `isRetryable()` devuelve `true` para `MINING_TIMEOUT`.

### 8.7 `ExternalVotingService` real y el fin del `CONFIRMED` inline

**Nuevo facade en Voting** (para que el Relay notifique sin conocer el vocabulario de Voting):

```ts
// src/voting/interfaces/acl/vote-context.facade.ts
export const VOTE_CONTEXT_FACADE = Symbol('VOTE_CONTEXT_FACADE');

export interface VoteContextFacade {
  /** Confirma un voto a partir de su contenido firmado (primitivas, R5). */
  confirmVoteByEnvelope(input: {
    envelopeWire: string;
    txHash: string;
    blockNumber: number;
  }): Promise<void>;
}
```

```ts
// src/voting/application/acl/vote-context-facade.impl.ts
@Injectable()
export class VoteContextFacadeImpl implements VoteContextFacade {
  constructor(@Inject(VOTE_COMMAND_SERVICE) private readonly votes: VoteCommandService) {}

  async confirmVoteByEnvelope(input: { envelopeWire: string; txHash: string; blockNumber: number }): Promise<void> {
    const envelope = SignedVoteEnvelope.fromWire(input.envelopeWire);
    const vote = await this.votes.findByProposalVoterAndNonce(
      envelope.proposalId, envelope.voter, envelope.nonce,
    );
    if (!vote) throw new VoteNotFoundError();
    const reference = TransactionReference.of({ txHash: input.txHash, blockNumber: input.blockNumber });
    await this.votes.markVoteConfirmed(new MarkVoteConfirmedCommand(vote.id, reference, input.blockNumber));
  }
}
```

**El Relay notifica** (patrón idéntico al `ExternalRelayService` de Voting: deep import + `@Optional()` para no crear un ciclo de módulos):

```ts
// src/blockchain-relay-transaction-delivery/application/internal/outboundservices/acl/external-voting.service.ts
@Injectable()
export class ExternalVotingService {
  private readonly logger = new Logger(ExternalVotingService.name);

  constructor(
    @Inject(VOTE_CONTEXT_FACADE) @Optional() private readonly voting: VoteContextFacade | undefined,
  ) {}

  async notifyConfirmed(input: { contentRef: string; txHash: string; blockNumber: number }): Promise<void> {
    try {
      await this.voting?.confirmVoteByEnvelope({
        envelopeWire: input.contentRef,
        txHash: input.txHash,
        blockNumber: input.blockNumber,
      });
    } catch (e) {
      // Fallar la notificacion NO revierte la orden: el ledger ya es un hecho.
      this.logger.error(`notifyConfirmed failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
```

**Y el handler inline se elimina** (`vote-cast.event-handler.ts`). El evento no lleva el
compromiso ni el nonce: el handler relee el voto persistido y construye el envelope:

```typescript
@OnEvent(VoteCastEvent.eventName, { async: true })
async handleVoteCast(event: VoteCastEvent): Promise<void> {
  try {
    await this.votes.markVoteQueued(new MarkVoteQueuedCommand(event.voteId));
    const envelope = await this.envelopeOf(event);   // relee el voto persistido
    const outcome = await this.relay.acceptSigned(event.voteId.value, envelope.toWire());
    // Referencia PROVISIONAL: el hash real de la tx no existe hasta que el
    // ledger la difunde. Se reemplaza en markVoteConfirmed.
    const provisional = TransactionReference.of({ txHash: `pending:${outcome.orderId}` });
    await this.votes.markVoteSent(new MarkVoteSentCommand(event.voteId, provisional));
    // NO se marca CONFIRMED aqui: la verdad la dice el ledger (R5).
  } catch (e) {
    this.logger.error(`UC5 failed for vote ${event.voteId.value}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

private async envelopeOf(event: VoteCastEvent): Promise<SignedVoteEnvelope> {
  const vote = await this.voteQueries.requireVoteById(event.voteId);
  return SignedVoteEnvelope.of({
    proposalId: vote.proposalId.value,
    voter: vote.voterAddress.value,
    choiceCommitment: vote.choiceCommitment,
    nonce: vote.nonce.value.toString(),
    v: vote.signature.v, r: vote.signature.r, s: vote.signature.s,
  });
}
```

> `requireVoteById` debe existir en el query service (añadirlo si el BC no lo expone:
> devuelve el agregado con `choiceCommitment`, `nonce` y `signature`). El evento
> `VoteCast` **no** se enriquece con el compromiso: su payload es parte del audit trail y la
> cadena de custodia del outbox; el envelope se reconstruye desde la fuente (el voto).

**Y `acceptSigned` deja de entregar y de leer el standing** (con cola real, el worker
entrega; el que confirma es el evento). El `contentRef` **es** el wire del envelope y el
`signature`/`signedProof` viaja dentro de él — el dominio del Relay no se toca:

```typescript
// src/voting/application/internal/outboundservices/acl/external-relay.service.ts
async acceptSigned(voteId: string, envelopeWire: string): Promise<{ orderId: string }> {
  if (!this.relayCommands) {
    this.logger.warn(`relay unavailable, vote ${voteId} stays QUEUED`);
    throw new Error('RELAY_UNAVAILABLE');
  }
  // El contentRef transporta el envelope firmado; el wire no vacío satisface el
  // UnsignedContentRefusedError del intake. La entrega la hace el worker.
  const contentRef = SignedContentRef.of(envelopeWire);
  const orderId = await this.relayCommands.acceptDeliveryOrder(
    new AcceptDeliveryOrderCommand(contentRef, PayerRef.of(ExternalRelayService.RELAYER_PAYER), envelopeWire));
  this.logger.log(`vote ${voteId} accepted for delivery as ${orderId.value}`);
  return { orderId: orderId.value };
}
```

> El aggregate `Vote` ya sobrescribe la referencia en ambos comandos (`this._reference = ref`
> en `markSent` y en `markConfirmed`, `vote.aggregate.ts:71-80`): no hace falta cambiar el
> dominio para que la referencia provisional de `SENT` se reemplace por la real en `CONFIRMED`.

**Nuevo dato en el Relay**: la referencia de la transacción. El `DeliveryOrder` necesita un sitio para el hash:

```ts
// src/blockchain-relay-transaction-delivery/domain/model/valueobjects/transaction-ref.value-object.ts
export class TransactionRef {
  private constructor(
    public readonly txHash: string,
    public readonly blockNumber: number | null,
    public readonly gasUsed: string | null,
  ) {}
  static of(i: { txHash: string; blockNumber?: number | null; gasUsed?: string | null }): TransactionRef { /* validaciones */ }
}
```

Y en el agregado: `recordSending(ref)` pasa a `recordBroadcast(ref)` (de `ORDERED` a `SENT` guardando la ref) y `recordConfirmation(ref)` (de `SENT` a `CONFIRMED` guardando bloque y gas). Requiere migración de columna (ver Apéndice B).

### 8.8 La cola real (BullMQ)

```ts
// src/blockchain-relay-transaction-delivery/infrastructure/queue/bullmq/bullmq-delivery-queue.ts
import { Queue } from 'bullmq';

@Injectable()
export class BullMqDeliveryQueue implements DeliveryQueueService {
  static readonly TOPIC = 'delivery.send';
  private readonly queue: Queue;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis, private readonly config: ConfigService) {
    this.queue = new Queue(BullMqDeliveryQueue.TOPIC, { connection: { url: this.config.get<string>('relay.redisUrl', '') } });
  }

  async enqueue(orderId: string): Promise<void> {
    await this.queue.add('deliver', { orderId }, {
      jobId: orderId,                      // idempotencia de transporte
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
```

**El worker con `concurrency: 1`**:

```ts
// src/blockchain-relay-transaction-delivery/infrastructure/queue/bullmq/delivery.worker.ts
@Processor(BullMqDeliveryQueue.TOPIC, { concurrency: 1 })
export class DeliveryWorker extends WorkerHost {
  async process(job: Job<{ orderId: string }>): Promise<void> {
    await this.commands.deliverOrder(new DeliverOrderCommand(DeliveryOrderId.of(job.data.orderId)));
  }
}
```

> **`concurrency: 1` no es opcional**: el relayer es **una sola wallet** con **una sola secuencia de nonces**. Procesar dos envíos en paralelo produce `nonce too low` / `replacement transaction underpriced`. Con `concurrency: 1` la secuencia es determinista. Si más adelante hay varias wallets pagadoras, la clave de BullMQ debe incluir el pagador (`delivery.send:<payerRef>`), lo que además materializa el `UNIQUE(payer, position)` del dominio.

> **Reintento de transporte ≠ reintento de dominio**: BullMQ reintenta el job; el agregado decide el efecto (id-most-once por standing). Es la distinción D6 del impl-guide, y no se rompe.

El adaptador en proceso (`InProcessDeliveryQueue`) **se conserva** para dev/test: mismo puerto, `setImmediate` + `EventEmitter2`. Se selecciona con `relay.queueDriver = in-process | bullmq`.

### 8.9 `BalanceFeePolicy` real

```ts
@Injectable()
export class BalanceFeePolicy implements FeePolicy {
  constructor(private readonly provider: JsonRpcProvider, private readonly config: ConfigService) {}

  async canAfford(order: { payerRef: PayerRef }): Promise<boolean> {
    const address = this.config.get<string>('relay.payerAddress', '');
    if (!address) return false;
    const balance = await this.provider.getBalance(address);
    const gasPrice = await this.provider.getFeeData();
    const estimated = BigInt(320_000) * (gasPrice.maxFeePerGas ?? gasPrice.gasPrice ?? 0n);
    return balance >= estimated;
  }
}
```

> Si el saldo no alcanza → `canAfford(false)` → el agregado `abandon(COST_EXHAUSTED)`. **Esa razón ya existe en el dominio**: es exactamente el caso "el votante no puede pagar" que el OQ2 del impl-guide deja abierto. En Amoy el faucet cubre esto; en mainnet, hay que fondear o recargar.

### 8.10 Verificación on-chain (la prueba de recepción)

El cierre de una propuesta produce **1 tx** con la raíz Merkle de los compromisos:

```ts
// src/blockchain-relay-transaction-delivery/infrastructure/ledger/polygon-amoy/merkle-root.ts
import { keccak256, encodePacked } from 'ethers';

/** Raiz Merkle (sha3) de las hojas ordenadas por (voter, commitment). */
export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return '0x' + '0'.repeat(64);
  let level = [...leaves].sort();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(keccak256(encodePacked(['bytes32', 'bytes32'], [left, right])));
    }
    level = next;
  }
  return level[0];
}
```

**La hoja** = `keccak256(abi.encodePacked(proposalId, voter, choiceCommitment, nonce))`. El tercero que quiera auditar:

1. Descarga el `getVotes(proposalId, 0, count)` del contrato.
2. Recalcula las hojas y la raíz.
3. Compara con `proposals(proposalId).merkleRoot`.
4. Tras el revelado, recalcula `H(choice, salt)` y lo compara con el `choiceCommitment` de cada voto.
5. Cuenta los votos revelados por opción y compara con el tally de la base de datos.

**Eso convierte el escrutinio en reproducible sin confiar en el backend.** Es la respuesta concreta a *"escrutinio auditable"* del producto.

### 8.11 CI a $0: cadena local

```yaml
# .github/workflows/ci.yml (extracto)
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Start local chain
        working-directory: contracts
        run: |
          npx hardhat node > /tmp/hardhat.log 2>&1 &
          npx hardhat deploy --network localhost
      - name: Extract ledger address
        run: echo "AMOY_LEDGER_ADDRESS=$(grep -o '0x[a-fA-F0-9]\{40\}' /tmp/deploy.log | head -1)" >> $GITHUB_ENV

      - name: E2E
        env:
          AMOY_RPC_URL: http://127.0.0.1:8545
          AMOY_PAYER_KEY: 0xac0974d3c3b17b2e6b1b1a0a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a
          LEDGER_NETWORK: local
        run: pnpm test:e2e
```

> La wallet de Hardhat por defecto (`0xac09...` con clave conocida) es determinista → **la dirección del contrato desplegado es siempre la misma** en CI. El `AMOY_LEDGER_ADDRESS` se puede fijar como constante y ahorrar el paso de extracción.

El e2e:

```
1. Registrar comunidad + miembro + propuesta (Sprint-01/02 ya lo hacen)
2. Verificar biometría (mock del MATCHING_PORT) -> VERIFIED
3. Pedir autorizacion -> emitir voto -> firma EIP-712 real
4. El relay encola -> el worker envia -> la tx se mina en la cadena local
5. DeliveryConfirmedEvent -> Voting marca CONFIRMED
6. Tally: el voto cuenta (status='CONFIRMED')
7. Cerrar propuesta -> closeProposal(merkleRoot) -> verificar raiz on-chain
```

### 8.12 Tests

| Capa | Qué probar |
|---|---|
| Contrato (Hardhat) | firma válida aceptada · firmante ≠ `msg.sender` → `BadSignature` · segundo voto del mismo votante → `AlreadyVoted` · `choice` fuera de rango → `BadChoice` · voto fuera de ventana → `OutOfWindow` · compromiso → revelado verificado · revealing incorrecto → `BadChoice` |
| Contrato (EIP-712) | el digest calculado por Solidity **coincide** con el de `ethers` (test vector con un dominio y un tipo fijos) — es la prueba de que backend y contrato hablan el mismo idioma |
| Dominio (Voting) | `recovered.equals(voter)` sigue exigiéndose; el envelope se re-deriva y se verifica |
| Dominio (Relay) | `observeOutcome` con `confirmed:false, retryable:false` → `ABANDONED(LEDGER_REJECTED)`; con `retryable:true` → `RETRIED` |
| Infra (gateway) | `buildTx` produce el calldata esperado (comparar contra `iface.encodeFunctionData`) |
| E2E | el ciclo completo contra la cadena local |

**El test vector EIP-712 es obligatorio.** Es el punto donde un desajuste de un byte entre el backend y el contrato hace que **todos los votos fallen en la cadena** sin que nada falle en los tests unitarios.

### 8.13 Costos

| Ítem | Amoy | Mainnet (futuro) |
|---|---|---|
| Gas por voto (`submitVote`) | **$0** (POL de test) | ~$0.005–0.01 |
| Gas por cierre (`closeProposal`) | **$0** | ~$0.005 |
| RPC | $0 (público) | $0 (free tier) o $0.05/10k requests |
| Contrato | $0 (despliegue de testnet) | ~$0.10 (una vez) |
| **Total por propuesta de 50 votos** | **$0** | **~$0.55** |

**Conclusión operativa**: el piloto completo en Amoy es **$0 real**. El salto a mainnet, cuando haga falta, cuesta céntimos por propuesta — y el modo batch (`closeProposal` con raíz Merkle) reduce 50 transacciones a 2.

---

<a name="9-parte-v--custodia-de-llaves"></a>

## 9. Parte V — Custodia de llaves

### 9.1 El estado actual

`HsmSigningPolicyService` **no usa KMS**: deriva la clave localmente con `keccak256("votachain-hsm:" + WALLET_MASTER_SEED + ":" + path)` y firma con `ethers`. El nombre de la clase promete algo que la clase no hace.

### 9.2 Las tres rutas (y cuál cuesta $0)

| Ruta | Costo | Qué es | Cuándo |
|---|---|---|---|
| **A. `memory` (dev/test)** | $0 | Clave determinística derivada de la ruta. **Solo para tests** | `NODE_ENV=test`, CI |
| **B. `hd` + semilla cifrada (prod, gratis)** | $0 | Semilla maestra de 32 bytes, cifrada en reposo con una clave del secreto de la plataforma;derivación BIP-32 en memoria | **Recomendado para el piloto** |
| **C. `hsm` = AWS KMS (prod, compliance)** | **~$1/llave/mes** | La semilla maestra vive cifrada en KMS; el backend la pide, deriva y firma, y la borra | Cuando el presupuesto lo permita o lo exija la auditoría |

### 9.3 Ruta B (gratis) — detalle

```ts
// src/cryptographic-wallet-custody/infrastructure/kms/signing/seeded/seeded-signing-policy.service.ts
@Injectable()
export class SeededSigningPolicyService implements SigningPolicy {
  constructor(private readonly config: ConfigService) {}

  async sign(digest: Buffer, path: string): Promise<string> {
    const seed = this.masterSeed();              // 32 bytes, de un secreto cifrado
    const node = HDNodeWallet.fromSeed(seed).derivePath(path);
    const signature = node.signingKey.sign(getBytes(digest));
    const parsed = Signature.from(signature);
    // La clave privada se descarta con el garbage collector al salir del tick.
    return `${parsed.v}:${parsed.r}:${parsed.s}`;
  }
}
```

> **El nombre de la clase importa**: `HsmSigningPolicyService` que no usa un HSM es una mentira operacional. Si se implementa la ruta C, `HsmSigningPolicyService` debe llamar a KMS de verdad; si no, **renombrarla** a `SeededSigningPolicyService` y dejar `WALLET_SIGNING_POLICY=seeded`.

### 9.4 Ruta C (AWS KMS) — cómo sería de verdad

**Limitación clave que hay que entender antes de prometer nada:**

- **AWS KMS no hace derivación BIP-32.** Una clave KMS es una clave, no un árbol.
- **AWS KMS no devuelve el `v` de recuperación** ECDSA: devuelve la firma en DER. Convertir DER → `(r, s)` es fácil; **calcular el `v` (27/28) no lo hace KMS**. Se resuelve probando `v=27` y `v=28` y quedándose con el que recupera la dirección esperada — el firmante conoce su propia dirección.
- **KMS sí soporta `ECC_SECG_P256K1`** (la curva de Ethereum), pero solo para **una** clave.

**Por eso la ruta C tiene dos variantes:**

| Variante | Qué guarda KMS | Qué firma | Soporta HD |
|---|---|---|---|
| **C1 (recomendada)** | La **semilla maestra** (cifrada) | El backend deriva BIP-32 y firma localmente | **Sí** |
| **C2** | Una clave `ECC_SECG_P256K1` | KMS firma directamente el digest | No (una sola wallet) |

C1 es la que encaja con el modelo de Votachain (una wallet por persona derivada de una semilla). C2 sirve para la **wallet del relayer** (una sola) o para un futuro esquema de umbral.

```ts
// C1: la semilla vive en KMS, el backend la pide, deriva y borra
const decrypt = await kms.send(new DecryptCommand({ CiphertextBlob: encryptedSeed }));
const seed = new Uint8Array(Buffer.from(decrypt.Plaintext));  // 32 bytes
// ... derivar, firmar, y dejar de referenciar `seed`
```

**Costo real de C1**: $1/llave/mes (la clave KMS) + $0.03 por cada 10.000 llamadas `Decrypt`. Para 1.000 votos/mes → **$1.03/mes**. No es gratis, pero es un costo fijo y pequeño.

**Requisito legal/técnico**: en la Ley 29733 y en buena práctica de custodia, la semilla **nunca** debe estar en una variable de entorno en texto plano (`WALLET_MASTER_SEED` lo está hoy). La ruta B con seed cifrado + secreto de plataforma (Fly.io/Render/GitHub Secrets/Vault) cumple sin costo.

### 9.5 Migración de una wallet derivada de `test` a `hd`

Las wallets ya creadas con `WALLET_DERIVATION_STRATEGY=test` usan la ruta `test/{position}` y **no son las mismas** que `m/44'/60'/0'/0/{position}`. Migrar cambia la dirección de todos los wallets existentes.

**Procedimiento seguro:**

1. Registrar la dirección actual de cada wallet (`wallet.wallets`).
2. Cambiar `WALLET_DERIVATION_STRATEGY=hd` y `WALLET_HD_NETWORK=mainnet`.
3. **Rotar** cada wallet: `POST /api/v1/wallets/:id/rotate` (ya existe: `rotate(newPosition) → successor`).
4. El voto firmado con la wallet antigua **sigue siendo verificable** (la firma es válida; solo cambia la dirección del votante). Los votos ya confirmados **no se reescriben** (invariante "las decisiones pasadas nunca se reescriben").

> **Esto solo aplica a una instalación que ya tiene votos reales.** En el piloto, migrar antes del primer voto es gratis.

---

<a name="10-apéndice-a--variables-de-entorno"></a>

## 10. Apéndice A — Variables de entorno

### 10.1 Nuevas

| Variable | Joi | Default | Descripción |
|---|---|---|---|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | `string` | `''` | URL del recurso Document Intelligence |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | `string.allow('')` | `''` | Key de dev (prod: Entra ID) |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL` | `string` | `prebuilt-read` | Modelo de análisis |
| `AZURE_TENANT_ID` | `string.allow('')` | `''` | Entra ID (prod) |
| `AZURE_CLIENT_ID` | `string.allow('')` | `''` | Service principal (prod) |
| `AZURE_CLIENT_SECRET` | `string.allow('')` | `''` | Service principal (prod) |
| `AWS_REGION` | `string` | `us-east-1` | Región de Rekognition y de la colección |
| `AWS_REKOGNITION_COLLECTION_ID` | `string` | `votachain-biometric` | Colección de rostros |
| `EVIDENCE_STORE_DRIVER` | `valid('redis','memory')` | `memory` | Backend del almacén de evidencia |
| `REDIS_URL` | `string.allow('')` | `''` | (ya existe) URL de Redis para evidencia + BullMQ |
| `AMOY_LEDGER_ADDRESS` | `string.allow('')` | `''` | Dirección del contrato desplegado |
| `AMOY_CHAIN_ID` | `number` | `80002` | Chain ID esperado (guardia anti red equivocada) |
| `AMOY_PAYER_ADDRESS` | `string.allow('')` | `''` | Dirección pública del relayer (para el fee policy) |
| `AMOY_CONFIRM_TIMEOUT_MS` | `number` | `60000` | Timeout de minado |
| `QUEUE_DRIVER` | `valid('in-process','bullmq')` | `in-process` | Motor de cola |
| `LEDGER_NETWORK` | `valid('local','amoy','mainnet')` | `amoy` | Red efectiva (informativo + guardas) |

### 10.2 Modificadas

| Variable | Antes | Después |
|---|---|---|
| `OCR_EXECUTOR` | `rekognition \| gdoc-ai` | `azure-document-intelligence \| rekognition \| gdoc-ai` |
| `FACE_MATCHER` | `vendor-a \| vendor-b \| fake` | `rekognition \| vendor-a \| vendor-b \| fake` |
| `FACE_MATCH_THRESHOLD` | `Joi.number()` | `Joi.number().min(0).max(1)` |
| `WALLET_SIGNING_POLICY` | `hsm \| memory` | `hsm \| seeded \| memory` (y renombrar la clase si no hay KMS real) |
| `WALLET_HD_NETWORK` | `mainnet` | `amoy` \| `mainnet` (derivar en la red donde se firma) |

### 10.3 Drift existente a corregir de paso

| Problema | Corrección |
|---|---|
| `OTP_HASHER` está en Joi pero no en `.env.example` | Añadir a `.env.example` |
| `OUTBOX_*` y `VOTING_AUTH_*` están en `.env.example` pero no en Joi | Añadir a Joi (con defaults) |
| `docker-compose.yml` usa `POSTGRES_USER: postgres` / password `matias2oo6`; `.env.example` dice `votachain`/`changeme` | Unificar (el `docker-compose` **no** overridea el `DB_USERNAME` del `.env`) |

---

<a name="11-apéndice-b--migraciones"></a>

## 11. Apéndice B — Migraciones

Estilo del repo: SQL crudo, idempotente (`IF NOT EXISTS`), `down()` exacto inverso.

### 11.1 `ocr` — referencia del retrato (Sprint-05)

```sql
-- 1760000000000-ocr-reference-ref.ts
ALTER TABLE ocr.examinations ADD COLUMN IF NOT EXISTS reference_ref VARCHAR(256) NULL;
```

### 11.2 `biometric` — referencia viva y sesión de liveness (Sprint-06)

```sql
-- 1760000000001-biometric-provider-reference.ts
ALTER TABLE biometric.profiles ADD COLUMN IF NOT EXISTS reference_ref VARCHAR(256) NULL;
ALTER TABLE biometric.profiles ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NULL;
ALTER TABLE biometric.attempts ADD COLUMN IF NOT EXISTS liveness_session_id VARCHAR(128) NULL;

-- Invariante estructural: un perfil ENROLLED SIEMPRE tiene referencia viva.
-- (Si la migracion corre sobre datos existentes, primero backfillear o marcar REVOKED.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_live_profile_has_reference') THEN
    ALTER TABLE biometric.profiles
      ADD CONSTRAINT ck_live_profile_has_reference
      CHECK (standing <> 'ENROLLED' OR reference_ref IS NOT NULL);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_liveness_session
  ON biometric.attempts (liveness_session_id) WHERE liveness_session_id IS NOT NULL;
```

### 11.3 `relay` — referencia de la transacción (Sprint-07)

```sql
-- 1760000000002-relay-transaction-reference.ts
ALTER TABLE relay.orders ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(80) NULL;
ALTER TABLE relay.orders ADD COLUMN IF NOT EXISTS block_number BIGINT NULL;
ALTER TABLE relay.orders ADD COLUMN IF NOT EXISTS gas_used VARCHAR(40) NULL;
ALTER TABLE relay.orders ADD COLUMN IF NOT EXISTS chain_id INT NULL;
```

### 11.4 `voting` — compromiso y sal (Sprint-07)

```sql
-- 1760000000003-vote-commitment.ts
ALTER TABLE voting.votes ADD COLUMN IF NOT EXISTS choice_commitment VARCHAR(80) NULL;
ALTER TABLE voting.votes ADD COLUMN IF NOT EXISTS choice_salt VARCHAR(80) NULL;
ALTER TABLE voting.votes ADD COLUMN IF NOT EXISTS choice_revealed BOOLEAN NOT NULL DEFAULT FALSE;
```

### 11.4 `shared` — nada

No hay columnas para evidencia: **la evidencia vive en Redis y no toca Postgres**. Esta es la diferencia entre este diseño y un bucket de objetos.

---

<a name="12-apéndice-c--checklist-de-release"></a>

## 12. Apéndice C — Checklist de release

### C.1 Coste

- [ ] Azure en tier `F0` y las 500 páginas/mes no se exceden (alerta configurada)
- [ ] AWS con free tier o créditos suficientes; región `us-east-1`
- [ ] `AMOY_PAYER_KEY` con saldo ≥ 1 POL (faucet cada 24 h alcanza)
- [ ] `WALLET_SIGNING_POLICY` = `seeded` o `hsm` (**nunca `memory` en producción**)
- [ ] RPC: un proveedor con cuota, no el RPC público (que puede limitar)
- [ ] Ningún recurso de pago accidental creado (KMS, S3, OpenSearch)

### C.2 Seguridad

- [ ] Credenciales AWS por **IAM role**, no access keys en el entorno
- [ ] Azure por **Entra ID**, no API key en el entorno
- [ ] `AMOY_PAYER_KEY` y la semilla maestra **nunca** en logs, ni en `logger.debug`
- [ ] `.env` en `.gitignore` (ya está) y sin secretos de terceros reales
- [ ] Bucket/colección de AWS con cifrado y región fijada
- [ ] `WEBHOOK`/`AMOY` no exposed en el Swagger público

### C.3 Privacidad (Ley 29733)

- [ ] El texto de consentimiento menciona la **transferencia a terceros** (AWS/Azure) y la región
- [ ] `biometric.profiles.reference_ref` en el inventario de datos personales
- [ ] El erasure borra el `FaceId` en AWS (`DeleteFaces`), no solo la fila local
- [ ] Ninguna imagen en Postgres, en el outbox ni en los eventos
- [ ] Redis con TTL en la evidencia; política de purga verificada (`SCAN` de `ocr:evidence:*`)

### C.4 Blockchain

- [ ] Contrato desplegado en Amoy y `AMOY_LEDGER_ADDRESS` configurado
- [ ] `AMOY_CHAIN_ID=80002` coincide con la red del RPC
- [ ] Test vector EIP-712 backend↔contrato en verde
- [ ] Un voto real llega a `CONFIRMED` con `tx_hash` y `block_number` **reales**
- [ ] El tally solo cuenta `CONFIRMED` (regresión `SIGNED/QUEUED/SENT ≠ tallied`)
- [ ] `closeProposal` con raíz Merkle y verificación externa del raíz

### C.5 Observabilidad

- [ ] Log del `txHash` y el `blockNumber` por voto confirmado
- [ ] Métrica: votos `QUEUED`/`SENT`/`CONFIRMED`/`FAILED` por propuesta
- [ ] Alerta: pedidos en `SENT` más de X minutos (tx minando lento)
- [ ] Alerta: `COST_EXHAUSTED` (relayer sin fondos)

---

<a name="13-apéndice-d--invariantes-que-la-guía-no-rompe"></a>

## 13. Apéndice D — Invariantes que la guía no rompe

Estas son las reglas del proyecto que la integración con vendors **no puede** relajar. Cada una tiene su dónde queda garantizada.

| # | Invariante | Garantía | Verificación |
|---|---|---|---|
| 1 | El dominio no importa SDKs de vendor | `src/**/domain/**` no importa `@azure/*`, `@aws-sdk/*`, `ethers` | `grep -r "@azure\|@aws-sdk" src/*/domain` → vacío |
| 2 | El umbral de match no sale del BC | `MATCHING_PORT` devuelve score; el BC compara | Test "the BC judges the threshold, not the vendor" |
| 3 | El dominio juzga, el vendor ejecuta | `DocumentExamination.record*` es la única autoridad del veredicto | Test de dominio: `recordVerdict` con score bajo → `NOT_VERIFIED` |
| 4 | Ninguna imagen en eventos ni en BD | `DocumentEvidence` es de application; Redis con TTL | `grep -r "Buffer" src/*/domain` → vacío; no hay columna BYTEA de imagen |
| 5 | Sets cerrados: sin strings nuevos | `UnreadableReason` (5), `Verdict` (3), `FailureReason` (5+1) | `@IsIn(Object.values(...))` en los DTOs; parsers sin `as` |
| 6 | El Relay solo transporta, nunca firma | `ExternalRelayService` / `PolygonAmoyGateway` no importan la wallet | El `submitVote` usa la firma del votante; el relayer solo paga |
| 7 | Solo `CONFIRMED` cuenta en el escrutinio | Repositorio + índice parcial `uq_vote_confirmed` | Regresión `SIGNED ≠ tallied` |
| 8 | Reintento de transporte ≠ reintento de dominio | BullMQ re-ejecuta; el agregado decide por standing | Test: `observeOutcome` no crea una segunda orden |
| 9 | Publicar solo después del commit | `publish()` fuera de `uow.run()` | Test: evento no se emite si la tx falla |
| 10 | La firma se olvida en el mismo tick | `signTransient` → `forget()` en `finally` | Test: la clave no se persiste (no hay columna) |
| 11 | `@OnEvent` solo en el módulo emisor | Notificaciones cross-BC por facade | `grep -r "@OnEvent" src/*/application/internal/eventhandlers` → solo eventos propios |
| 12 | Idempotencia de la evidencia | `GETDEL` en Redis | Test: dos `take()` → el segundo `null` |

---

<a name="14-referencias"></a>

## 14. Referencias

**Documentación oficial**

- Azure AI Document Intelligence — pricing: <https://azure.microsoft.com/en-us/pricing/details/document-intelligence/>
- Azure AI Document Intelligence — quotas y límites (F0 vs S0): <https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits>
- Azure AI Document Intelligence — modelo de identidad: <https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/id-document>
- AWS Rekognition — pricing y free tier: <https://aws.amazon.com/rekognition/pricing>
- AWS Rekognition — Face Liveness: <https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness.html>
- AWS Rekognition — Face Liveness APIs: <https://docs.aws.amazon.com/rekognition/latest/dg/face-liveness-calling-apis.html>
- Polygon — RPC endpoints (Amoy): <https://docs.polygon.technology/pos/reference/rpc-endpoints>
- Polygon — faucet: <https://faucet.polygon.technology/>
- EIP-712: <https://eips.ethereum.org/EIPS/eip-712>
- AWS KMS — `ECC_SECG_P256K1`: <https://docs.aws.amazon.com/kms/latest/developerguide/ asymmetric-key-specs.html>

**Paquetes**

| Paquete | Versión consultada |
|---|---|
| `@azure/ai-form-recognizer` | 5.1.0 |
| `@azure/identity` | 4.14.0 |
| `@aws-sdk/client-rekognition` | 3.1158.0 |
| `bullmq` | 6.5.0 |
| `ioredis` | 6.0.0 |
| `ethers` | 6.17.0 (ya en el repo) |

**Documentos internos**

- `docs/Bounded Contexts/context-mapping.md` — R3, R5, R6, R7, R8, R12
- `docs/Bounded Contexts/document-ocr-face-match-provider/impl-guide.md` — §4.2 executor, §9 dependencias
- `docs/Bounded Contexts/biometric-identity-verification/impl-guide.md` — §4.2 matching, auditoría D4
- `docs/Bounded Contexts/blockchain-relay-transaction-delivery/impl-guide.md` — §4.2 RPC Amoy, §4.4 `BaseLedgerGateway`, auditoría D6
- `docs/BrainStorming/VotoChain_Flujo_Biometrico_Wallet_ModeloB.md` — modelo B de wallets
- `docs/FUNCIONALIDADES.md` — P8/P9 (documento), P10/P11 (biometría), P25/P26 (voto y recibo)

**Verificar antes de facturar**: los precios y los free tiers cambian. Este documento registra los valores consultados en **octubre de 2026**.

