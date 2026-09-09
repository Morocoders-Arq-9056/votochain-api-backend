## Glottia Platform API — Spring Boot | DDD | CQRS | Monolito Modular

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
 glottia.platform.api/
 └──  src/main/java/com/hampcoders/glottia/platform/api/verification/
      ├──  application/
      │   ├──  acl/
      │   │   └── VerificationContextFacadeImpl.java
      │   └──  internal/
      │       ├──  commandservices/
      │       │   └── VerificationCommandServiceImpl.java
      │       ├──  eventhandlers/
      │       │   └── VerificationEventLogger.java
      │       ├──  outboundservices/
      │       │   ├── CodeHashingService.java               # Port (outbound)
      │       │   └── OtpNotificationService.java            # Port (outbound)
      │       └──  queryservices/
      │           └── VerificationQueryServiceImpl.java
      ├──  domain/
      │   ├──  model/
      │   │   ├──  aggregates/
      │   │   │   └── Verification.java                       # Aggregate Root
      │   │   ├──  valueobjects/
      │   │   │   ├── VerificationId.java
      │   │   │   ├── VerificationPurpose.java                # enum
      │   │   │   └── OtpCode.java
      │   │   ├──  commands/
      │   │   │   ├── GenerateOtpCommand.java
      │   │   │   └── VerifyOtpCommand.java
      │   │   ├──  queries/
      │   │   │   ├── GetLatestVerificationByUserIdAndPurposeQuery.java
      │   │   │   └── ExistsActiveVerificationByUserIdAndPurposeQuery.java
      │   │   ├──  events/
      │   │   │   ├── OtpGeneratedEvent.java                  # cross-BC -> Notifications
      │   │   │   └── OtpVerifiedEvent.java                   # cross-BC -> consumer BC
      │   │   └──  exceptions/
      │   │       └── OtpVerificationException.java
      │   └──  services/
      │       ├── VerificationCommandService.java             # Interface
      │       └── VerificationQueryService.java               # Interface
      ├──  infrastructure/
      │   ├──  persistence/
      │   │   └──  jpa/
      │   │       └──  repositories/
      │   │           └── VerificationRepository.java
      │   └──  services/
      │       ├── HmacCodeHashingService.java                 # Adapter (HMAC-SHA256)
      │       └── OtpNotificationServiceImpl.java             # Adapter (Notifications BC)
      └──  interfaces/
          ├──  acl/
          │   ├── VerificationContextFacade.java              # ACL publicada
          │   └── VerificationResult.java                     # Resultado tipado
          └──  rest/
              ├── VerificationController.java
              ├──  resources/
              │   ├── GenerateOtpResource.java
              │   ├── VerifyOtpResource.java
              │   ├── VerificationResource.java
              │   └── OtpGeneratedResource.java
              └──  transform/
                  ├──  fromentity/
                  │   └── VerificationResourceFromEntityAssembler.java
                  └──  fromresource/
                      ├── GenerateOtpCommandFromResourceAssembler.java
                      └── VerifyOtpCommandFromResourceAssembler.java
```

---

<a name="domain"></a>

## 2. Domain Layer

---

### 2.1 Aggregate Root: `Verification`

**Ubicacion:** `domain/model/aggregates/Verification.java`

**Responsabilidad:** Gestiona el ciclo de vida de un codigo OTP: generacion, validacion con limite de intentos, expiracion y desactivacion. Representa un desafio de verificacion para un usuario y proposito especifico.

**Invariantes principales:**
- El codigo se almacena hasheado (BCrypt), nunca en texto plano.
- Cada verificacion tiene un numero maximo de intentos (`maxAttempts`, default 5).
- La verificacion expira despues de un tiempo configurable (`expiresAt`).
- Una vez verificada o desactivada, no puede reutilizarse.

#### Propiedades

```java
@Entity
@Table(name = "verifications")
public class Verification extends AuditableAbstractAggregateRoot<Verification> {

    @EmbeddedId
    private VerificationId id;

    private String userId;

    @Enumerated(EnumType.STRING)
    private VerificationPurpose purpose;  // CHECK_IN, EMAIL_VERIFY, PASSWORD_RESET

    private String codeHash;              // HMAC-SHA256 hash

    private LocalDateTime expiresAt;

    private int attempts;

    private int maxAttempts;

    private LocalDateTime verifiedAt;

    private boolean isActive;

    @Version
    private Long version;                 // Optimistic locking
}
```

**Comportamiento principal:**

| Metodo | Descripcion |
|:--|:--|
| `validate(rawCode, codeMatcher)` | Valida el codigo contra el hash. Incrementa intentos. Si expiro o excedio intentos -> desactiva. Si valido -> marca `verifiedAt`, publica `OtpVerifiedEvent`. |
| `isExpired()` | `now > expiresAt` |
| `isMaxAttemptsReached()` | `attempts >= maxAttempts` |
| `isUsable()` | `isActive && !expired && !maxAttempts && !verified` |

---

### 2.2 Value Objects

| Value Object | Tipo | Descripcion |
|:--|:--|:--|
| `VerificationId` | `@Embeddable record` | Envuelve `String value` con prefijo `ver-`. Generado via `VerificationId.newVerificationId()`. Validacion: no nulo ni vacio. |
| `VerificationPurpose` | `enum` | Propositos soportados: `CHECK_IN`, `EMAIL_VERIFY`, `PASSWORD_RESET`. |
| `OtpCode` | `record` | Codigo OTP de N digitos (default 6). Generado via `OtpCode.generate(length)`. Inmutable. Longitud valida: 4-10 digitos. Usa `SecureRandom`. |

```java
@Embeddable
public record VerificationId(@Column(name = "id") @JsonProperty("id") String value) implements Serializable {
    public VerificationId {
        if (value == null || value.isBlank())
            throw new IllegalArgumentException("VerificationId must not be null or blank");
    }
    public static VerificationId newVerificationId() {
        return new VerificationId("ver-" + UUID.randomUUID());
    }
}

