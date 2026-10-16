# Votachain — Documento de Funcionalidades para Diseño UI

> Fuente de verdad: `docs/Bounded Contexts/**/use-case.md` (11 contextos) + `context-mapping.md`.
> Audiencia: negocio / diseño. Idioma: español. Uso previsto: input para Figma AI para generar pantallas y flujos.

## 1. Qué es el producto

Votachain es una plataforma de votación verificable para comunidades (juntas, asociaciones, condominios).

Garantiza:

- **Una persona = un voto**: solo miembros activos con identidad verificada pueden votar.
- **Identidad doble**: prueba documental + prueba de persona viva (biometría) + posesión de canal (código por correo).
- **Voto firmado y registrado en blockchain**: la firma se autoriza explícitamente y el envío se audita paso a paso.
- **Escrutinio auditable**: solo cuentan los votos confirmados en blockchain.
- **Privacidad y cumplimiento (Ley 29733 - Perú)**: permisos por finalidad y derecho al borrado con trazabilidad completa.

**Principio clave para UI:** distinguir siempre **intención** (lo que el usuario quiso votar) de **hecho confirmado** (lo que blockchain confirmó). Solo lo confirmado cuenta en el escrutinio.

## 2. Roles (personas)

| Rol | Descripción | Accede a |
|-----|-------------|----------|
| **Votante / Miembro** | Persona con membresía en una comunidad | Su perfil, verificación, votaciones, su recibo de voto, permisos |
| **Fundador** | Crea la comunidad inicial | Registro de comunidad |
| **Admin Comunidad** | Gestiona comunidad, miembros, propuestas | Panel admin, miembros, propuestas, escrutinio |
| **Admin Cumplimiento** | Gestiona privacidad y borrado de datos | Permisos, solicitudes de borrado, políticas de retención |
| **Admin Sistema** | Gestiona accesos y roles globales | Usuarios, roles, suspensiones |
| **Sistema (automático)** | Envío a blockchain, correos, expiraciones | No tiene UI, solo se refleja como estados |

## 3. Mapa de módulos (9 grupos UI)

Derivados de los 11 Bounded Contexts, agrupados para no duplicar pantallas:

1. **Acceso y Cuenta** — registro, login, sesión, email, roles.
2. **Verificación por Código (OTP)** — probar posesión del correo/canal.
3. **Onboarding de Identidad (Documento + Biometría)** — probar documento y persona viva.
4. **Comunidades** — crear, activar, suspender, política de votación, administradores.
5. **Membresías** — padrón, morosidad, suspensión.
6. **Votaciones (Core)** — propuestas, autorización, emitir voto, escrutinio, recibo.
7. **Firma y Envío (sin menú propio)** — modal de autorizar firma + timeline de envío a blockchain.
8. **Notificaciones** — correos automáticos e historial.
9. **Privacidad y Consentimiento** — permisos y derecho al borrado.

---

## 4. Módulo 1: Acceso y Cuenta

**Objetivo:** crear identidad técnica, iniciar/cerrar sesión, gestionar correo y roles. Juzga standing, nunca ejecuta pruebas directamente.

### Historias de usuario

- Como visitante quiero registrarme con mi correo para crear mi cuenta.
- Como usuario quiero iniciar sesión para entrar a la plataforma.
- Como usuario quiero cambiar mi correo y verificarlo para mantener mi cuenta al día.
- Como usuario quiero cambiar mi contraseña y ver que se cierran mis sesiones por seguridad.
- Como usuario quiero vincular/desvincular Google u otra identidad externa para entrar más fácil.
- Como admin quiero suspender / rehabilitar accesos y dar/quitar rol Administrador.

### Pantallas requeridas

**P1. Registro**

- Campos: correo electrónico, aceptar Términos + Política (checkbox obligatorio).
- Botón: Crear cuenta.
- Validaciones: correo único y bien formado. Error: "Este correo ya está registrado".
- Éxito: ir a Verificar correo (OTP). Enviar correo de bienvenida.

**P2. Inicio de sesión**

- Campos: usuario/correo + prueba (contraseña o botón identidad externa).
- Si hay sesión abierta en otro dispositivo: aviso "Se cerrará la sesión anterior".
- Errores:
  - Cuenta suspendida → pantalla bloqueada con motivo + contacto soporte.
  - Prueba fallida → "No pudimos verificarte, intentos restantes: X".
