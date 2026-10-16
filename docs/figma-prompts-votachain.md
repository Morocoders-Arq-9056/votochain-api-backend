# VotaChain — Arquitectura de Información + Prompts para Figma AI

> Fuente de verdad: `docs/FUNCIONALIDADES.md` (P1-P31, J1-J5, 9 módulos) + `docs/frontend-estilos.md` (badges, lenguaje, modales, VDS Cap. VI).
> Audiencia: diseño UX/UI + Figma AI. Idioma UI: español es-PE, tratamiento de **usted**.
> Uso: copiar y pegar cada bloque en Figma AI. Datos siempre ficticios.

---

## Cómo usar este archivo

1. Pegar primero el **PROMPT 1 (IA)** para fijar estructura y navegación.
2. Pegar el **[BLOQUE BASE VOTACHAIN]** como guidelines del proyecto en Figma AI.
3. Generar el **Design System** antes que cualquier pantalla.
4. Diseñar pantallas de a **una por prompt** (mobile-first para P11 / P25 / P26).
5. Conectar **prototipo J1-J5** al final.
6. Si Figma AI se desvía de marca: añadir *"Usa exactamente los hex indicados, no los reemplaces por similares. Usa las variables color/* y radius/* creadas."*

**Frames:**

| Plataforma | Frame |
|---|---|
| Mobile | 390 × 844 |
| Tablet | 768 × 1024 |
| Desktop | 1440 × 900 |

---

## PROMPT 1 — Arquitectura de Información de VotaChain