public enum VerificationPurpose {
    CHECK_IN,
    EMAIL_VERIFY,
    PASSWORD_RESET
}

public record OtpCode(String code, int length) {
    private static final SecureRandom RANDOM = new SecureRandom();
    public OtpCode {
        if (code == null || code.isBlank()) throw new IllegalArgumentException(...);
        if (length < 4 || length > 10) throw new IllegalArgumentException(...);
        if (code.length() != length) throw new IllegalArgumentException(...);
    }
    public static OtpCode generate() { return generate(6); }
    public static OtpCode generate(int length) { /* random digits via SecureRandom */ }
}
```

---

### 2.3 Commands (CQRS -- Write)

**Ubicacion:** `domain/model/commands/`

```java
public record GenerateOtpCommand(String userId, VerificationPurpose purpose, String channel) {}

public record VerifyOtpCommand(String userId, VerificationPurpose purpose, String code) {}
```

### 2.4 Queries (CQRS -- Read)

**Ubicacion:** `domain/model/queries/`

```java
public record GetLatestVerificationByUserIdAndPurposeQuery(Long userId, VerificationPurpose purpose) {}

public record ExistsActiveVerificationByUserIdAndPurposeQuery(Long userId, VerificationPurpose purpose) {}
```

Ambos query records incluyen validacion en compact constructor (`userId != null`, `purpose != null`), siguiendo la convencion de los BCs Profiles, Encounters y Subscriptions.

### 2.5 Domain Exceptions

**Ubicacion:** `domain/model/exceptions/OtpVerificationException.java`

Excepcion especifica para errores de verificacion OTP. Extiende `IllegalArgumentException` para mantener compatibilidad con el manejo de errores HTTP de Spring (400 Bad Request).

```java
public class OtpVerificationException extends RuntimeException {
    public OtpVerificationException(String message) { super(message); }
}
```

### 2.6 Domain Events

**Ubicacion:** `domain/model/events/`

| Evento | Cuando se publica | Consumidor principal |
|:--|:--|:--|
| `OtpGeneratedEvent` | Al generar un nuevo OTP | **Notifications BC** (envia el codigo al usuario via email) |
| `OtpVerifiedEvent` | Al validar exitosamente un OTP | **BC consumidor** (ej. Encounters BC procede con check-in) |

```java
public record OtpGeneratedEvent(
    String verificationId, String userId, VerificationPurpose purpose,
    LocalDateTime expiresAt
) implements DomainEvent {}

public record OtpVerifiedEvent(
    String verificationId, String userId, VerificationPurpose purpose,
    LocalDateTime verifiedAt
) implements DomainEvent {}
```

> **Nota:** `OtpGeneratedEvent` ya **no** transporta el `plainCode`. La entrega del codigo al usuario se realiza sincronicamente via `OtpNotificationService` (ver seccion 4.3). El codigo **nunca** se persiste en texto plano -- solo se almacena el hash. El evento se mantiene para observabilidad y para que BCs consumidores puedan reaccionar.

### 2.7 Domain Services (Interfaces)

**Ubicacion:** `domain/services/`

```java
public interface VerificationCommandService {
    Verification handle(GenerateOtpCommand command);
    Verification handle(VerifyOtpCommand command);
}