- Tras N fallos seguidos: bloqueo temporal / suspensión.

**P3. Verificar correo (reutiliza OTP)**

- Input código 6 dígitos, temporizador (ej. 5 min), intentos restantes (ej. 5), botón Reenviar (invalida el anterior).
- Éxito: insignia "Correo verificado". Fracaso agotado: "Código invalidado, solicita uno nuevo".

**P4. Mi cuenta / Seguridad**

- Ver: estado (Registrado / Activo / Suspendido), correo + insignia verificado/no verificado, roles, historial de accesos.
- Acciones: Cambiar contraseña, Cambiar correo, Vincular/desvincular identidad externa, Cerrar sesión.

**P5. Administración de usuarios (solo Admin Sistema)**

- Tabla: persona, correo, estado, roles, última actividad. Filtros por estado/rol, búsqueda.
- Acciones por fila: Dar rol, Quitar rol, Suspender (pide motivo), Rehabilitar.

---

## 5. Módulo 2: Verificación por Código (OTP)

**Objetivo:** probar que la persona posee el canal (puede leer lo enviado allí). No prueba identidad física.
**Propósitos cerrados:** login, verificación de correo, recuperación de contraseña. Solo esos 3.

### Historias

- Como usuario quiero recibir un código en mi correo para confirmar que es mío.
- Como usuario quiero reintentar si me equivoco, con límite de intentos y vigencia.

### Pantallas

**P6. Solicitar código**

- Automática al registrarse, loguearse o recuperar contraseña.
- Mostrar: "Te enviamos un código a ***@correo.com".
- Si el usuario retiró permiso de contacto → mostrar "No podemos contactarte, revisa tu privacidad" y no enviar.

**P7. Ingresar código (componente reutilizable)**

- Caja de código, contador de intentos, cuenta regresiva de vigencia, botón Reenviar.
- Estados: Abierto / Confirmado (éxito, un solo uso) / Fallido (intento contado, muestra restantes) / Invalidado por intentos agotados / Expirado por tiempo.
- Regla: un código confirmado nunca se reutiliza. Un reenvío invalida el anterior.

---

## 6. Módulo 3: Onboarding de Identidad (Documento + Biometría)

**Objetivo:**
(A) Juzgar evidencia documental una sola vez: Coincide / No coincide / Ilegible.
(B) Probar persona viva y compararla con su referencia. Veredicto binario + vigencia corta.

### Historias

- Como nuevo miembro quiero subir mi documento y tomarme una foto para validar mi identidad.
- Como votante quiero pasar prueba de vida justo antes de votar para que me autoricen.
- Como usuario quiero reintentar si mi documento salió borroso o cortado.
- Como usuario quiero saber si tengo referencia activa y si estoy verificado ahora.

### Pantallas

**P8. Subir documento**

- Pre-condición visible: "Debes pertenecer a al menos 1 comunidad y aceptar tratamiento de datos".
- Campos: tipo documento (DNI / CE / Pasaporte), foto anverso, foto reverso, selfie.
- Botón: Enviar a revisión.
- Si no pertenece a ninguna comunidad → error bloqueante "Sin membresía elegible".
- Si no hay permiso → error "Debes aceptar el tratamiento de datos".

**P9. Resultado de revisión documental**

- Estados:
  - En revisión (spinner + "Estamos leyendo tu documento").
  - Coincide (verde, habilita crear referencia biométrica, se consume una sola vez).
  - No coincide (rojo, explica que no genera referencia, botón Solicitar nueva revisión).
  - Ilegible (amarillo, motivo cerrado: borrosa / reflejo / recortada / vencida / tipo incorrecto + guía para retomar foto + botón Reintentar).
  - Expirada (gris, botón Reintentar).
- Historial: lista de intentos previos por documento (fecha, resultado).

**P10. Crear referencia biométrica (enrolamiento)**

- Solo si documento = Coincide + permiso vigente.
- Flujo guiado: centrar rostro, seguir instrucciones en pantalla.
- Éxito: "Referencia creada". Error sin permiso: "Debes aceptar tratamiento biométrico".

**P11. Prueba de vida pre-voto**

