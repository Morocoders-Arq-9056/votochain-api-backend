# VotoChain — Flujo de verificación biométrica + wallet por usuario (Modelo B)
### Versión actualizada | Membership + Voting Context | Curso: 1ASI0728 – Arquitecturas de Software Emergentes | NRC 9056

---

## 0. Nota de contexto de esta versión

Este documento reemplaza la propuesta anterior en la que la verificación biométrica se orquestaba mediante un bot **RPA**. Tras evaluar el trade-off, se decidió **mantener la orquestación como llamadas API directas entre servicios** (no RPA), porque tanto el OCR como la comparación facial y liveness corren sobre librerías/SDKs con interfaz programática nativa (`Tesseract.js`, `face-api.js`), sin necesidad de simular interacción humana con una UI. RPA solo se justifica cuando se integra un sistema sin API — ese no es el caso aquí (ver sección 6 para dónde sí aplicaría RPA en VotoChain).

**Alcance de este flujo:** enrollment (una sola vez por usuario) y verificación pre-voto (cada voto individual), integrando la verificación biométrica con el **Modelo B de wallets**: cada usuario obtiene una wallet propia, derivada automáticamente (HD/BIP-32) a partir de una semilla maestra, en vez de que una sola wallet firme por todos.

**Por qué Modelo B y no una sola wallet:** el ADR-001 exige verificación on-chain vía `ecrecover()`, lo cual solo tiene sentido si cada voto está firmado por una clave individual. Una sola wallet firmando todo elimina la verificabilidad real del sistema — el Modelo B es el que sostiene el objetivo de "votación transparente y verificable".

**Relación con el resto del sistema:** este flujo sigue viviendo en el módulo de **Votación**, separado del **IAM** (Auth0 + roles/membresías). La wallet derivada es la identidad criptográfica del usuario *dentro* de la votación, distinta de su identidad de sesión (Auth0) y de su perfil biométrico.

---

## 1. Stack tecnológico

**Fuente principal (MVP / corto plazo):** servicios gestionados de terceros — **AWS Rekognition** (liveness + comparación facial) y **Google Document AI** (OCR de documentos de identidad). Se eligen como fuente principal porque son servicios ya entrenados, certificados y mantenidos por sus proveedores, lo que reduce el riesgo técnico y acelera la entrega dentro del ciclo académico.

**Roadmap in-house (mediano/largo plazo):** desarrollar un servicio propio con **Tesseract.js** (OCR) y **face-api.js** (liveness + comparación facial) como alternativa self-hosted, para reducir costo recurrente y dependencia de terceros una vez validado el modelo de negocio. Ambas rutas comparten la misma interfaz de dominio (`IdentityVerificationPort`), por lo que la migración no debería requerir cambios en `Membership` ni en `Voting`.

| Etapa | Tecnología (fuente principal) | Alternativa in-house (roadmap) | Dónde corre | Costo |
|---|---|---|---|---|
| Captura de cámara | `getUserMedia` (WebRTC, nativo del navegador) | — (se mantiene igual) | Navegador | Gratuito |
| OCR del DNI | **Google Document AI** (Identity Document parser) | Tesseract.js + `mrz` (npm) | Backend (llamada a API de Google) | Pago por uso (Document AI) |
| Parseo y validación de datos extraídos | Incluido en la respuesta estructurada de Document AI | `mrz` (npm) sobre el resultado de Tesseract | Backend | Incluido / Gratuito |
| Liveness (prueba de vida) | **AWS Rekognition** — Face Liveness | `@vladmandic/face-api`, cálculo de Eye Aspect Ratio (EAR) | Backend (llamada a API de AWS) | Pago por uso (Rekognition) |
| Comparación facial | **AWS Rekognition** — `CompareFaces` | `face-api.js` — descriptor de 128 valores + distancia euclidiana | Backend (llamada a API de AWS) | Pago por uso (Rekognition) |
| Autorización temporal de voto | JWT de corta duración (`jsonwebtoken`) | — (se mantiene igual) | Backend (NestJS) | Gratuito |
| **Derivación de wallet por usuario** | `ethers.js` — `HDNodeWallet` (BIP-32) | — (se mantiene igual) | Backend (NestJS) | Gratuito |
| **Protección de la semilla maestra** | KMS / HSM (p. ej. AWS KMS) | — (se mantiene igual) | Infraestructura | Según proveedor |
| **Firma EIP-712 del voto** | `ethers.js` — `signTypedData` con la wallet derivada | — (se mantiene igual) | Backend (NestJS), momento del voto | Gratuito |
| **Envío de la transacción** | `ethers.js` con la wallet relayer, serializado vía cola | — (se mantiene igual) | Worker de blockchain (NestJS) | Gas en Polygon Amoy (relayer) |