public interface VerificationQueryService {
    Optional<Verification> handle(GetLatestVerificationByUserIdAndPurposeQuery query);
    boolean handle(ExistsActiveVerificationByUserIdAndPurposeQuery query);
}
```

> **Nota:** Los query services usan objetos Query record como parametros (sobrecarga de `handle`), siguiendo el mismo patron CQRS que los command services. Esto es consistente con los BCs Subscriptions, Encounters y Learning Feedback.

### 2.8 Patrones evidenciados (Domain)

- **Aggregate Root:** `Verification`.
- **Value Objects:** `VerificationId`, `OtpCode`, `VerificationPurpose` (enum).
- **Commands:** `GenerateOtpCommand`, `VerifyOtpCommand`.
- **Queries:** `GetLatestVerificationByUserIdAndPurposeQuery`, `ExistsActiveVerificationByUserIdAndPurposeQuery`.
- **Domain Events:** `OtpGeneratedEvent`, `OtpVerifiedEvent`.
- **Domain Service Interfaces:** `VerificationCommandService`, `VerificationQueryService`.

---

<a name="application"></a>

## 3. Application Layer

---

### 3.1 Command Services

**Ubicacion:** `application/internal/commandservices/VerificationCommandServiceImpl.java`

**Dependencias:** `VerificationRepository`, `CodeHashingService`, `OtpNotificationService`, `ApplicationEventPublisher`

| Metodo `handle` | Responsabilidad |
|:--|:--|
| `GenerateOtpCommand` | Genera OTP aleatorio de N digitos, lo hashea con HMAC-SHA256, crea y persiste el aggregate `Verification`, publica `OtpGeneratedEvent` (sin plainCode), y entrega el codigo al usuario via `OtpNotificationService` (port que consume `NotificationsContextFacade`). Soporta canal de entrega (`channel`: SMS, EMAIL, PUSH) definido en el comando. |
| `VerifyOtpCommand` | Busca el `Verification` activo mas reciente para el usuario+proposito, ejecuta `validate()` con el codigo proporcionado. Si invalido -> lanza `OtpVerificationException`. Maneja `OptimisticLockingFailureException` para prevenir condiciones de carrera en verificaciones concurrentes. |

**Anotaciones:** `@Service`, `@Transactional` (org.springframework.transaction.annotation).

**Configuracion via `application.properties`:**

| Propiedad | Default | Descripcion |
|:--|:--|:--|
| `verification.otp.length` | `6` | Longitud del codigo OTP |
| `verification.otp.expiration-minutes` | `5` | Minutos hasta expiracion |
| `verification.otp.max-attempts` | `5` | Intentos maximos antes de desactivar |
| `verification.otp.hmac-secret` | — | Clave secreta para HMAC-SHA256 (requerido) |

### 3.2 Query Services

**Ubicacion:** `application/internal/queryservices/VerificationQueryServiceImpl.java`

**Anotaciones:** `@Service`, `@Transactional(readOnly = true)`.

| Query Object | Descripcion |
|:--|:--|
| `GetLatestVerificationByUserIdAndPurposeQuery` | Retorna la verificacion activa mas reciente para un usuario y proposito. |
| `ExistsActiveVerificationByUserIdAndPurposeQuery` | Verifica si existe alguna verificacion activa para un usuario y proposito. |

### 3.3 Outbound Services (Ports)

**Ubicacion:** `application/internal/outboundservices/`

#### CodeHashingService

Puerto de salida para el hashing de codigos OTP.

```java
public interface CodeHashingService {
    String hash(String rawCode);
    boolean matches(String rawCode, String hash);
}
```

#### OtpNotificationService

Puerto de salida para la entrega del codigo OTP al usuario. Reemplaza el mecanismo de entrega via eventos (el codigo en texto plano ya no viaja en `OtpGeneratedEvent`). Soporta entrega multicanal (SMS, EMAIL, PUSH) segun el `channel` especificado.

```java
public interface OtpNotificationService {
    void sendOtp(String userId, String plainCode, VerificationPurpose purpose, String channel);
}
```

> **Nota:** Si `channel` es `null` o vacio, se entrega por todos los canales disponibles (SMS, EMAIL, PUSH). Si se especifica uno o varios canales (separados por coma), solo se entrega por esos canales.

### 3.4 Event Handlers

**Ubicacion:** `application/internal/eventhandlers/VerificationEventLogger.java`

Manejador interno de eventos de dominio para observabilidad. Escucha `OtpGeneratedEvent` y `OtpVerifiedEvent` despues del commit de la transaccion (`@TransactionalEventListener(AFTER_COMMIT)`) y registra en log los detalles.

### 3.5 ACL Facade (Application)

**Ubicacion:** `application/acl/VerificationContextFacadeImpl.java`

Implementa `VerificationContextFacade` (definida en Interfaces) para exponer capacidades de este BC a otros BCs.

| Metodo expuesto | Consumidor conocido | Descripcion |
|:--|:--|:--|
| `generateOtp(userId, purpose)` | Encounters BC, IAM BC | Genera un OTP con `channel=null` (todos los canales) y retorna el ID de verificacion. |
| `verifyOtp(userId, purpose, code)` | Encounters BC, IAM BC | Valida un OTP. Retorna `VerificationResult` con estado tipado (`VERIFIED`, `NOT_FOUND`, `EXPIRED`, `MAX_ATTEMPTS_REACHED`, `INVALID_CODE`). |
| `existsActiveOtp(userId, purpose)` | Cualquier BC | Consulta si hay un OTP activo sin validarlo. |

---

<a name="infrastructure"></a>

## 4. Infrastructure Layer

---

### 4.1 Persistencia (Spring Data JPA)

**Ubicacion:** `infrastructure/persistence/jpa/repositories/VerificationRepository.java`

| Repositorio | Entidad principal | Metodos clave |
|:--|:--|:--|
| `VerificationRepository` | `Verification` | `findTopByUserIdAndPurposeAndIsActiveTrueOrderByCreatedAtDesc(...)`, `existsByUserIdAndPurposeAndIsActiveTrue(...)` |

### 4.2 Code Hashing (Port & Adapter)

**Puerto:** `application/internal/outboundservices/CodeHashingService.java`
**Adaptador:** `infrastructure/services/HmacCodeHashingService.java`

```java
@Service
public class HmacCodeHashingService implements CodeHashingService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final SecretKeySpec secretKey;

    public HmacCodeHashingService(@Value("${verification.otp.hmac-secret}") String hmacSecret) {
        this.secretKey = new SecretKeySpec(hmacSecret.getBytes(), HMAC_ALGORITHM);
    }

    public String hash(String rawCode) {
        var mac = Mac.getInstance(HMAC_ALGORITHM);
        mac.init(secretKey);
        return HexFormat.of().formatHex(mac.doFinal(rawCode.getBytes()));
    }

    public boolean matches(String rawCode, String hash) {
        return hash.equals(hash(rawCode));
    }
}
```

**Decision de diseno:** Se eligio HMAC-SHA256 en lugar de BCrypt porque:
- Los OTPs tienen expiracion corta (5 min) e intentos limitados (5 max).
- HMAC-SHA256 es deterministico (mismo input -> mismo hash), lo que permite busqueda directa sin necesidad de comparar contra todos los registros.
- BCrypt agrega complejidad intencional (salt + costo) innecesaria para OTPs con生命周期 corto.
- La clave secreta (`verification.otp.hmac-secret`) debe protegerse como secreto de aplicacion.

### 4.3 Notifications Adapter

**Puerto:** `application/internal/outboundservices/OtpNotificationService.java`
**Adaptador:** `infrastructure/services/OtpNotificationServiceImpl.java`

```java
@Service
public class OtpNotificationServiceImpl implements OtpNotificationService {

