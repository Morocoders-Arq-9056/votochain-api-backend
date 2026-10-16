# VotaChain Backend — Guía de Estilos para Frontend (Mock-ups / Wireframes)

> **Fuente de verdad:** `docs/FUNCIONALIDADES.md` (este backend es API NestJS pura, no contiene `*.css`, `tailwind.config` ni tokens).
> **Alcance:** compila todas las menciones de estilo/UI del backend para implementar mock-ups y wireframes.
> **Idioma UI:** español (`es-PE`), tratamiento de **usted**, mensajes nunca técnicos.
> **Estado:** CANDIDATO — los HEX heredan del VDS Capítulo VI (el backend solo define colores semánticos verde/amarillo/rojo/gris).
> **Referencia VDS:** `votochain-project-document/README.md:1466-1882` (Capítulo VI).

---

## 1. Sistema de insignias de estado (obligatorio)

Fuente: `docs/FUNCIONALIDADES.md:438-442` — §15 Reglas visuales globales.

> **Regla de oro:** toda insignia = **color + texto**. Nunca solo color (accesibilidad).

| Semántico | Estados del backend | Uso en pantallas |
|---|---|---|
| **Verde (éxito)** | `Activo / Confirmado / Coincide / Verificado / Alcanzado` | P9 Coincide, P11 Verificado, P24 Autorizada, P26 Confirmado, P27 Quórum alcanzado |
| **Amarillo (aviso / en curso)** | `En revisión / Moroso / Solicitado / En cola / Enviado` | P9 En revisión/Ilegible, P18 Morosa, P26 En cola/Enviado, P30 Solicitado |
| **Rojo (bloqueo / error)** | `Suspendido / Denegado / No coincide / Fallido / Abandonado` | P2 Suspendida, P9 No coincide, P24 Denegada, P26 Fallido, P14 Suspendida |
| **Gris (neutral / terminal)** | `Borrador / Archivado / Terminado / Expirado / Retirado` | P14 Archivada, P19 Terminada, P22 Borrador, OTP Expirado, P29 Retirado |

Detalles por pantalla (fuente `FUNCIONALIDADES.md`):

- **P3/P7 OTP:** `Abierto / Confirmado / Fallido (muestra restantes) / Invalidado / Expirado` (`:107-117`).
- **P9 Documento:** `En revisión (spinner) / Coincide (verde) / No coincide (rojo) / Ilegible (amarillo + motivo: borrosa/reflejo/recortada/vencida/tipo incorrecto) / Expirada (gris)` (`:144-152`).
- **P11 Liveness:** `Verificado (fresco) / No verificado (con motivo) / Expirado` (`:160-166`).
- **P14 Comunidad:** `Registrada / Activa / Suspendida (banner bloqueante) / Archivada (banner terminal solo lectura)` (`:193-198`).
- **P18 Padrón:** `Solicitada / Activa / Morosa / Suspendida / Terminada (terminal)` (`:230-233`).
- **P21 Propuestas:** `Borrador / Abierta / Cerrada / Escrutada` + `quórum` (`:259-263`).
- **P24 Autorización:** `Autorizada (código un solo uso) / Denegada (motivo) / Expirada` (`:278-284`).
- **P26 Recibo:** `Firmado → En cola → Enviado → Confirmado (verde) / Fallido-Abandonado (rojo)` (`:295-300`, `:316`).
- **P28 Notificaciones:** `Solicitada / Rechazada / Confirmada / Fallida` (`:328-332`).
- **P29 Permisos:** `Permitido / Retirado` por finalidad (`:350-353`).
- **P30 Borrado:** `Solicitado → Confirmado → En curso → Completado` (`:355-360`).

### 1.1 CSS implementable