- Paso obligatorio antes de autorizar voto.
- Flujo: 1) Aceptar tratamiento → 2) Prueba de vida (mirar / parpadear / mover) → 3) Comparación automática → 4) Veredicto.
- Resultados: Verificado (fresco, habilita voto) / No verificado (con motivo) / Expirado (repetir).
- Nota UI: "Esta verificación caduca rápido por seguridad, hazla justo antes de votar".
- Nunca mostrar imágenes capturadas a otros roles; solo el veredicto.

**P12. Mi verificación**

- Muestra: ¿tengo referencia activa? ¿estoy verificado ahora? motivo y vigencia, historial de intentos.

---

## 7. Módulo 4: Comunidades

**Objetivo:** gobernar una comunidad: datos, estado, política de votación, administradores. No contiene lista de miembros (eso vive en Membresías).

### Historias

- Como fundador quiero registrar mi comunidad con nombre, domicilio y contacto.
- Como admin quiero definir la regla de votación (umbral, base, mayoría) que aplica solo a futuras votaciones.
- Como admin quiero suspender / reactivar / archivar comunidad con motivo.
- Como admin quiero nombrar / quitar administradores.

### Pantallas

**P13. Registrar comunidad**

- Campos: nombre, domicilio (departamento / provincia / distrito), datos de contacto.
- Éxito: estado Registrada. Siguiente paso sugerido: Definir política + Nombrar admin → Activar.

**P14. Ficha de comunidad + Estado**

- Encabezado: nombre, insignia de estado (Registrada / Activa / Suspendida / Archivada), contacto.
- Si Suspendida: banner "No se aceptan nuevos miembros ni nuevas votaciones" + motivo.
- Si Archivada: banner terminal "Solo lectura, no se puede modificar".
- Acciones según estado: Activar, Editar datos, Suspender (pide motivo), Reactivar, Archivar (pide motivo + doble confirmación).

**P15. Política de votación**

- Formulario: umbral (ej. 50%+1), base (miembros / unidades), regla de mayoría.
- Aviso importante: "Los cambios solo aplican a futuras votaciones. Las abiertas conservan su regla congelada".
- Historial de versiones: lista con fecha, quién, valores. Solo lectura, nunca se edita el pasado.

**P16. Administradores**

- Tabla: persona, desde cuándo. Botones: Nombrar (busca persona existente por correo/ID), Quitar (confirmación).
- Validación: solo personas existentes pueden ser admin.

---

## 8. Módulo 5: Membresías

**Objetivo:** juzgar pertenencia del par (persona, comunidad). Solo Activa puede votar. La mora refleja los libros de la asociación, no se inventa aquí.

### Historias

- Como persona quiero solicitar unirme a una comunidad.
- Como admin quiero activar, asignar unidad/rol, marcar mora, suspender, rehabilitar, terminar.
- Como admin quiero ver el padrón de solo activos para quórum.

### Pantallas

**P17. Solicitar unirse**

- Selector de comunidad + botón Solicitar. Requiere comunidad Activa.
- Estado inicial: Solicitada. Mensaje: "Pendiente de aprobación del admin".

**P18. Padrón (tabla admin)**

- Columnas: miembro, unidad (ej. Dpto 302), rol comunidad, estado (Solicitada / Activa / Morosa / Suspendida / Terminada), mora, acciones.
- Filtros: estado, unidad, búsqueda por nombre. Contador: "X miembros activos".
- Solo Activos cuentan para quórum y aparecen en padrón oficial.

**P19. Detalle de miembro**

- Datos: persona, comunidad, unidad, rol, estado con timeline, historial (activaciones, mora, suspensiones).
- Acciones: Activar, Asignar unidad, Asignar rol, Marcar moroso (pide motivo), Levantar mora, Suspender (motivo), Rehabilitar, Terminar (terminal, motivo + confirmación).
- Si Terminada: insignia terminal, sin acciones salvo ver historial.

**P20. Mis membresías (vista votante)**

- Tarjetas por comunidad: nombre, estado, unidad, ¿puedo votar? (Sí / No + motivo: moroso / suspendido / no miembro / comunidad suspendida).

---

## 9. Módulo 6: Votaciones (Core)

**Objetivo:** convertir intención real en hecho en blockchain. Solo Confirmado cuenta para escrutinio. Orquesta: autorización → firma → envío → confirmación → escrutinio.

### Historias

- Como admin quiero crear propuesta con opciones, abrirla (congela regla), cerrarla y escrutarla.
- Como votante quiero pedir autorización (chequea elegibilidad + biometría fresca), votar, firmar y ver mi recibo.
- Como todos quiero ver resultados con quórum alcanzado / no alcanzado.