> **Nota de diseño:** al mover el OCR y la biometría de navegador a backend (llamadas a AWS/Google), el flujo pasa a depender de que el backend reciba las imágenes (DNI y selfie) vía upload seguro (HTTPS + validación de tamaño/formato) en vez de procesarlas localmente en el cliente. Esto no cambia el principio de "no se almacenan imágenes crudas" (sección 5) — se procesan en memoria/transitoriamente y se descartan tras obtener el resultado de las APIs.

Dos wallets distintas participan en cada voto, con roles que **no deben confundirse**:
- **Wallet del usuario** (derivada, una por persona): firma el mensaje EIP-712. Nunca envía transacciones ni paga gas.
- **Wallet relayer** (una sola, la del ADR-001): envía la transacción a la blockchain y paga el gas. Nunca firma el contenido del voto — solo lo transporta.

---

## 2. Flujo de enrollment (una sola vez por usuario)

Ocurre después de que el usuario ya inició sesión con Auth0 y tiene una `Membership` en al menos una comunidad.

```
1. Captura del DNI (reverso) + envío al backend
       │  getUserMedia (navegador) → backend
       ▼
2. OCR del DNI vía Google Document AI
       │  backend envía la imagen a Document AI, recibe datos estructurados
       │  (nombre, número de documento, fecha de nacimiento, etc.)
       ▼
3. Selfie en vivo + reto de liveness
       │  getUserMedia (navegador) → backend → AWS Rekognition (Face Liveness)
       ▼
4. Comparación facial (selfie vs foto del DNI) vía AWS Rekognition
       │  Rekognition CompareFaces — solo ocurre una vez, en el enrollment
       ▼
5. Asignación de userIndex y derivación de wallet
       │  El backend asigna un índice secuencial único al usuario
       │  y deriva su wallet: m/44'/60'/0'/0/{userIndex}
       │  usando la semilla maestra (protegida en KMS)
       ▼
6. Se guardan BiometricProfile y UserWallet
       │  (descriptor cifrado + dirección pública de la wallet;
       │   la clave privada NUNCA se guarda, se reconstruye al firmar)
```

### Qué se captura vs. qué se guarda

| Dato | ¿Se almacena? |
|---|---|
| Foto del DNI, selfie de enrollment | No — se envían transitoriamente a Document AI / Rekognition vía HTTPS y se descartan tras obtener la respuesta; no se persisten en la base de datos ni en disco de la aplicación |
| Descriptor facial (128 valores, si se usa la ruta in-house) / `FaceId` de Rekognition (si se usa la ruta AWS) | Sí, cifrado — referencia para el match en cada voto |
| `userIndex` (posición en la derivación HD) | Sí — es inofensivo sin la semilla maestra |
| Dirección pública de la wallet derivada | Sí — es la identidad on-chain del usuario, pública por diseño |
| Clave privada de la wallet derivada | **Nunca** — se reconstruye en memoria en el momento de firmar y se descarta |
| Semilla maestra | Nunca en la base de datos de aplicación — vive en KMS/HSM |