```css
:root {
  /* Semánticos backend — mapean al VDS Cap. VI */
  --semantic-success: #059669; /* verde esmeralda VDS */
  --semantic-warning: #D97706; /* ámbar VDS */
  --semantic-danger: #DC2626;  /* rojo carmesí VDS */
  --semantic-neutral: #475569; /* gris pizarra VDS */
  --semantic-border: #E2E8F0;
  --semantic-bg-warning: #FFFBEB;
  --semantic-bg-danger: #FEF2F2;
  --semantic-bg-success: #ECFDF5;
  --semantic-bg-neutral: #F8FAFC;
}

.badge {
  display: inline-flex; align-items: center; gap: 6px;
  font: 600 12px/1.2 'Inter', system-ui, sans-serif;
  padding: 4px 8px; border-radius: 6px; border: 1px solid transparent;
  text-transform: uppercase; letter-spacing: .02em;
}
.badge--success { color: #065F46; background: var(--semantic-bg-success); border-color: #A7F3D0; }
.badge--warning { color: #92400E; background: var(--semantic-bg-warning); border-color: #FDE68A; }
.badge--danger  { color: #991B1B; background: var(--semantic-bg-danger);  border-color: #FECACA; }
.badge--neutral { color: #334155; background: var(--semantic-bg-neutral); border-color: var(--semantic-border); }
.badge__dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
```

```html
<!-- Ejemplo P26 -->
<span class="badge badge--success"><span class="badge__dot"></span>Confirmado — ya cuenta</span>
<span class="badge badge--warning"><span class="badge__dot"></span>En cola de envío</span>
<span class="badge badge--danger"><span class="badge__dot"></span>Fallido — contacta soporte</span>
```

### 1.2 Tailwind

```js
// tailwind.config.js — extender
export default {
  theme: {
    extend: {
      colors: {
        semantic: {
          success: '#059669',
          warning: '#D97706',
          danger: '#DC2626',
          neutral: '#475569',
        }
      }
    }
  }
}
```

---

## 2. Lenguaje nunca técnico (tabla de traducción UI)

Fuente: `FUNCIONALIDADES.md:443`.

| No mostrar (interno) | Mostrar en UI (español claro) |
|---|---|
| `DeliveryConfirmed` | **Tu voto ya cuenta** |
| `VerdictExpired` | **Necesitas verificar tu rostro ahora** |
| `UNREADABLE` | **Documento borroso, retoma la foto** |
| `DeliveryFailed / Abandoned` | **No se pudo registrar. Contacta soporte, no votes de nuevo con la misma autorización** |
| `LateVoteRejected` | **Votación cerrada, voto tardío rechazado** (`:388`) |
| `DoubleVote` | **Ya usaste esta autorización** (`:291,387`) |
| `Tx hash / firma` | **Código de constancia** (hash solo al expandir, tras confirmado) |
| `Wallet / clave` | Nunca pedir ni mostrar claves (`:290,315`) |

Reglas adicionales:

- Mensajes de error: qué pasó + qué se conserva + qué hacer. Sin trazas ni biométricos (`VDS 6.2.2`).
- Tono: sobrio, formal, sereno. Prohibido festivo/gamificado en voto y biometría.

---

## 3. Confirmaciones dobles (acciones irreversibles)

Fuente: `FUNCIONALIDADES.md:444` + pantallas.

Obligatorias para:

1. `Archivar comunidad` — P14 pide motivo + doble confirmación (`:197`).
2. `Terminar membresía` — P19 terminal, motivo + confirmación (`:238`).
3. `Confirmar borrado (Ley 29733)` — P30 doble confirmación (`:357`).
4. `Cerrar propuesta` — admin, tras cierre solo escrutinio (`:303-307`).
5. `Suspender / Rehabilitar` — P5, P14, P19 piden motivo (`:91,197,238`).

### Patrón modal

```html
<div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
  <h3 id="confirm-title">¿Archivar comunidad?</h3>
  <p>Esta acción deja la comunidad en solo lectura. No se puede deshacer.</p>
  <label for="motivo">Motivo (obligatorio)</label>
  <input id="motivo" type="text" required />
  <button class="btn-secondary">Volver</button>
  <button class="btn-danger">Confirmar archivo</button>
</div>
```

```css
.btn-secondary { border: 1px solid #E2E8F0; border-radius: 10px; min-height: 48px; padding: 0 24px; }
.btn-danger { background: #DC2626; color: #fff; border-radius: 10px; min-height: 48px; padding: 0 24px; }
```