```markdown
# VotaChain — Arquitectura de Información (IA)

Producto: plataforma de votación verificable para comunidades (juntas, asociaciones, condominios) en Perú.
Principio IA: distinguir siempre INTENCIÓN (lo que usted quiso votar) de HECHO CONFIRMADO (lo que blockchain confirmó). Solo lo Confirmado cuenta.
Idioma: español es-PE, tratamiento de usted, tono sobrio, formal, sereno. Prohibido tono festivo/gamificado. Mensajes nunca técnicos.
Ley 29733: permisos por finalidad + derecho al borrado con trazabilidad.

## 1. Roles y home por rol

1. Visitante (no registrado): solo Acceso. Home = Landing + Registro / Login.
2. Votante / Miembro: Home = Mis membresías (P20) + Mis votaciones abiertas (P21) + Mi verificación (P12) + Mi recibo (P26).
3. Fundador: Home = Registrar comunidad (P13) -> definir política (P15) -> activar (P14).
4. Admin Comunidad: Home = Dashboard comunidad: padrón activos (P18), propuestas por estado (P21), quórum. Gestiona P14-P16, P18-P19, P22-P23, P27.
5. Admin Cumplimiento: Home = Cola borrado + permisos (P31). Gestiona P29-P31, retención.
6. Admin Sistema: Home = Usuarios, roles, suspensiones (P5) + Historial notificaciones (P28).
7. Sistema (sin UI): se refleja como estados (En cola, Enviado, Confirmado/Fallido, Expirado).

## 2. Sitemap (9 grupos, 31 pantallas)

0. ACCESO Y CUENTA
- P1 Registro (correo + aceptar Términos/Política) -> P3 OTP
- P2 Login (correo + prueba / identidad externa, aviso cierre sesión anterior, bloqueos: suspendida, fallos restantes, bloqueo temporal)
- P3/P7 Ingresar código OTP [componente reutilizable]
- P4 Mi cuenta / Seguridad (estado, correo+insignia, roles, historial accesos, cambiar clave/correo, vincular externa, cerrar sesión)
- P5 Admin usuarios (tabla persona|correo|estado|roles|última actividad, filtros, dar/quitar rol, suspender con motivo, rehabilitar)

1. OTP
- P6 Solicitar código (banner "Te enviamos código a ***@correo.com", si retiró permiso contacto: "No podemos contactarte, revise su privacidad" y no envía)
- P7 Ingresar código: input 6 dígitos, timer 5min, intentos restantes 5, Reenviar invalida anterior. Estados: Abierto / Confirmado (un solo uso) / Fallido / Invalidado / Expirado.

2. IDENTIDAD (Documento + Biometría)
- P8 Subir documento (pre-condición: >=1 comunidad + aceptar tratamiento datos; tipo DNI/CE/Pasaporte, anverso+reverso+selfie; errores: Sin membresía elegible, Debe aceptar tratamiento)
- P9 Resultado documental: En revisión (spinner) / Coincide verde (habilita referencia, un solo uso) / No coincide rojo / Ilegible amarillo (borrosa/reflejo/recortada/vencida/tipo incorrecto + guía retoma) / Expirada gris. + historial intentos.
- P10 Crear referencia biométrica (solo si Coincide + permiso vigente; flujo centrar rostro; éxito Referencia creada)
- P11 Prueba de vida pre-voto (obligatoria justo antes de votar, caduca rápido: Aceptar tratamiento -> prueba mirar/parpadear/mover -> Verificado fresco / No verificado con motivo / Expirado. Nunca mostrar capturas a otros roles)
- P12 Mi verificación (¿tengo referencia activa? ¿estoy verificado ahora? motivo+vigencia+historial)

3. COMUNIDADES
- P13 Registrar comunidad (nombre, domicilio departamento/provincia/distrito, contacto -> estado Registrada -> sugiere Política + Nombrar admin -> Activar)
- P14 Ficha + Estado (nombre, badge Registrada/Activa/Suspendida/Archivada, contacto; banner Suspendida: no nuevos miembros ni votaciones +motivo; banner Archivada terminal solo lectura; acciones: Activar, Editar, Suspender con motivo, Reactivar, Archivar con motivo+doble confirmación)
- P15 Política votación (umbral ej 50%+1, base miembros/unidades, mayoría; aviso "solo futuras votaciones, abiertas conservan regla congelada"; historial versiones fecha/quién/valores solo lectura)
- P16 Administradores (tabla persona|desde cuándo; Nombrar busca persona existente por correo/ID, Quitar con confirmación)

4. MEMBRESÍAS (padrón)
- P17 Solicitar unirse (selector comunidad Activa + Solicitar -> Solicitada "Pendiente aprobación")
- P18 Padrón tabla admin (miembro|unidad ej Dpto 302|rol|estado Solicitada/Activa/Morosa/Suspendida/Terminada|mora|acciones; filtros estado/unidad/búsqueda; contador "X miembros activos"; solo Activos cuentan quórum)
- P19 Detalle miembro (persona, comunidad, unidad, rol, estado+timeline, historial; acciones: Activar, Asignar unidad/rol, Marcar moroso con motivo, Levantar mora, Suspender con motivo, Rehabilitar, Terminar terminal con motivo+confirmación; Terminada sin acciones)
- P20 Mis membresías votante (cards comunidad: nombre|estado|unidad|¿puedo votar? Sí/No+motivo: moroso/suspendido/no miembro/comunidad suspendida)

5. VOTACIONES CORE
- P21 Lista propuestas por comunidad (filtros Borrador/Abierta/Cerrada/Escrutada; card título|estado|fechas apertura/cierre|participación %|badge quórum; botón admin Nueva propuesta)
- P22 Crear propuesta borrador (comunidad fija, título, descripción, opciones min 2, fechas previstas -> Borrador no visible votantes)
- P23 Detalle propuesta (badge estado + regla congelada visible "Regla aplicada: 50%+1 sobre activos al abrir 12/02/2026"; si Borrador admin: Abrir congela regla + Editar; si Abierta elegible: Pedir autorización; si Cerrada: pendiente escrutinio; si Escrutada: resultados)
- P24 Pedir autorización (checklist: ¿Membresía activa? Sí/No+motivo; ¿Biometría fresca? Sí/No -> Ir a prueba vida; resultado Autorizada código un solo uso corta vigencia + Votar ahora / Denegada con motivo / Expirada pedir de nuevo; congela elegibilidad en ese instante)
- P25 Emitir voto CRÍTICA mobile-first (radio opciones, resumen propuesta+votante+autorización válida hasta HH:MM; botón Firmar y votar -> Modal firma "Autoriza firmar este contenido. La firma se olvida inmediatamente" Firmar/Cancelar, nunca pedir claves; validaciones: autorización válida+abierta+opción válida; doble voto "Ya usó esta autorización"; éxito: recibo Firmado "En cola, aún no cuenta"; errores: expirada/consumida, cerrada "Voto tardío rechazado", firma rechazada)
- P26 Mi recibo tracking (timeline 5 pasos: Firmado -> En cola -> Enviado -> Confirmado verde hash/fecha "Ya cuenta" + Ver en explorador / Fallido-Abandonado rojo motivo red/costo/límite + contactar soporte no re-votar misma autorización; aria-live polite)
- P27 Cierre y escrutinio (admin Cerrar; conteo por opción, participación, quórum Alcanzado/No alcanzado; tabla+barra %; nota "Solo Confirmados cuentan"; auditoría autorizaciones vs firmados vs confirmados)

6. FIRMA Y ENVÍO (sin menú, embebido)
- Modal Firmar + estados timeline: Aceptado, En cola por pagador, Enviado, Confirmado terminal éxito, Fallido reintentable acotado, Abandonado terminal. Reglas: solo firma contenido armado por Votaciones, solo envía firmado, nunca reescribe. Wallet suspendida: "No puede firmar ahora, contacte soporte".

7. NOTIFICACIONES
- Plantillas: Bienvenida, OTP, Verificación correo, Cambio seguridad, Comunidad suspendida/reactivada, Membresía activada/morosa/suspendida/rehabilitada, Propuesta abierta/cerrada, Recibo firmado/enviado/confirmado/fallido, Resultado escrutinio, Borrado solicitado/completado.
- P28 Historial notificaciones admin/soporte (tabla fecha|destinatario correo|plantilla|estado Solicitada/Rechazada duplicada o sin permiso/Confirmada/Fallida+reintentos|motivo; nunca duplicar idempotencia, retirado permiso -> Rechazada sin envío, reintento solo desde Fallida)

8. PRIVACIDAD Ley 29733
- P29 Mis permisos (switches por finalidad: biométrico, contacto correo, análisis documental; estado Permitido/Retirado, versión política, desde cuándo; al retirar "Deja de aplicar desde ahora, no borra lo pasado" + consecuencia sin biometría no puede votar, sin contacto no recibe códigos)
- P30 Pedir borrado (Solicitar + explicación Ley + doble confirmación; flujo Solicitado -> Confirmado -> En curso lista dueños pendientes Biometría/Wallet/Membresía/Notificaciones -> Completado + correo; si abierta bloquea nueva; auditoría se conserva)
- P31 Panel Cumplimiento (cola persona|fecha|estado|dueños pendientes vs confirmados; Confirmar solicitud, Definir retención categoría/plazo/versión/historial; vista auditoría inmutable permisos->retiros->solicitud->coordinación->confirmaciones->completado)

## 3. Navegación global

- Visitante: Inicio / Registro / Login.
- Votante: Inicio (P20+P21) / Votar (P23-P26) / Verificación (P12+P11) / Cuenta (P4+P29+P30).
- Admin Comunidad: Panel / Padrón (P18-P19) / Propuestas (P21-P23+P27) / Comunidad (P14-P16).
- Admin Cumplimiento: Solicitudes (P31) / Retención / Auditoría.
- Admin Sistema: Usuarios (P5) / Notificaciones (P28).
- Flujos prototipo: J1 Onboarding P1->P3->P17->P29->P8->P9 Coincide->P10->P18 Activar->P20 Puedo votar. J2 Crear votación P13->P15->P14 Activar->P22->P23 Abrir congela regla. J3 Votar P23->P24->P11 si falta->P25+modal->P26->P27. J4 Bordes mora/doble/tardío/fallido/expirada. J5 Privacidad P29 retirar->bloqueo OTP->P30->P31->Completado.

Reglas IA: tablas admin en desktop -> cards apiladas <768px. P25/P26/P11 mobile-first una mano. Historiales solo lectura. Toda acción pide quién/cuándo/motivo. Doble confirmación: Archivar, Terminar membresía, Borrado, Cerrar propuesta.
```