```ts
interface BiometricProfile {
  id: string;
  userId: string;
  provider: "aws-rekognition" | "in-house";  // fuente que generó el perfil
  rekognitionFaceId?: string;   // si provider = "aws-rekognition"
  faceDescriptor?: Float32Array; // si provider = "in-house" (face-api.js)
  dniMatchScore: number;
  enrolledAt: Date;
}

interface UserWallet {
  id: string;
  userId: string;
  userIndex: number;        // posición en la ruta de derivación HD
  walletAddress: string;    // dirección pública, ej. 0xAbC123...
  derivedAt: Date;
}
```

```ts
import { HDNodeWallet } from "ethers";

// La semilla maestra se obtiene desde KMS en el momento de derivar, nunca se persiste en texto plano
function getUserWallet(masterSeed: Uint8Array, userIndex: number): HDNodeWallet {
  const masterNode = HDNodeWallet.fromSeed(masterSeed);
  return masterNode.derivePath(`m/44'/60'/0'/0/${userIndex}`);
}
```

---

## 3. Flujo de verificación pre-voto (cada voto individual)

Ocurre cada vez que el usuario intenta emitir un voto sobre un proposal.

```
1. Usuario abre un proposal y decide votar
       ▼
2. Selfie en vivo + reto de liveness
       │  getUserMedia (navegador) → backend → AWS Rekognition (Face Liveness)
       │  timeout: si no se confirma liveness en ~8s, el reto falla
       ▼
3. Comparación facial
       │  backend → AWS Rekognition CompareFaces, contra el
       │  BiometricProfile.rekognitionFaceId guardado en el enrollment
       │  (o contra faceDescriptor si el perfil es de la ruta in-house)
       ▼
4. Emisión del VoteAuthorization (si liveness + match OK)
       │  JWT firmado por el backend, expira en ~2-5 min
       ▼
5. Reconstrucción de la wallet del usuario
       │  getUserWallet(masterSeed, user.userIndex)
       │  la clave privada existe solo en memoria, brevemente
       ▼
6. Firma EIP-712 del voto (server-side, con la wallet del usuario)
       │  wallet.signTypedData(domain, types, { proposalId, choice, ... })
       ▼
7. Se encola la transacción para el worker de blockchain
       │  el job incluye: firma, dirección del usuario, datos del voto
       ▼
8. El worker (wallet relayer) envía la transacción al contrato
       │  el contrato valida con ecrecover() que la firma corresponde
       │  a la dirección del usuario, y registra el voto
       ▼