---

## 4. Trazabilidad visible (quién / cuándo / motivo)

Fuente: `FUNCIONALIDADES.md:445`.

- Todo cambio muestra **quién, cuándo, motivo**. Historiales **solo lectura, nunca se edita el pasado**.
- Aplicar en:
  - **P15 Política:** historial versiones fecha/quién/valores (`:199-203`).
  - **P19 Miembro:** timeline activaciones/mora/suspensiones (`:237`).
  - **P27 Escrutinio:** auditoría autorizaciones vs firmados vs confirmados (`:307`).
  - **P31 Cumplimiento:** permisos → retiros → solicitud → coordinación → completado, inmutable (`:366`).
  - **P5 Admin usuarios + P28 Notificaciones:** tabla fecha/destinatario/plantilla/estado/motivo (`:90-91,328-332`).

---

## 5. Accesibilidad mínima

Fuente: `FUNCIONALIDADES.md:446` + VDS `6.1.2-4`.

- [ ] Contraste suficiente (meta VDS `4.5:1` normal / `3:1` grande).
- [ ] Foco visible `≥2px` en todo interactivo.
- [ ] Botones grandes para **P11 prueba de vida** y **P25 votar**: touch `48x48px + 8px` gap.
- [ ] Textos en español claro, `dd/mm/aaaa` + zona horaria en fechas de apertura/cierre.
- [ ] `aria-live="polite"` en timeline P26, contadores OTP y quórum.
- [ ] `prefers-reduced-motion` respetado; spinner P9 sin destellos.

---

## 6. Mobile-first + responsive

Fuente: `FUNCIONALIDADES.md:447,461`.

- **Prioridad móvil:** `P25 Emitir voto / P26 Recibo / P11 Prueba de vida` — diseñadas para celular con una mano.
- **Resto responsive:** tablas admin (`P5, P16, P18, P28`) → cards apiladas en `<768px`.
- **Breakpoints VDS:** Mobile `320-639px/4col`, Tablet `640-1023px/8col`, Desktop `1024px+/12col`.

---

## 7. Empty states, errores y toasts

Fuente: `FUNCIONALIDADES.md:448-449,432`.

### Empty states (con CTA claro)

- Padrón vacío → `Sin miembros aún. Invitar / Solicitar unirse`.
- Sin propuestas → `No hay votaciones abiertas. Crear propuesta (admin)`.
- Sin notificaciones / sin historial → ilustración sobria + CTA.
- 404/500 → mensaje sereno + `Volver al inicio` (no exponer traza).

### Toasts

```css
.toast { border-radius: 10px; padding: 12px 16px; font: 500 14px/1.4 'Inter', sans-serif; }
.toast--success { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }
.toast--warning { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
.toast--danger  { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }
```

- Éxito (verde), advertencia (amarillo), error (rojo) con acción cuando aplique (`Ver recibo`, `Reintentar`, `Contactar soporte`).

---

## 8. Componentes derivados de P1-P31 (para Figma)

Fuente: `FUNCIONALIDADES.md:62-432`.

### 8.1 OTP reutilizable (P3/P7)

- Input 6 dígitos monoespaciado, temporizador (ej. 5 min), intentos (ej. 5), `Reenviar (invalida anterior)`.
- Fuente código: `JetBrains Mono 13px/500` (VDS).

```css
.otp-input { font: 500 20px 'JetBrains Mono', monospace; letter-spacing: .3em; text-align: center; min-height: 56px; border-radius: 10px; border: 1px solid #E2E8F0; }
```

### 8.2 Timeline recibo 5 pasos (P26) — core visual

`Firmado → En cola → Enviado → Confirmado / Fallido` (`:295-300`).

```html
<ol class="timeline">
  <li class="done">Firmado <time>12/02/2026 10:01</time></li>
  <li class="done">En cola</li>
  <li class="current">Enviado</li>
  <li>Confirmado en blockchain</li>
</ol>
<a href="#">Ver en explorador blockchain</a>
```

