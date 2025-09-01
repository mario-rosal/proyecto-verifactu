# LOG del proyecto — VeriFactu

&gt; Bitácora única y fuente de verdad para IA y equipo. Mantener breve, factual y actualizada.  
&gt; **Última actualización:** 2025-09-01

---

## North Star (cumplimiento)

- **Inmutabilidad:** `event_log` e `invoice_record` son _append-only_ (triggers en BD).
- **Trazabilidad:** hash SHA-256 encadenado en `invoice_record` (`hash_anterior` → `hash_actual`).
- **Verificabilidad:** PDF con **QR** + leyenda **“VERI*FACTU”** (endpoint BFF de descarga implementado).

## TL;DR (para IA)

- Producto: **Compliance as a Service** (Veri*Factu). **No** somos un ERP.
- Stack: NestJS (TS) + PostgreSQL + TypeOrm · n8n + Gemini · UI Vanilla+Tailwind · Electron (printer).
- Monorepo: https://github.com/mario-rosal/proyecto-verifactu
- CI: **ligero** (lint/type/build no bloquean; e2e desactivados por ahora).
- Salud BFF: `GET /healthz`.
- `event_log` (BD snake_case) registra acciones; `invoice_record` guarda facturas selladas (NIF, serie, número, fecha, importes, **hashes**).

## Contrato de datos para el PDF

Usar **tal cual** de `invoice_record`: `emisor_nif`, `serie`, `numero`, `fecha_emision`, `importe_total`, `hash_actual`  
(opcional visibles: `base_total`, `cuota_total`).

## Reglas de uso del LOG

1. **Una línea por cambio** (fecha + resumen + PR/commit si aplica).
2. Si cambia una decisión → ADR en `docs/DECISIONS.md`.
3. La IA debe leer **este LOG** (y `DECISIONS.md`) antes de proponer cambios.  
   Prioriza siempre lo **más reciente** de esta bitácora.

---

## Entradas (más reciente primero)

### 2025-09-01 — DASH-APIKEYS-UI (gestión en dashboard + cleanup BD)
- Dashboard (`dashboard.html`): nueva sección **API Keys** (listado, crear, revocar) usando `/api-keys` con JWT.
- Modal al crear: muestra la clave completa **solo una vez**; listado muestra solo prefijo y metadatos.
- Acciones de revocación actualizan estado sin recargar toda la página; errores visibles al usuario.
- Backend sin cambios de rutas (mantiene `/api-keys`), guardia JWT ya activa.
- Limpieza de datos en BD: queda **solo tenant 1**, usuario `mrcompa@gmail.com` y la API Key general (`b4b13628…`).

### 2025-08-31 — BFF-APIKEYS (endpoints y logging)
- BFF: módulo `api-keys/` con `GET/POST/DELETE /api-keys` (uso desde dashboard con JWT; guardia global JWT|x-api-key sigue activo).
- Creación: genera clave aleatoria (hex), guarda `key_hash` (SHA-256) y `key_prefix` (8); **devuelve la clave completa solo una vez**.
- Listado: devuelve solo metadatos (`id`, `keyPrefix`, `isActive`, `createdAt`, `lastUsedAt`), **no** la clave.
- Revocación: `is_active=false`.
- `event_log`: registra `CONFIG_UPDATE` con `details.action` = `API_KEY_CREATED` / `API_KEY_REVOKED` y **tenant_id** informado.
- Sin cambios de esquema ni de CI.

### 2025-08-31 — Cierre Sprint “flujo completo de factura con PDF oficial”

- ✅ Flujo extremo a extremo validado: Webhook (n8n) → OCR/IA → Job `INVOICE_SUBMISSION` → BFF (sellado/hash) → Connector AEAT (mock) → dashboard.
- ✅ **PDF oficial con sello + leyenda VERI*FACTU + QR** generado/servido por el BFF y descargable desde el dashboard.
- ✅ Binario PDF preservado entre subflujos de n8n (empaquetado `_pdf.b64` → reinyectado antes de estampar).
- ✅ Estado visible en dashboard a partir de eventos (`AEAT_CONFIRMED` en `event_log`); BD se mantiene append-only.
- ✅ Validación de hash encadenado y trazabilidad; sin migraciones ni cambios de CI.

### 2025-08-26 — PDF oficial con QR + “VERI*FACTU” (BFF + Dashboard) — **CONSOLIDADO**

- **Endpoint BFF** de descarga del PDF oficial: `GET /invoices/:id/pdf` → `200 OK`, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="verifactu-&lt;serie&gt;-&lt;numero&gt;.pdf"`.
- **Composición PDF A4** con `pdf-lib` + `qrcode`:
  - Cabecera/pie con leyenda **“VERI*FACTU — Factura verificable en la sede electrónica de la AEAT”**.
  - **QR** con URL:
    `https://verifactu.local/verify?nif=&lt;emisor_nif&gt;&serie=&lt;serie&gt;&numero=&lt;numero&gt;&fecha=&lt;YYYY-MM-DD&gt;&total=&lt;importe_total_2d&gt;&hash=&lt;hash_actual&gt;`.
  - **hash_actual** impreso de forma visible.