---

## PROMPT 2 — Prompt maestro para Figma AI (sistema + mockups VotaChain completo)

```markdown
Rol: Actúa como Lead Product Designer + UX/UI Architect + Design Systems Designer especializado en civic-tech, votación verificable, identidad y productos auditables. Construye en Figma un sistema + mockups estructurados listos para handoff a desarrollo, no pantallas sueltas.

Producto: VotaChain, plataforma votación verificable para comunidades (juntas, asociaciones, condominios) Perú. Garantiza Una persona=un voto (solo Activos verificados), identidad doble (documento + persona viva + código correo), voto firmado en blockchain, escrutinio solo Confirmados, privacidad Ley 29733. Principio crítico: distinguir INTENCIÓN vs HECHO CONFIRMADO. Solo Confirmado cuenta. Idioma es-PE, tratamiento usted, sobrio formal sereno. Nada festivo/gamificado. Mensajes nunca técnicos.

Principios UX por rol:
- Votante: confianza + claridad. Debe saber siempre ¿puedo votar? ¿por qué no? ¿mi voto ya cuenta?
- Admin Comunidad: control + trazabilidad (quién/cuándo/motivo, regla congelada).
- Admin Cumplimiento/Sistema: auditoría + reversibilidad segura.
- Todos: minimizar error irreversible, doble confirmación, estados explícitos.

[BLOQUE BASE VOTACHAIN - repetir si se desvía]
Marca VDS Cap.VI, usar exactamente hex: brand primario #1E3A8A, success #059669, warning #D97706, danger #DC2626, neutral #475569, fondo base #F8FAFC, surface #FFFFFF, borde #E2E8F0, bg-success #ECFDF5, bg-warning #FFFBEB, bg-danger #FEF2F2. Tipografía: Outfit para H/Display, Inter para Body/Button 16px/600 y Badge 12px/600 uppercase, JetBrains Mono 13px para OTP/código constancia/hash. Radios: card 10-16px, botón 10px, badge 6px, input 10px, OTP 10px, bottom-sheet 24px top. Sombras sm/md/lg sutiles. Touch mínimo 48x48px + gap 8px, crítico en P11 y P25. Foco visible >=2px. Espaciado múltiplos 4/8. Breakpoints 320-639 4col / 640-1023 8col / 1024+ 12col. Frames: mobile 390x844, tablet 768x1024, desktop 1440x900. Badges siempre color+texto+punto, nunca solo color. Contraste AA 4.5:1. Fechas dd/mm/aaaa + zona horaria. aria-live polite en timeline, OTP, quórum.

Design system - Foundations:
Crea variables: color/brand-primary #1E3A8A, color/success #059669, color/warning #D97706, color/danger #DC2626, color/text-primary #0F172A, color/text-secondary #475569, color/bg #F8FAFC, color/surface #FFFFFF, color/border #E2E8F0, color/bg-success #ECFDF5, color/bg-warning #FFFBEB, color/bg-danger #FEF2F2. radius/sm 6, radius/md 10, radius/lg 16, radius/sheet 24. spacing 4,8,12,16,20,24,32,40. Estilos texto: Display Outfit Bold, H1/H2/H3 Outfit, Body/Body Small/Caption Inter, Button Inter 16/600, Badge Inter 12/600 uppercase, Mono JetBrains Mono 13. Efectos shadow-sm/md/lg. Documenta en frame con muestras + hex + ejemplo "Tu voto ya cuenta" y "Código rec-... / 0x...".

Componentes (con variantes/estados, usar variables, nada hardcodeado):
- Buttons: Primary #1E3A8A texto blanco, Secondary borde, Danger #DC2626, Ghost, Disabled, Loading. min-height 48px. Estados Default/Pressed/Focus 2px/Disabled/Loading.
- Inputs: text, email, password mostrar/ocultar, código OTP 6 dígitos Mono centrado letter-spacing, search, select comunidad, date, textarea motivo obligatorio. Estados Default/Focus/Error/Disabled. Error amable es-PE.
- Badge estado (obligatorio punto+texto uppercase): success Activo/Confirmado/Coincide/Verificado/Alcanzado/Autorizada, warning En revisión/Moroso/Solicitado/En cola/Enviado/Ilegible, danger Suspendido/Denegado/No coincide/Fallido/Abandonado, neutral Borrador/Archivado/Terminado/Expirado/Retirado/Registrada/Cerrada.
- Cards: CommunityCard, MembershipCard (¿puedo votar? Sí/No+motivo), ProposalCard (título|estado|fechas|participación%|quórum), MemberRow, ResultRow con barra %, AuditRow quién/cuándo/motivo.
- OTP box: input + timer 5min + intentos restantes 5 + Reenviar (invalida anterior).
- Timeline recibo 5 pasos P26: Firmado -> En cola -> Enviado -> Confirmado/Fallido, con time, estado done/current/failed, link Ver en explorador, banner verde "Ya cuenta en escrutinio" o rojo motivo + contactar soporte.
- Modal Firmar P25: título, resumen propuesta+opción sin tecnicismos, advertencia "La firma se olvida inmediatamente", Firmar/Cancelar. Modal Confirmación doble genérico: título, consecuencia irreversible, input Motivo obligatorio, Volver/Confirmar danger.
- Tablas admin (P5,P16,P18,P28): header sticky, filtros, búsqueda, paginación 10/25/50, contador X activos; versión mobile como cards apiladas.
- Navigation: topbar + sidebar admin (Panel/Padrón/Propuestas/Comunidad o Usuarios/Notificaciones o Solicitudes/Auditoría) + bottom-bar mobile 72px para Votante (Inicio/Votar/Verificación/Cuenta). CTA Votar siempre jerarquía máxima.
- Toasts: success #ECFDF5, warning #FFFBEB, danger #FEF2F2 con acción Ver recibo/Reintentar/Contactar soporte.
- Empty: padrón vacío, sin propuestas, sin notificaciones, sin historial + CTA. Errores 404/500 serenos + Volver inicio. Skeletons para listas y timeline. Spinner P9 sin destellos.

Pantallas (una por prompt, mobile-first P11/P25/P26 a una mano, resto responsive; español usted, datos ficticios peruanos: DNI 4821xxxx, Dpto 302, fechas 12/02/2026):
P1 Registro, P2 Login + variantes suspendida/fallos/bloqueo, P3/P7 OTP + variantes confirmado/fallido/invalidado/expirado, P4 Mi cuenta, P5 Admin usuarios, P6 banner solicitar código + bloqueado sin permiso, P8 Subir documento + errores sin membresía/sin permiso, P9 Resultado 5 estados + historial, P10 Referencia biométrica, P11 Prueba vida + Verificado/No verificado/Expirado, P12 Mi verificación, P13 Registrar comunidad, P14 Ficha+estado 4 badges+banners+acciones, P15 Política+historial versiones, P16 Administradores, P17 Solicitar unirse, P18 Padrón tabla+cards mobile, P19 Detalle miembro+timeline+acciones, P20 Mis membresías, P21 Lista propuestas, P22 Crear propuesta, P23 Detalle+regla congelada+Abrir, P24 Autorización checklist membresía+biometría + Autorizada/Denegada/Expirada, P25 Emitir voto radio + modal firma + éxito Firmado "En cola aún no cuenta" + errores doble/tardío/expirada, P26 Recibo timeline Firmado/En cola/Enviado/Confirmado verde hash + Ver explorador / Fallido rojo, P27 Resultados quórum + auditoría, P28 Historial notificaciones, P29 Mis permisos switches + consecuencias, P30 Borrado doble confirmación + tracking Solicitado->Confirmado->En curso->Completado, P31 Panel cumplimiento cola+retención+auditoría inmutable, + Layout global/toasts/confirmaciones/404-500.

Traducción nunca técnica obligatoria: DeliveryConfirmed="Tu voto ya cuenta", VerdictExpired="Necesita verificar su rostro ahora", UNREADABLE="Documento borroso, retome la foto", DeliveryFailed="No se pudo registrar. Contacte soporte, no vote de nuevo con la misma autorización", LateVoteRejected="Votación cerrada, voto tardío rechazado", DoubleVote="Ya usó esta autorización", Tx hash="Código de constancia (hash al expandir)", Wallet/clave="Nunca pedir ni mostrar claves". Error pattern: qué pasó + qué se conserva + qué hacer.

Prototipo conecta: J1 Onboarding P1->P3->P17->P29->P8->P9 Coincide->P10->P18 Activar->P20 Puedo votar. J2 P13->P15->P14 Activar->P22->P23 Abrir congela regla + notificación. J3 core P23 Abierta->P24->P11 si falta->P25+modal->P26 timeline->P27. J4 bordes: mora denegada, doble intento, tardío, fallido, expirada. J5 P29 retirar contacto->bloqueo OTP->P30->P31 confirmar->Completado. Interacciones: navegación, overlays, dialogs doble confirmación, bottom-sheet, validaciones, aria-live.

Organización Figma páginas: 00-Cover, 01-Foundations, 02-Components, 03-Acceso-OTP-Identidad P1-P12, 04-Comunidad-Membresía P13-P20, 05-Votación P21-P27, 06-Privacidad-Notifs P28-P31, 07-Prototype J1-J5, 08-UX States (empty/loading/error/toast). Nombres semánticos ej Votacion/P25/Emitir, Recibo/Timeline/Confirmado.

Calidad: cada pantalla responde ¿Qué pasa? ¿Qué puede hacer? ¿Acción principal? ¿Si falla? Evita exceso cards/colores, formularios gigantes, iconos ambiguos, destructivas prominentes, tablas ilegibles, navegación inconsistente. Solo datos ficticios.

Resultado: design system con variables + componentes con variantes + 31 pantallas + estados + navegación por rol + prototipo J1-J5 + trazabilidad quién/cuándo/motivo, listo para inspección dev (espaciados, tipografía, colores, estructura).
```