- Confirmado verde + `hash/tx + Ya cuenta en escrutinio`.
- Fallido rojo + motivo (`rechazado por red / costo agotado / límite reintentos`) + `contactar soporte`.

### 8.3 Modal firmar (P25 + Módulo 7)

- Título + resumen (propuesta + opción, sin tecnicismos) + advertencia `La firma se olvida inmediatamente` + `Firmar / Cancelar` (`:289-291,315`).
- Nunca pedir/mostrar claves. Bloquear doble voto y propuesta cerrada.

### 8.4 Tablas admin (P5, P16, P18, P28)

- Columnas P18: `miembro | unidad (Dpto 302) | rol | estado | mora | acciones` + contador `X miembros activos` + filtros estado/unidad/búsqueda (`:230-233`).
- Header sticky, paginación `10/25/50`, búsqueda global.

### 8.5 Tarjetas votante (P20, P21)

- P20: `nombre comunidad | estado | unidad | ¿puedo votar? Sí/No + motivo` (`:241-243`).
- P21: `título | estado | fechas | participación % | quórum` (`:259-263`).

### 8.6 Panel cumplimiento (P31)

- Cola `persona | fecha | estado | dueños pendientes vs confirmados` + `Confirmar solicitud` + `política retención (categoría, plazo, versión)` (`:362-366`).

---

## 9. Checklist mock-ups por flujo (para prototipo)

Fuente: `FUNCIONALIDADES.md:370-395` + prompt `§17:459-461`.

- [ ] **J3 Votar (core, 7 pantallas):** P23 Detalle Abierta → P24 Autorización (checklist membresía + biometría) → P11 Liveness si falta → P25 Radio + modal firma → P26 Timeline → P27 Resultados (`:380-382`).
- [ ] **J1 Onboarding:** P1 Registro → P3 OTP → P17 Solicitar unirse → P29 Permisos → P8 Subir doc → P9 Coincide → P10 Referencia → P18 Activar → P20 Puedo votar (`:372-374`).
- [ ] **J2 Crear votación:** P13 Registrar → P15 Política → P14 Activar → P22 Borrador → P23 Abrir (congela regla) (`:376-378`).
- [ ] **J4 Bordes:** mora, doble intento, tardío, fallido, expirada (`:384-390`).
- [ ] **J5 Privacidad:** P29 retirar → bloqueo OTP/notif → P30 borrado → P31 confirmar → Completado (`:392-394`).

> Prompt Figma AI original (`:461`):
> `Genera un sistema UI mobile-first en español para Votachain con los módulos y pantallas P1-P31 de este documento. Prioriza J3 Votar (P23 → P24 → P11 → P25 → P26 → P27) y J1 Onboarding. Usa insignias de estado, timeline de recibo en 5 pasos, modal de firma, tablas de padrón y panel de cumplimiento. Estilo limpio, accesible, colores semánticos verde / amarillo / rojo / gris.`

---

## 10. Mapeo backend → VDS (sin inventar tokens)

| Backend (semántico) | VDS Capítulo VI (HEX) | Tipografía / medida VDS |
|---|---|---|
| Verde | `--color-accent-success #059669` | Badge `Inter 12px/600` |
| Amarillo | `--color-accent-warning #D97706` | Badge + texto oscuro |
| Rojo | `--color-accent-danger #DC2626` | Botón peligro texto blanco |
| Gris | `--color-text-secondary #475569` / `--color-border-subtle #E2E8F0` | Caption `14px/400` |
| Marca / primario | `--color-brand-primary #1E3A8A` | H `Outfit`, botones `Inter 16px/600` |
| Fondo / card | `--color-surface-base #F8FAFC` / `#FFFFFF` | Card `radius 10-16px`, `shadow-sm/md/lg` |
| Código / hash | `--font-mono JetBrains Mono 13px` | OTP, `rec-...`, `0x...` |
| Touch / radio | `48x48px`, Radio Card `56px`, bottom-bar `72px` | Solo P11/P25/P26 móvil |

> Nota: el backend no define paleta HEX, fuentes ni espaciados. Todo HEX/font/medida viene del VDS y debe validarse con contraste `4.5:1` antes de declararse final.