    private final NotificationsContextFacade notificationsContextFacade;

    public void sendOtp(String userId, String plainCode, VerificationPurpose purpose, String channel) {
        var variables = Map.of("code", plainCode);
        var referenceId = purpose.name() + "_" + System.currentTimeMillis();
        // Si no se especifica canal, se envia por todos
        // Si se especifica, se envia solo por los canales indicados (SMS, EMAIL, PUSH)
        ...
    }
}
```

**Decision de diseno:** Verification BC consume `NotificationsContextFacade` de Notifications BC sincronicamente para entregar el codigo OTP al usuario. Esto reemplaza el enfoque anterior donde el codigo viajaba en `OtpGeneratedEvent`. Ventajas:
- El codigo en texto plano nunca cruza el bus de eventos (mas seguro).
- Entrega inmediata sin depender de procesamiento asincrono.
- Control explicito sobre que canales de entrega usar.
- **Trade-off:** Verification deja de ser un BC hoja (ahora depende de Notifications BC).

---

<a name="interfaces"></a>

## 5. Interfaces Layer

---

### 5.1 REST Controller

**Ubicacion:** `interfaces/rest/VerificationController.java`

El controller usa `CurrentUserProvider` del shared kernel para obtener el usuario autenticado, desacoplandose de `UserDetailsImpl` (IAM infrastructure). La validacion de request bodies se realiza via Bean Validation (`@Valid` + constraints `jakarta.validation`).

#### Endpoints

| Metodo HTTP | Endpoint | Descripcion |
|:--|:--|:--|
| `POST` | `/api/v1/verificationss/otp` | Generar un nuevo codigo OTP (`GenerateOtpCommand`). Requiere autenticacion JWT. |
| `POST` | `/api/v1/verificationss/otp/verify` | Validar un codigo OTP (`VerifyOtpCommand`). Requiere autenticacion JWT. |

> **Anotaciones adicionales:** El controller usa `@RateLimiter(name = "otpGenerator")` de Resilience4j en `generateOtp()` para mitigar abusos. Tambien incluye anotaciones OpenAPI/Swagger (`@Tag`, `@Operation`, `@ApiResponses`).

**Nota sobre RESTful compliance:** El endpoint `POST /otp/verify` sigue un estilo RPC (accion sobre un recurso). Es aceptable en arquitecturas CQRS donde los commands representan intenciones de escritura. Una alternativa mas RESTful seria `POST /otp/{verificationId}/verifications` modelando la verificacion como sub-recurso, pero esto requeriria que el cliente conozca el `verificationId` y cambiaria el contrato de la API.

**Request/Response:**

```
POST /api/v1/verificationss/otp
Request:  { "purpose": "CHECK_IN", "channel": "SMS,EMAIL" }
Response: 201 Created
          Location: /api/v1/verificationss/otp/ver-xxx
          Body: { "verificationId": "ver-xxx", "expiresAt": "2026-06-01T22:00:00" }

POST /api/v1/verificationss/otp/verify
Request:  { "purpose": "CHECK_IN", "code": "482913" }
Response: 200 { "id": "ver-xxx", "userId": "usr-uuid", "purpose": "CHECK_IN",
                "isVerified": true, "isExpired": false,
                "remainingAttempts": 4, "expiresAt": "...", "verifiedAt": "..." }
```

### 5.2 ACL Interface

**Ubicacion:** `interfaces/acl/VerificationContextFacade.java`

```java
public interface VerificationContextFacade {
    String generateOtp(Long userId, VerificationPurpose purpose);
    VerificationResult verifyOtp(Long userId, VerificationPurpose purpose, String code);
    boolean existsActiveOtp(Long userId, VerificationPurpose purpose);
}
```

**`VerificationResult`** -- `interfaces/acl/VerificationResult.java`:

```java
public record VerificationResult(boolean verified, String message) {
    public static VerificationResult success() { ... }
    public static VerificationResult notFound() { ... }
    public static VerificationResult invalidCode(String message) { ... }
    public static VerificationResult expired() { ... }
    public static VerificationResult maxAttemptsReached() { ... }
}
```

### 5.3 Resources (Request / Response)

```java
public record GenerateOtpResource(@NotNull VerificationPurpose purpose, String channel) {}

public record VerifyOtpResource(@NotNull VerificationPurpose purpose, @NotBlank String code) {}

public record VerificationResource(
    String id, String userId, VerificationPurpose purpose,
    boolean isVerified, boolean isExpired, int remainingAttempts,
    LocalDateTime expiresAt, LocalDateTime verifiedAt
) {}