- **Flujo n8n**: al sellar, invoca el estampado y deja el PDF disponible; el dashboard muestra el botón de **Descargar Factura VERI*FACTU (PDF)**.
- **Errores**: `404` si no existe el `invoice_record`; `422` si existe pero no tiene `hash_actual`.
- **Alcance**: sin migraciones, sin cambios de guards ni de CI.

### 2025-08-26 — Fix “seal-invoice”

- Validaciones y coerción numérica en BFF; ajuste en n8n para `numero_factura` con guion; `Job` actualiza a `COMPLETED`/`FAILED`.

### 2025-08-26 — Fase B — Onboarding: Conector Electron + n8n (completado)

- Conector **lee/guarda** `config.json` (API key + carpeta), arranca watcher y envía PDFs a n8n (`x-api-key` normalizada con `trim()`).
- Incidencias resueltas: `403 Forbidden` (falta header), `ERR_INVALID_CHAR` por saltos de línea en la key, `ECONNREFUSED` por BFF caído.
- Nota: posible condición de “archivo en escritura” en Windows; pendiente `awaitWriteFinish` + reintentos (no aplicado en repo).

### 2025-08-25 — End-to-end Onboarding con ApiKeyGuard y front sin API-Key

- **ApiKeyGuard global** con lógica **JWT OR x-api-key**:
  - Permite sin API key: `OPTIONS`, `/healthz`, `POST /v1/auth/login`, `GET /v1/jobs/:id`.
  - Si llega `Authorization: Bearer ...`, deja pasar (JWT se valida por su guard/estrategia).
  - Si no hay JWT, exige `x-api-key` y resuelve `tenant` vía `AuthService.validateApiKey`.
- **Front** (`index.html`, `login.html`, `dashboard.html`): se quita la `x-api-key` hardcodeada; el navegador usa **solo JWT**.
- **n8n** mantiene `x-api-key` (server-to-server). No se exponen secrets al front.
- **Entidad `ApiKey`** alineada a BD (sin columnas no existentes `type`, `expires_at`).
- **AuthService**:
  - `validateApiKey` ya no depende de columnas inexistentes.
  - `tenantId` devuelto como `string` (evita TS2322).
- **Sin migraciones** ni cambios de CI. Nota: para expiración real de API keys, futura migración con `expires_at`.

### 2025-08-22 — Tests e2e append-only

- E2E valida que UPDATE/DELETE están bloqueados por triggers en `event_log` e `invoice_record` (usa fila existente o inserta mínima válida).

### 2025-08-22 — Alineación con tabla existente `event_log`

- BFF: la entidad `EventLog` mapea a la tabla real **`event_log`** (cols: `id`, `tenant_id`, `event_type`, `details`, `created_at`).
- `AppService.logEvent(...)` persiste usando **`tenantId`**, **`eventType`**, **`details`** (se elimina el uso de objetos `tenant`).
- Se descarta la migración propuesta para una tabla `event_logs` (plural) para evitar duplicidades; futuras migraciones se harán sobre **`event_log`** existente.
- CI BFF se mantiene endurecido; `/healthz` + e2e en verde.

### 2025-08-22 — Consolidación y CI

- Repo: monorepo creado, `.gitignore` y limpieza de repos anidados.
- CI (`.github/workflows/ci-verifactu.yml`):
  - Frontend/Electron: el pipeline **salta** Node si no hay `package.json`.
  - Connector: lint/types/tests **no bloquean** (solo anotaciones).
  - **BFF**: lint + typecheck + **e2e** bloquean (portero activo).
- Seguridad CI: `main` protegida con “Require status checks to pass”.
- BFF:
  - `health` module + `GET /healthz` (sonda DB con `DataSource.query('SELECT 1')`).
  - Test e2e (`jest` + `@nestjs/testing` + `supertest`) en `test/health.e2e-spec.ts`.
  - `AuthModule` exporta `AuthService` y registra `ApiKeyGuard` global (permite `/healthz` sin API key).
  - **EventLog** entidad creada (campos arriba) y persistencia ajustada.

---

## Bitácora previa (resumen)

 - Sprint 0–1: Cimientos y mock AEAT (`mock-server.js`); BFF + Connector iniciales.
 - Sprint 2: Refactor asíncrono (Jobs) + onboarding en n8n con IA; UI de registro con polling.
 - Sprint 3: Dashboard en tiempo real; flujo de `INVOICE_SUBMISSION` completo vía n8n.
 - Sprint 4: Autenticación JWT + roles; dashboard protegido; recuperación de contraseña.
 - Sprint 5: Conector **Electron** (impresora virtual) con `chokidar` + `electron-store`.
 - Sprint 6: Cumplimiento avanzado: `event_log` + reglas append-only.

---