9. El VoteAuthorization se marca como usado (evita replay)
```

```ts
interface VoteAuthorization {
  userId: string;
  proposalId: string;
  issuedAt: Date;
  expiresAt: Date;
  used: boolean;
}
```

### Por qué la firma ocurre en el backend y no en el navegador

Como el Modelo B es custodio (el usuario no maneja su propia clave), la firma EIP-712 se genera server-side, inmediatamente después de superar el reto biométrico — nunca antes. Esto evita exponer la clave derivada al cliente y mantiene la garantía de que solo un voto verificado biométricamente puede producir una firma válida para ese `proposalId`.

### Separación de responsabilidades en la transacción

| Quién | Qué hace | Qué NO hace |
|---|---|---|
| Wallet del usuario (derivada) | Firma el contenido del voto (EIP-712) | No envía transacciones, no paga gas, no tiene nonce relevante en Polygon |
| Wallet relayer | Envía la transacción, paga el gas | No decide ni firma el contenido del voto |
| Cola (BullMQ + Redis) | Serializa el envío de transacciones del relayer, evitando colisiones de nonce | No participa en la verificación biométrica ni en la firma del usuario |

---

## 4. Por qué este flujo se implementa como orquestación API (y no RPA)

| Criterio | Orquestación API (este documento) | RPA (descartado para este flujo) |
|---|---|---|
| Disponibilidad de interfaz programática | AWS Rekognition y Google Document AI son servicios gestionados con SDK/API REST oficiales (`aws-sdk` / `@google-cloud/documentai`); `ethers.js` también expone funciones directas. La alternativa in-house (`Tesseract.js`, `face-api.js`) también es 100% programática | Tendría sentido solo si el OCR/biometría fueran un portal web o app sin API |
| Velocidad | Llamadas de función/HTTP directas, sin simular UI | Más lento, depende de renderizado y esperas de UI |
| Confiabilidad | Contratos de función estables, testeables con mocks | Frágil ante cambios de interfaz visual |
| Costo | Sin licencias adicionales — es código propio del backend | Requeriría plataforma RPA (UiPath, Automation Anywhere, etc.) |
| Coherencia arquitectónica | Se integra naturalmente al `IdentityVerificationPort` (ACL) ya definido para Membership | Añadiría una capa de orquestación externa innecesaria |

La decisión se mantiene consistente con el patrón **Port-Adapter** ya usado en el proyecto: el dominio (`Membership`, `Voting`) invoca interfaces (`IdentityVerificationPort`, `VotingLedgerPort`) sin conocer el detalle de implementación, sea esta una librería local, un SDK externo o un contrato inteligente.

---

## 5. Consideraciones de seguridad y privacidad

- La semilla maestra es el secreto más crítico del sistema: su compromiso permitiría reconstruir la wallet de cualquier usuario. Debe vivir en un KMS/HSM, nunca en variables de entorno planas ni en la base de datos de aplicación.
- Ninguna imagen (DNI, selfies) se almacena en ningún punto del flujo — solo el descriptor facial cifrado y la dirección pública de la wallet.
- El `userIndex` y la dirección de la wallet son datos públicos por diseño (la wallet vive on-chain), pero no permiten, por sí solos, reconstruir la clave privada sin la semilla maestra.
- Aplican las mismas consideraciones de la Ley N.° 29733 (Perú) sobre datos biométricos ya documentadas para el enrollment: consentimiento explícito, minimización de datos, y derecho de eliminación (que en este flujo implica revocar el `BiometricProfile` y desactivar el `userIndex`, no eliminar la wallet on-chain, que es inmutable por naturaleza).
- **Transferencia a terceros:** al usar AWS Rekognition y Google Document AI como fuente principal, las imágenes (DNI y selfie) se transmiten transitoriamente a infraestructura de AWS/Google para su procesamiento. Esto debe declararse explícitamente en el consentimiento del usuario, junto con la región de procesamiento configurada (recomendable fijar una región compatible, ej. `us-east-1` para Rekognition, y revisar la política de retención de cada servicio — ambos permiten configurar que no se conserven las imágenes del lado del proveedor tras el procesamiento).
- El roadmap in-house (Tesseract.js + face-api.js) elimina esta dependencia de terceros y la transferencia internacional de datos, siendo una motivación adicional (no solo de costo) para la migración a mediano plazo.

---

## 6. Dónde sí aplicaría RPA en VotoChain

Para no perder el requisito del sílabo (RPA como tecnología clave de la Unidad 2), el caso de uso legítimo dentro de VotoChain no es este flujo, sino la integración con sistemas **sin API**, típicamente usados hoy por juntas de propietarios/cooperativas:

- **Conciliación con el registro contable interno de la comunidad** (Excel o software contable legado sin API): un bot RPA leería ese sistema periódicamente para detectar propietarios morosos y sincronizar su estado con el Padrón, evitando que voten si la comunidad define esa regla de negocio.

Este caso queda documentado como extensión futura, separado de este flujo de biometría + wallet, que se mantiene 100% orquestado por API.

---

## 7. Relación con ADRs

Este documento actualiza la base técnica de:
- **ADR-001** (modelo de wallet): debe documentarse una adenda que reemplaza "una sola wallet relayer firma y paga" por "wallet por usuario derivada (HD/BIP-32) firma; wallet relayer solo paga y envía".
- **ADR-004** (verificación biométrica): confirma que la orquestación es vía API (no RPA), y establece que el `VoteAuthorization` es el gatillo que habilita la reconstrucción y firma de la wallet del usuario, no solo un permiso administrativo.
- **ADR-005** (nuevo, sugerido): "RPA solo se aplica a integración con sistemas legados sin API (conciliación contable), no al flujo de biometría/wallet."