public record OtpGeneratedResource(String verificationId, LocalDateTime expiresAt) {}
```

### 5.4 Assemblers

| Assembler | Direccion | Descripcion |
|:--|:--|:--|
| `GenerateOtpCommandFromResourceAssembler` | Resource -> Command | Convierte `GenerateOtpResource` + `userId` en `GenerateOtpCommand`. |
| `VerifyOtpCommandFromResourceAssembler` | Resource -> Command | Convierte `VerifyOtpResource` + `userId` en `VerifyOtpCommand`. |
| `VerificationResourceFromEntityAssembler` | Entity -> Resource | Convierte `Verification` en `VerificationResource`. |

---

<a name="database"></a>

## 6. Esquema de Base de Datos

**Schema (por convencion):** `public` (misma instancia PostgreSQL, tabla `verifications`)

### Tabla: `verifications`

| Columna | Tipo | Restricciones | Descripcion |
|:--|:--|:--|:--|
| `id` | `VARCHAR(255)` | `PK` | Identificador con prefijo `ver-`. |
| `user_id` | `VARCHAR(50)` | `NOT NULL` | FK logica al usuario en IAM BC. |
| `purpose` | `VARCHAR(30)` | `NOT NULL` | Proposito del OTP (`CHECK_IN`, `EMAIL_VERIFY`, `PASSWORD_RESET`). |
| `code_hash` | `VARCHAR(255)` | `NOT NULL` | Hash BCrypt del codigo OTP. |
| `expires_at` | `TIMESTAMP` | `NOT NULL` | Fecha y hora de expiracion. |
| `attempts` | `INT` | `NOT NULL, DEFAULT 0` | Numero de intentos realizados. |
| `max_attempts` | `INT` | `NOT NULL` | Numero maximo de intentos permitidos. |
| `verified_at` | `TIMESTAMP` | `NULL` | Fecha y hora de verificacion exitosa. |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Indicador de actividad (se desactiva al expirar, verificar o exceder intentos). |
| `created_at` | `TIMESTAMP` | `NOT NULL` | Timestamp de auditoria (heredado). |
| `updated_at` | `TIMESTAMP` | `NOT NULL` | Timestamp de auditoria (heredado). |

---

<a name="flujos"></a>

## 7. Flujos CQRS por Caso de Uso

### 7.1 Generar OTP

```
VerificationController.generateOtp(@Valid GenerateOtpResource)
  -> CurrentUserProvider.get() -> AuthenticatedUser
      -> userId = principal.userId()
  -> GenerateOtpCommandFromResourceAssembler.toCommandFromResource(resource, userId)
      -> GenerateOtpCommand(userId, purpose, channel)   // channel opcional
  -> VerificationCommandServiceImpl.handle(GenerateOtpCommand)  [@Transactional]
      -> OtpCode.generate(otpLength)                    // 6 digitos aleatorios
      -> codeHashingService.hash(plainCode)              // HMAC-SHA256
      -> new Verification(id, userId, purpose, hash, expiresAt, maxAttempts)
      -> VerificationRepository.save(verification)
      -> ApplicationEventPublisher.publishEvent(OtpGeneratedEvent)  // sin plainCode
      -> otpNotificationService.sendOtp(userId, plainCode, purpose, channel)
         | [sync via ACL]
         | NotificationsContextFacade.sendNotification() entrega el codigo
         | por SMS, EMAIL y/o PUSH segun el channel especificado
  -> 201 Created + Location header + OtpGeneratedResource
```

### 7.2 Verificar OTP

```
VerificationController.verifyOtp(@Valid VerifyOtpResource)
  -> CurrentUserProvider.get() -> AuthenticatedUser
      -> userId = principal.userId()
  -> VerifyOtpCommandFromResourceAssembler.toCommandFromResource(resource, userId)
      -> VerifyOtpCommand(userId, purpose, code)
  -> VerificationCommandServiceImpl.handle(VerifyOtpCommand)  [@Transactional]
      -> VerificationRepository.findTopByUserIdAndPurposeAndIsActiveTrue...
      -> verification.validate(code, codeHashingService::matches)
          -> Incrementa attempts
          -> Si expiro -> desactiva -> return failure
          -> Si max attempts -> desactiva -> return failure
          -> Si code no coincide -> return failure
          -> Si code coincide -> verifiedAt = now, isActive = false
          -> registerEvent(OtpVerifiedEvent)
      -> VerificationRepository.save(verification)
         | [catch OptimisticLockingFailureException -> lanza OtpVerificationException]
         | [auto-publish via AbstractAggregateRoot]
         | BC consumidor recibe OtpVerifiedEvent
  -> VerificationResource 200 OK
```

### 7.3 Consulta de Verificacion Activa (via ACL)

```
Consumidor BC (ej. EncountersCommandServiceImpl)
  -> VerificationContextFacade.existsActiveOtp(userId, purpose)
      -> VerificationContextFacadeImpl
          -> new ExistsActiveVerificationByUserIdAndPurposeQuery(userId, purpose)
          -> VerificationQueryServiceImpl.handle(query)  [@Transactional(readOnly = true)]
              -> VerificationRepository.existsByUserIdAndPurposeAndIsActiveTrue(...)
          -> return boolean