### Pantallas

**P21. Lista de propuestas por comunidad**

- Filtros: Borrador / Abierta / Cerrada / Escrutada.
- Tarjeta: título, estado, fechas apertura/cierre, participación %, insignia quórum.
- Botón admin: Nueva propuesta.

**P22. Crear propuesta (borrador)**

- Campos: comunidad (fija), título, descripción, opciones (mínimo 2, ej. Sí / No / Abstención o lista), fechas previstas.
- Guardar → estado Borrador. No visible a votantes aún.

**P23. Detalle de propuesta**

- Encabezado de estado + regla congelada visible: "Regla aplicada: 50%+1 sobre miembros activos al abrir (12/02/2026)".
- Si Borrador (admin): botón Abrir (congela regla actual) + Editar.
- Si Abierta (votante elegible): botón Pedir autorización para votar.
- Si Cerrada: aviso "Cerrada, pendiente de escrutinio".
- Si Escrutada: resultados (ver P27).

**P24. Pedir autorización (pre-voto)**

- Checklist automático visible:
  1. ¿Membresía activa? Sí / No (motivo).
  2. ¿Verificación biométrica fresca? Sí / No → si No, botón Ir a prueba de vida.
- Resultado: Autorizada (código de un solo uso, corta vigencia + botón Votar ahora) / Denegada (motivo claro: no miembro / moroso / suspendido / no verificado) / Expirada (botón pedir de nuevo).
- La autorización congela elegibilidad + veredicto en ese instante; cambios posteriores no la reescriben.

**P25. Emitir voto (pantalla crítica)**

- Muestra opciones tipo radio, resumen: propuesta, votante, autorización válida hasta HH:MM.
- Botón: Firmar y votar.
- Modal firma: "Autorizas firmar este contenido de voto. La firma se olvida inmediatamente". Botones Firmar / Cancelar. Nunca pedir ni mostrar claves.
- Validaciones: autorización válida + propuesta abierta + opción dentro de lista. Doble voto bloqueado: "Ya usaste esta autorización".
- Éxito inmediato: recibo Firmado (no confundir con confirmado). Mensaje: "Tu voto firmado está en cola de envío, aún no cuenta".
- Errores: autorización expirada/consumida, propuesta cerrada ("Voto tardío rechazado"), firma rechazada (wallet no disponible).

**P26. Mi recibo de voto (tracking)**

- Timeline 5 pasos: Firmado → En cola → Enviado → Confirmado en blockchain / Fallido.
- Si Confirmado (verde): hash/transacción, fecha, "Ya cuenta en escrutinio".
- Si Fallido/Abandonado (rojo): motivo (rechazado por red / costo agotado / límite de reintentos) + qué hacer (contactar soporte, no re-votar con la misma autorización consumida).
- Botón Ver en explorador blockchain (link externo).

**P27. Cierre y escrutinio**

- Admin: botón Cerrar propuesta (cuando vence o manual).
- Automático tras cierre: conteo por opción, participación, veredicto quórum: Alcanzado / No alcanzado.
- Tabla resultados + barra %. Nota: "Solo votos Confirmados cuentan".
- Historial auditoría: autorizaciones, votos firmados vs confirmados.

---

## 10. Módulo 7: Firma y Envío (detalles para Figma, sin menú propio)

No lleva pantallas de menú. Solo dos componentes embebidos en Votaciones:

- **Modal Firmar:** título, contenido a firmar resumido (propuesta + opción, sin tecnicismos), advertencia de seguridad, botones Firmar / Cancelar.
- **Estados de envío para timeline P26:** Aceptado, En cola por pagador, Enviado, Confirmado (terminal éxito), Fallido reintentable (reintento automático acotado), Abandonado (terminal fracaso con motivo).
- Reglas: solo se firma contenido ya armado por Votaciones; solo se envía contenido ya firmado; nunca se reescribe. Si wallet suspendida/retirada: error "No puedes firmar ahora, contacta soporte".

---

## 11. Módulo 8: Notificaciones

**Objetivo:** contar a una persona una cosa por correo. Todos los módulos la usan, ella no depende de nadie. Envío real ejecutado fuera.

Plantillas a diseñar:

- Bienvenida, Código OTP, Verificación de correo, Cambio de seguridad, Comunidad suspendida/reactivada, Membresía activada / morosa / suspendida / rehabilitada, Propuesta abierta / cerrada, Recibo voto (firmado / enviado / confirmado / fallido), Resultado escrutinio, Privacidad (borrado solicitado / completado).

**P28. Historial de notificaciones (admin / soporte)**

- Tabla: fecha, destinatario (correo, no ID interno), plantilla, estado (Solicitada / Rechazada por duplicada o sin permiso / Confirmada entregada / Fallida + reintentos), motivo.
- Reglas: nunca duplicar (clave de idempotencia), si usuario retiró permiso → registrar Rechazada sin envío silencioso, reintento solo desde Fallida, nunca tras Confirmada.

El usuario final no necesita bandeja propia en MVP; recibe correos. Opcional fase 2: centro de notificaciones in-app espejando este historial.

---

## 12. Módulo 9: Privacidad y Consentimiento (Ley 29733)

**Objetivo:** gestionar permisos y coordinar borrado. No borra datos ajenos, coordina a cada dueño (Biometría, Wallet, Membresía, Notificaciones, etc.) y deja auditoría inmutable.

### Historias

- Como usuario quiero dar/quitar permiso por finalidad (biometría, contacto correo, análisis documental).
- Como usuario quiero pedir que borren mis datos y ver en qué va.
- Como admin de cumplimiento quiero definir retención, confirmar borrados y ver auditoría.

### Pantallas

**P29. Mis permisos**

- Lista de interruptores por finalidad: Tratamiento biométrico, Contacto por correo, Análisis documental. Cada uno: estado (Permitido / Retirado), versión de política, desde cuándo.
- Al retirar: aviso "Deja de aplicar desde ahora, no borra lo pasado" + consecuencia (ej. sin biometría no puedes votar, sin contacto no recibes códigos).

**P30. Pedir borrado de datos**

- Botón Solicitar borrado + explicación Ley 29733 + doble confirmación.
- Tras solicitar: estado Solicitado → Confirmado por cumplimiento → En curso (lista de dueños pendientes: Biometría, Wallet, Membresía, Notificaciones...) → Completado + correo aviso.
- Si hay solicitud abierta: bloquear nueva ("Ya tienes una solicitud en curso").
- El historial de auditoría se conserva aunque los datos se borren.

**P31. Panel de Cumplimiento (admin)**

- Cola de solicitudes: persona, fecha, estado, dueños pendientes vs confirmados.
- Acciones: Confirmar solicitud, Definir política de retención (categoría dato, plazo, versión, historial).
- Vista auditoría por persona: permisos → retiros → solicitud → coordinación → confirmaciones → completado (solo lectura, inmutable).

---

## 13. Flujos end-to-end (para prototipo Figma)

### J1. Onboarding completo (camino feliz)

Registro (P1) → Verificar correo OTP (P3) → Solicitar unirse (P17) → Aceptar permisos (P29) → Subir documento (P8) → Resultado Coincide (P9) → Crear referencia (P10) → Admin activa membresía (P18) → Mis membresías dice Puedo votar (P20).

### J2. Crear y abrir votación

Registrar comunidad (P13) → Definir política (P15) → Activar (P14) → Nueva propuesta borrador (P22) → Abrir, congela regla (P23) → Notificación Propuesta abierta.

### J3. Votar (core, 7 pantallas)

Detalle propuesta Abierta (P23) → Pedir autorización (P24 chequea membresía + biometría) → Si no verificado → Prueba de vida (P11) → Volver, Autorizada → Emitir voto + Modal firmar (P25) → Recibo Firmado / En cola / Enviado / Confirmado (P26) → Tras cierre, Resultados (P27).

### J4. Casos borde de voto

- Denegada por mora → P24 muestra motivo + P20 explica.
- Doble intento → "Ya usaste esta autorización".
- Propuesta cerrada al votar → "Voto tardío rechazado".
- Envío fallido → timeline rojo + reintento automático + notificación.
- Autorización expirada → pedir de nuevo.

### J5. Privacidad

Retirar permiso contacto (P29) → OTP/notificaciones bloqueadas con mensaje → Pedir borrado (P30) → Admin confirma (P31) → seguimiento En curso → Completado + correo aviso.

---

## 14. Catálogo global de pantallas (~31 para Figma)

