# LOG del proyecto — VeriFactu

> Bitácora única y fuente de verdad para IA y equipo. Mantener breve, factual y actualizada.  
> **Última actualización:** 2025-08-23

---

## North Star (cumplimiento)

- **Inmutabilidad:** `event_log` e `invoice_record` son _append-only_ (triggers en BD).
- **Trazabilidad:** hash SHA-256 encadenado en `invoice_record` (`hash_anterior` → `hash_actual`).
- **Verificabilidad:** PDF con **QR** + leyenda **“VERI\*FACTU”** (pendiente de implementar endpoint `GET /invoices/:id/pdf`).

## TL;DR (para IA)

- Producto: **Compliance as a Service** (Veri\*Factu). **No** somos un ERP.
- Stack: NestJS (TS) + PostgreSQL + TypeORM · n8n + Gemini · UI Vanilla+Tailwind · Electron (printer).
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

## 2025-08-22 — Tests e2e append-only

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

## Bitácora previa (resumen por sprints)

### Sprint 0 — Concepción y estrategia

- Producto: **pasarela de cumplimiento** (CaaS, Veri\*Factu), no facturador.
- Nicho objetivo: **PYMES** con TPV/ERP legacy sin actualización.
- Arquitectura inicial: BFF + Connector AEAT + PostgreSQL + UI; **n8n** como orquestador.

### Sprint 1 — Motor de backend (✅)

- `verifactu-bff` (NestJS): recepción de datos, hashing y persistencia.
- `verifactu-connector`: base de comunicación **SOAP**.
- Decisión: mock del entorno AEAT (`mock-server.js`) para desacoplar desarrollo.

### Sprint 2 — Refactor asíncrono + Onboarding (✅)

- Jobs asíncronos para escalabilidad/UX.
- `index.html` (onboarding) con **polling**.
- Gemini en **n8n** para validación/limpieza de datos.
- Workflows n8n: **Receptor** y **Procesador** de altas.

### Sprint 3 — Dashboard + Flujo de facturación (✅)

- `dashboard.html` conectado al backend; listado de facturas.
- Endpoint BFF para recepción de facturas → Job `INVOICE_SUBMISSION`.
- Workflow n8n: procesa factura, sella en BFF y envía a Connector (simulado).

### Sprint 4 — Autenticación y seguridad (✅)

- Tabla `users`, roles/permisos.
- Endpoints `/register` y `/login` con bcrypt + JWT.
- Dashboard protegido con **AuthGuard**.
- Recuperación de contraseña (pantallas + backend con tokens).

### Sprint 5 — Conector “impresora virtual” (✅)

- Decisión: **Electron** vs agente n8n → gana Electron.
- `verifactu-printer-connector`:
  - UI de configuración + persistencia (`electron-store`).
  - Watcher de carpeta (`chokidar`), envío seguro de PDFs a webhook n8n con API Key.
- Workflow n8n **[Facturación] – 3. Procesador de PDFs**:
  - Recibe PDFs, valida API Key, extrae con OCR/IA y activa flujo principal.

### Sprint 6 — Cumplimiento avanzado (⏳ en curso)

- **Libro de Incidencias**: registro auditable de eventos (base en BFF: entidad `EventLog` y tabla `event_log`).

---

## Próximos pasos (checklist)

- [ ] BFF: desactivar `synchronize` fuera de local; crear migraciones **solo** si añadimos/alteramos columnas en `event_log`.
- [ ] CI: cuando haya primera migración real, hacer **bloqueante** el paso `migration:run` en el job BFF (quitar `|| true`).
- [ ] Connector: definir DTOs/Tipos en `src/aeat/aeat.service.ts` y eliminar `any` (o bajar severidad ESLint temporalmente).
- [ ] Frontend/Electron: añadir `package.json` y scripts `lint`/`test` para activar checks reales en CI.
- [ ] n8n: versionar flujos en `verifactu-flows/*.json` y documentar en `flows/README.md`.