---

## Anexo — Prompts por pantalla (copiar uno por vez, anteponer [BLOQUE BASE VOTACHAIN])

### DS-1 Variables y estilos

```text
[BLOQUE BASE VOTACHAIN]
Crea Foundations de VotaChain: variables color/brand-primary #1E3A8A, color/success #059669, color/warning #D97706, color/danger #DC2626, color/text-secondary #475569, color/bg #F8FAFC, color/surface #FFFFFF, color/border #E2E8F0, radius/sm 6, radius/md 10, radius/lg 16, spacing 4,8,12,16,24,32, estilos Outfit Display/H1/H2/H3, Inter Body/Button/Badge, JetBrains Mono código, shadow-sm/md/lg. Frame documentación fondo #F8FAFC con muestras nombre+hex y ejemplos "Tu voto ya cuenta" y "Código rec-8F3A".
```

### DS-2 Botones, inputs, badges

```text
[BLOQUE BASE VOTACHAIN]
Crea componentes base con variantes usando variables: Buttons Primary/Secondary/Danger/Ghost/Disabled/Loading 48px radius 10; Inputs text/email/password mostrar-ocultar/OTP Mono 6 dígitos/search/select/date/motivo estados Default/Focus 2px/Error/Disabled; Badge con punto+texto uppercase en 4 semánticos success/warning/danger/neutral. Grilla ordenada.
```