| # | Pantalla | Módulo | Rol |
|---|----------|--------|-----|
| P1 | Registro | Acceso | Visitante |
| P2 | Login | Acceso | Usuario |
| P3/P7 | Ingresar código OTP | OTP | Usuario |
| P4 | Mi cuenta / Seguridad | Acceso | Usuario |
| P5 | Admin usuarios | Acceso | Admin Sistema |
| P6 | Solicitar código (banner/estado) | OTP | Usuario |
| P8 | Subir documento | Identidad | Usuario |
| P9 | Resultado documento | Identidad | Usuario |
| P10 | Crear referencia biométrica | Identidad | Usuario |
| P11 | Prueba de vida | Identidad | Votante |
| P12 | Mi verificación | Identidad | Usuario |
| P13 | Registrar comunidad | Comunidad | Fundador |
| P14 | Ficha + estado comunidad | Comunidad | Admin |
| P15 | Política votación + historial | Comunidad | Admin |
| P16 | Administradores | Comunidad | Admin |
| P17 | Solicitar unirse | Membresía | Usuario |
| P18 | Padrón tabla | Membresía | Admin |
| P19 | Detalle miembro + acciones | Membresía | Admin |
| P20 | Mis membresías | Membresía | Miembro |
| P21 | Lista propuestas | Votación | Todos |
| P22 | Crear propuesta | Votación | Admin |
| P23 | Detalle propuesta + Abrir | Votación | Admin / Votante |
| P24 | Pedir autorización | Votación | Votante |
| P25 | Emitir voto + modal firma | Votación | Votante |
| P26 | Recibo + timeline envío | Votación | Votante |
| P27 | Resultados + quórum | Votación | Todos |
| P28 | Historial notificaciones | Notificaciones | Soporte / Admin |
| P29 | Mis permisos | Privacidad | Usuario |
| P30 | Pedir borrado + seguimiento | Privacidad | Usuario |
| P31 | Panel cumplimiento | Privacidad | Admin Cumpl. |
| Global | Layout, empty states, errores 404/500, toasts, confirmaciones | Sistema | Todos |

---

## 15. Reglas visuales globales para Figma AI

- **Insignias de estado siempre con color + texto:**
  - Verde: Activo / Confirmado / Coincide / Verificado / Alcanzado.
  - Amarillo: En revisión / Moroso / Solicitado / En cola / Enviado.
  - Rojo: Suspendido / Denegado / No coincide / Fallido / Abandonado.
  - Gris: Borrador / Archivado / Terminado / Expirado / Retirado.
- **Mensajes nunca técnicos:** decir "Tu voto ya cuenta" en vez de DeliveryConfirmed, "Necesitas verificar tu rostro ahora" en vez de VerdictExpired, "Documento borroso, retoma la foto" en vez de UNREADABLE.
- **Confirmaciones dobles para:** Archivar comunidad, Terminar membresía, Confirmar borrado, Cerrar propuesta.
- **Trazabilidad:** todo cambio muestra quién, cuándo, motivo. Historiales solo lectura.
- **Accesibilidad:** contraste suficiente, foco visible, textos en español claro, botones grandes para prueba de vida y votar.
- **Mobile-first** para P25 / P26 / P11 (votar y verificarse desde celular).
- **Empty states:** padrón vacío, sin propuestas, sin notificaciones, sin historial — con CTA claro.
- **Toasts:** éxito (verde), advertencia (amarillo), error (rojo) con acción cuando aplique.

---

## 16. Glosario de negocio (ES)

- Comunidad, Miembro, Padrón, Morosidad, Unidad (ej. dpto), Rol comunidad, Propuesta, Opciones, Quórum, Regla congelada, Autorización de un solo uso, Recibo de voto, Confirmado en blockchain, Permiso / Consentimiento, Borrado de datos, Prueba de vida, Referencia biométrica, Revisión documental.

---

## 17. Prompt sugerido para pegar en Figma AI

> Genera un sistema UI mobile-first en español para Votachain con los módulos y pantallas P1-P31 de este documento. Prioriza J3 Votar (P23 → P24 → P11 → P25 → P26 → P27) y J1 Onboarding. Usa insignias de estado, timeline de recibo en 5 pasos, modal de firma, tablas de padrón y panel de cumplimiento. Estilo limpio, accesible, colores semánticos verde / amarillo / rojo / gris.