```

---

<a name="integracion"></a>

## 8. Integracion con otros BCs

### 8.1 Encounters BC -- Check-in via OTP

**Rol:** Encounters es consumidor de Verification BC via ACL sincrona.

**Flujo de check-in con OTP:**

```
Encounters BC                          Verification BC                    Notifications BC
    |                                        |                                   |
    |-- generateOtp(userId, CHECK_IN) ------>|                                   |
    |<------ verificationId -----------------|                                   |
    |                                        |-- OtpNotificationService.sendOtp ->|
    |                                        |   (sync, entrega OTP por canales)  |
    |                                        |                                   |
    |  (usuario ingresa codigo OTP)          |                                   |
    |                                        |                                   |
    |-- verifyOtp(userId, CHECK_IN, code) -->|                                   |
    |<------ VerificationResult -------------|                                   |
    |                                        |-- OtpVerifiedEvent (evento) ----->|
    |                                        |                                   |
    |  (si verified -> proceed check-in)     |                                   |
```

**Mecanismo:** `VerificationContextFacade` inyectada en `EncounterCommandServiceImpl` para:
- Generar OTP al iniciar flujo de check-in.
- Validar OTP antes de proceder con el check-in.

**Entrega del codigo:** Verification BC entrega el codigo OTP directamente via `OtpNotificationService` (adaptador que consume `NotificationsContextFacade`). La entrega es sincrona y puede ser multicanal (SMS, EMAIL, PUSH).

### 8.2 Notifications BC -- Outbound (ACL Consumida)

**Mecanismo:** Verification BC **consume** `NotificationsContextFacade` de Notifications BC para enviar el codigo OTP al usuario. Ya no se usa el evento para transportar el codigo:

- `CHECK_IN` -> Notificacion con codigo OTP (SMS, EMAIL, PUSH segun channel).
- `EMAIL_VERIFY` -> Notificacion con codigo de verificacion.
- `PASSWORD_RESET` -> Notificacion con codigo de recuperacion.

`OtpGeneratedEvent` se mantiene pero **sin** `plainCode`, unicamente para observabilidad y reaccion de BCs consumidores.

### 8.3 IAM BC -- Futuro

**Mecanismo:** `VerificationContextFacade` podria ser consumida por IAM BC para:
- Verificacion de email durante el registro (`EMAIL_VERIFY`).
- Confirmacion de cambio de contrasena (`PASSWORD_RESET`).

---

<a name="dependencias"></a>

## 9. Dependencias Externas

### 9.1 Dependencias Sincronicas (ACL)

| Direccion | Tipo | Detalle | Estado |
|:--|:--|:--|:--|
| **Verification -> Shared Kernel** | Legitima | `AuditableAbstractAggregateRoot`, `DomainEvent`, `CurrentUserProvider`, `AuthenticatedUser` | OK |
| **Verification -> Notifications BC** | ACL consumida | `VerificationCommandServiceImpl` -> `OtpNotificationService` (port) -> `OtpNotificationServiceImpl` (adapter) -> `NotificationsContextFacade` | Intencional (entrega sincrona del OTP) |
| **VerificationContextFacade** | ACL publicada | Interfaz en `interfaces/acl/` con implementacion en `application/acl/` | Preparada para consumidores (Encounters BC, IAM BC) |

**Consumo de ACL de otros BCs:** Verification consume **NotificationsContextFacade** de Notifications BC para la entrega de codigos OTP. Esto es intencional: se prefiere entrega sincrona para evitar que el codigo en texto plano cruce el bus de eventos. Verification **ya no es un BC hoja**.

### 9.2 Dependencias Asincronas (Events)

| Evento | Direccion | Estado |
|:--|:--|:--|
| `OtpGeneratedEvent` | Interno + Notifications BC | Consumido por `VerificationEventLogger` (logging) y destinado a Notifications BC (entrega de codigo por email). |
| `OtpVerifiedEvent` | Interno + BCs consumidores | Consumido por `VerificationEventLogger` (logging) y destinado a Encounters BC (proceder con check-in). |

### 9.3 Dependencia de Infraestructura Externa

| Dependencia | Puerto | Adaptador | Estado |
|:--|:--|:--|:--|
| HMAC-SHA256 Hashing | `CodeHashingService` (puerto en `application/internal/outboundservices/`) | `HmacCodeHashingService` (en `infrastructure/services/`) | **Correcto** -- Sigue el patron Port & Adapter. Usa `javax.crypto.Mac` del JDK sin dependencias externas. |
| Notifications | `OtpNotificationService` (puerto en `application/internal/outboundservices/`) | `OtpNotificationServiceImpl` (en `infrastructure/services/`) | **Correcto** -- Adaptador que consume `NotificationsContextFacade` de Notifications BC via ACL. |

### 9.4 Diagrama de Dependencias

```
 +---------------------------------------------------------------------+
 |  Verification BC                                                      |
 |                                                                       |
 |  +-------------------------------------------------------------+     |
 |  |  Application Layer                                           |     |
 |  |  +-------------------+  +-------------------+                |     |
 |  |  |CommandServiceImpl |  |QueryServiceImpl   |                |     |
 |  |  +--------+----------+  +--------+----------+                |     |
 |  |           |                      |                            |     |
 |  |  +--------v----------+  +-------v-----------+                |     |
 |  |  |CodeHashingService |  |VerificationRepo   |                |     |
 |  |  |(outbound port)    |  |(direct injection) |                |     |
 |  |  +-------------------+  +-------------------+                |     |
 |  |                                                               |     |
 |  |  +-----------------------+  +---------------------------+    |     |
 |  |  |OtpNotificationService |  |VerificationContextFacade  |    |     |
 |  |  |(outbound port)        |  |Impl (ACL)                |    |     |
 |  |  +-----------------------+  +---------------------------+    |     |
 |  +---------------------------------------------------------------+    |
 |                      |                               |                  |
 |  +-------------------v-------------------------------v----------------+ |
 |  |  Infrastructure Layer                                               | |
 |  |  +---------------------+  +---------------------------+            | |
 |  |  |HmacCodeHashing      |  |VerificationRepository     |            | |
 |  |  |Service (adapter)    |  |(JPA, Spring Data)         |            | |
 |  |  +---------------------+  +---------------------------+            | |
 |  |  +----------------------------------+                             | |
 |  |  |OtpNotificationServiceImpl        |                             | |
 |  |  |(adapter -> NotificationsContext  |                             | |
 |  |  | Facade)                          |                             | |
 |  |  +----------------------------------+                             | |
 |  +-------------------------------------------------------------------+ |
 |                                                                        |
 |  +-------------------------------------------------------------------+ |
 |  |  Interfaces Layer                                                   | |
 |  |  +----------------------+  +----------------------------+          | |
 |  |  |VerificationController|  |VerificationContextFacade   |          | |
 |  |  |  (CurrentUserProvider|  |(interfaces/acl/)           |          | |
 |  |  |   from shared)       |  +----------------------------+          | |
 |  |  +----------------------+                                          | |
 |  +-------------------------------------------------------------------+ |
 +------------------------------------------------------------------------+
       |               |                       |
       v               v                       v