### DS-3 Componentes VotaChain

```text
[BLOQUE BASE VOTACHAIN]
Crea: OTP box (input+timer 5min+intentos 5+Reenviar), Timeline recibo 5 pasos Firmado->En cola->Enviado->Confirmado/Fallido, Modal Firmar + Modal confirmación doble con motivo obligatorio, Cards Community/Membership/Proposal/Result/Audit, Tablas admin con filtros y versión cards mobile, Toasts 3 tipos, Empty/Skeleton/404-500. Todo con variables.
```

### Pantallas core (ejemplos, repetir patrón para P1-P31)

```text
[BLOQUE BASE VOTACHAIN]
Diseña P25 Emitir voto mobile 390x844, la más crítica, a una mano: header propuesta + regla congelada, radio opciones (mínimo Sí/No/Abstención), resumen votante + autorización válida hasta HH:MM, botón primario 48px "Firmar y votar". Modal firma: resumen sin tecnicismos + "La firma se olvida inmediatamente" + Firmar/Cancelar. Éxito: "Su voto firmado está en cola, aún no cuenta" + Ver recibo. Errores: "Ya usó esta autorización", "Votación cerrada, voto tardío rechazado". Nunca pedir claves.
```

```text
[BLOQUE BASE VOTACHAIN]
Diseña P26 Mi recibo mobile 390x844: timeline vertical 5 pasos Firmado->En cola->Enviado->Confirmado con time dd/mm/aaaa, variante Confirmado verde con hash y "Ya cuenta en escrutinio" + Ver en explorador, y variante Fallido rojo con motivo + contactar soporte. aria-live polite.
```

```text
[BLOQUE BASE VOTACHAIN]
Diseña P24 Pedir autorización mobile 390x844: checklist automático 1. ¿Membresía activa? Sí/No+motivo 2. ¿Biometría fresca? Sí/No + botón Ir a prueba de vida. Resultados: Autorizada (código un solo uso + Votar ahora) / Denegada con motivo claro / Expirada + pedir de nuevo.
```

### Prototipos J1-J5

```text
[BLOQUE BASE VOTACHAIN]
Con pantallas ya creadas, conecta prototipo J3 Votar: P23 Abierta -> P24 checklist -> P11 si no verificado -> P25 + modal firmar -> P26 timeline -> P27 resultados. Transiciones reales, overlays, validaciones.
```

---

## Decisiones que afectan diseño (valores ejemplo usados)

| Decisión | Valor en prompts |
|---|---|
| Timer OTP | 5 min |
| Intentos OTP | 5 |
| Touch mínimo | 48x48 + 8 gap |
| Umbral quórum ejemplo | 50%+1 |
| Fechas ejemplo | 12/02/2026, dd/mm/aaaa |
| Datos mock | DNI 4821xxxx, Dpto 302, solo ficticios |
| Tono | usted, sobrio, nunca técnico |