Shared Kernel    Encounters BC           Notifications BC
- CurrentUser    (via ACL facade)        (via ACL consumida)
  Provider       IAM BC (futuro)         - OtpGeneratedEvent
- Auditable...                           (observabilidad)
- DomainEvent
```

---

<a name="auditoria"></a>

## 10. Auditoria y Correcciones Aplicadas

### 10.1 Hallazgos y Correcciones

| # | Severidad | Hallazgo | Correccion Aplicada |
|:--|:--|:--|:--|
| 1 | **Alta** | `VerificationController` importaba `UserDetailsImpl` desde `iam.infrastructure.authorization.sfs.model`, acoplando la capa de interfaces de Verification a infraestructura de IAM. | Reemplazado por `CurrentUserProvider.get()` del shared kernel, que retorna `AuthenticatedUser`. Elimina la dependencia cross-BC en la capa de interfaces. |
| 2 | **Media** | No existian objetos Query record en `domain/model/queries/`. Los metodos del query service recibian parametros sueltos (`Long userId, VerificationPurpose purpose`), inconsistente con el patron CQRS documentado. | Creados `GetLatestVerificationByUserIdAndPurposeQuery` y `ExistsActiveVerificationByUserIdAndPurposeQuery` en `domain/model/queries/`. Actualizados servicios para usar query objects. |
| 3 | **Media** | `VerificationCommandServiceImpl` usaba `@Transactional` de `jakarta.transaction` en lugar de `org.springframework.transaction.annotation.Transactional`. | Cambiado a `org.springframework.transaction.annotation.Transactional`. |
| 4 | **Media** | Faltaba `@Valid` en los request bodies del controller. | Agregadas anotaciones Bean Validation y `@Valid` en `@RequestBody`. |
| 5 | **Baja** | Response `201 Created` sin header `Location` en `generateOtp()`. | Agregado header `Location` via `ServletUriComponentsBuilder`. |
| 6 | **Informativo** | `POST /otp/verify` es RPC-style. | Documentado como decision de diseno aceptable para CQRS. |
| 7 | **Informativo** | `VerificationContextFacade` sin consumidores activos. | Documentado como preparado para integracion futura con Encounters BC e IAM BC. |
| 8 | **Media** | `OtpGeneratedEvent` transportaba `plainCode` en el evento, exponiendo el codigo en texto plano en el bus de eventos intra-proceso. | Eliminado `plainCode` del evento. La entrega del codigo ahora se realiza via `OtpNotificationService` (sync ACL -> Notifications BC). El evento se mantiene solo para observabilidad. |
| 9 | **Media** | Se usaba BCrypt para hashear OTPs, que es deterministicamente lento y genera distintos hashes para el mismo input, lo que impide busqueda directa por hash. | Reemplazado por HMAC-SHA256. HMAC es deterministico y mas rapido, adecuado para OTPs con expiracion corta (5 min) e intentos limitados (5). |
| 10 | **Media** | `userId` era `Long`, inconsistente con el cambio a IDs alfanumericos en IAM BC. | Cambiado a `String` en todo el BC: `Verification.userId`, commands, queries, resources, y columna `user_id` en base de datos. |
| 11 | **Media** | No existia `OtpNotificationService` para entrega de codigos. La unica via era el evento de dominio. | Creado port `OtpNotificationService` en `application/internal/outboundservices/` y adaptador `OtpNotificationServiceImpl` que consume `NotificationsContextFacade`. |
| 12 | **Baja** | `GenerateOtpCommand` y `GenerateOtpResource` no soportaban seleccion de canal de entrega. | Agregado campo `channel` (String, opcional) para especificar SMS, EMAIL, PUSH. |
| 13 | **Baja** | `Verification` no tenia control de concurrencia. | Agregado `@Version Long version` para optimistic locking. `VerificationCommandServiceImpl` maneja `OptimisticLockingFailureException`. |
| 14 | **Informativo** | Controller sin proteccion contra abusos en generacion de OTP. | Agregado `@RateLimiter(name = "otpGenerator")` de Resilience4j. |

### 10.2 Estado Post-Correccion

- **Aislamiento de BC:** El controller ya no depende de infraestructura de IAM. Usa `CurrentUserProvider` del shared kernel.
- **CQRS completo:** Commands y Queries siguen el mismo patron con query objects.
- **Validacion HTTP:** Los errores de validacion producen `400 Bad Request` via Bean Validation.
- **Hashing OTP:** HMAC-SHA256 reemplaza a BCrypt. Deterministico, rapido y sin dependencias externas.
- **Entrega de codigo segura:** El codigo OTP en texto plano no cruza el bus de eventos. Se entrega sincronicamente via `OtpNotificationService` -> `NotificationsContextFacade`.
- **Soporte multicanal:** Campo `channel` en `GenerateOtpResource` permite seleccionar canales de entrega (SMS, EMAIL, PUSH).
- **Control de concurrencia:** `@Version` para optimistic locking + manejo de `OptimisticLockingFailureException`.
- **Rate limiting:** `@RateLimiter` en generacion de OTP para mitigar abusos.
- **`userId` como String:** Consistente con el identificador alfanumerico de IAM BC.
- **Preparado para microservicio:** Las dependencias estan claramente delimitadas. El BC puede extraerse como servicio independiente con minimos cambios:
  - Reemplazar `ApplicationEventPublisher` por un message broker (RabbitMQ/Kafka).
  - Migrar `OtpNotificationService` de llamada sincrona a envio asincrono via cola.
  - Exponer `VerificationContextFacade` como API REST interna o gRPC.

### 10.3 Decisiones de Diseno Registradas

1. **`POST /otp/verify` (RPC-style):** Se mantiene por pragmatismo. Es un command en CQRS, no una operacion CRUD. Cambiar a `POST /otp/{verificationId}/verifications` requeriria modificar el contrato con el cliente Flutter y la ACL facade.

2. **`userId` como String:** El controller usa `principal.userId()` del `AuthenticatedUser` que retorna un String. Esto es consistente con el cambio a identificadores alfanumericos en IAM BC.

3. **HMAC-SHA256 en lugar de BCrypt:** Se eligio HMAC-SHA256 porque es deterministico (mismo input -> mismo hash), lo que permite busqueda directa. BCrypt es intencionalmente lento para contrasenas, pero los OTPs tienen expiracion corta (5 min) e intentos limitados (5 max).

4. **`OtpNotificationService` para entrega de codigo:** El codigo en texto plano se entrega sincronicamente via ACL en lugar de via evento de dominio. Esto elimina el riesgo de que el `plainCode` quede expuesto en el bus de eventos. **Trade-off:** Verification BC ahora depende de Notifications BC (ya no es un BC hoja).

5. **Eventos de dominio sin `plainCode`:** `OtpGeneratedEvent` ya no transporta el codigo. Se mantiene unicamente para observabilidad (`VerificationEventLogger`) y para que BCs consumidores puedan reaccionar a la generacion de un OTP sin conocer el codigo.

6. **Canal de entrega opcional (`channel`):** El campo `channel` en `GenerateOtpResource` permite al cliente especificar por que canales recibir el codigo. Si no se especifica, se entrega por todos los canales disponibles. Esto da flexibilidad al frontend sin cambiar la logica de dominio.

---

## Supuestos declarados

1. **HMAC-SHA256 para OTP:** Se usa HMAC-SHA256 en lugar de BCrypt para hashear codigos OTP. HMAC es deterministico (mismo input -> mismo hash), lo que permite busqueda directa por hash. BCrypt es innecesariamente lento para OTPs con expiracion corta (5 min) e intentos limitados (5 max). La clave secreta (`verification.otp.hmac-secret`) debe protegerse y rotarse periodicamente.

2. **Entrega de codigo via `OtpNotificationService` (sync ACL):** El codigo en texto plano se entrega al usuario sincronicamente a traves de `OtpNotificationService`, que consume `NotificationsContextFacade` de Notifications BC. Esto es intencional para:
   - Evitar que el `plainCode` cruce el bus de eventos.
   - Tener control explicito sobre los canales de entrega (SMS, EMAIL, PUSH).
   - Obtener entrega inmediata sin depender de procesamiento asincrono.
   - **Precaucion para microservicio:** Si se migra a microservicios, esta llamada sincrona deberia migrarse a un mecanismo asincrono (cola de mensajes) para evitar acoplamiento temporal.

3. **Sin Redis / TTL:** La expiracion se maneja por validacion en la capa de dominio (`expiresAt`), no por TTL de Redis. Consistente con la decision de "Sin Redis en MVP" del Overview.

4. **`VerificationPurpose` extensible:** Nuevos propositos se agregan al enum sin cambiar la estructura del aggregate. Cada consumidor define su propia logica al recibir `OtpVerifiedEvent`.

5. **Event handler interno solo para log:** `VerificationEventLogger` usa `@TransactionalEventListener(AFTER_COMMIT)` sin `@Async` porque solo registra en log. Los consumidores reales reaccionan via ACL sincrona (Notifications BC) o eventos de dominio (Encounters BC). Si en el futuro se necesita logica asincrona dentro del BC, se debe agregar `@Async("verificationTaskExecutor")` con un executor configurado.

---

## Propiedades de configuracion

```properties
verification.otp.length=${OTP_LENGTH:6}
verification.otp.expiration-minutes=${OTP_EXPIRATION_MINUTES:5}
verification.otp.max-attempts=${OTP_MAX_ATTEMPTS:5}
verification.otp.hmac-secret=${OTP_HMAC_SECRET}         # Requerido -- sin default
```
