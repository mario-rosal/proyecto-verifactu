# LOG del proyecto — VeriFactu

> Bitácora única y fuente de verdad para IA y equipo. Mantener breve, factual y actualizada.  
> **Última actualización:** 2025-09-09

---

## North Star (cumplimiento)

- **Inmutabilidad:** `event_log` e `invoice_record` son _append-only_ (triggers en BD).
- **Trazabilidad:** hash SHA-256 encadenado en `invoice_record` (`hash_anterior` → `hash_actual`).
- **Verificabilidad:** PDF con **QR** + leyenda **“VERI*FACTU”** (endpoint BFF de descarga implementado).

## TL;DR (para IA)

- Producto: **Compliance as a Service** (Veri*Factu). **No** somos un ERP.
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

## 2025-09-09 — Electron/BFF — Conector: fix lectura de API Key y verificación de EXE en ZIP
- **Causa raíz:** desajuste de rutas de `userData` → coexistían dos `config.json`:  
  - `%APPDATA%\VeriFactu Connector\config.json` (instalador NSIS copia aquí con `apiKey`, `tenantId`).  
  - `%APPDATA%\verifactu-printer-connector\config.json` (propio de `electron-store`, con `folderPath`).  
  El conector leía la segunda ruta y no encontraba `apiKey`, mostrando el diálogo genérico (“URL del webhook…”).
- **Cambios mínimos aplicados en el conector:**  
  - `main.js`: `app.setName('VeriFactu Connector')` para alinear `app.getPath('userData')` con la ruta donde instala NSIS.  
  - Lectura con *fallback* seguro de `config.json` (ambas rutas), y mensaje de error más claro cuando falta `apiKey`.
  - **Sin cambios** en BD/CI/guards/CORS.
- **Recompilación:** regenerados instaladores **NSIS** y **NSIS Web** con `electron-builder 24.6.3`.
- **BFF (ZIP del dashboard):** confirmado que empaqueta el **EXE más reciente**: hash SHA-256 **idéntico** entre  
  `bin\nsis-web\VeriFactu-Connector-Web-Setup-1.0.0.exe` y el `.exe` extraído del ZIP descargado.
- **Instalador NSIS:** `installer.nsh` ya copia `config.json` desde `$EXEDIR` a `%APPDATA%\VeriFactu Connector\config.json`.  
  Recomendación operativa: ejecutar el Setup **tras descomprimir** el ZIP (evita perder el `config.json`).
- **Resultado validado:** al soltar un PDF en la carpeta vigilada se muestra **“Factura Enviada”** (webhook hardcodeado + `apiKey` válida).

## 2025-09-07 — Pendiente — Hosting público para instalador NSIS Web
- El **Web-Setup** funciona correctamente en local (instala, crea atajos, abre la app y desinstala).
- El dashboard ya genera el **bundle mínimo** (~0.6 MB con `Web-Setup.exe` + `config.json`).
- **Falta**: disponer de un servidor HTTPS público (S3/MinIO o similar) para alojar el paquete `.nsis.7z` que el stub descarga en la instalación.
- **Acción futura**: cuando se disponga de esa URL, actualizar `appPackageUrl` en `package.json` a la dirección definitiva y cambiar el dashboard para servir el bundle web en lugar del instalador completo.


## 2025-09-06 — Docs — Runbook de operación
- Añadido `docs/RUNBOOK.md` (rotación de secrets JWT/tickets, purga manual de tickets, restore de BD, lectura de logs); **sin cambios** en BD/CI/guards. Verificado en local: descarga por ticket **200 OK** y purga automática **PURGED OK**.



## 2025-09-05 — BFF — Purga de temporales: visibilidad

- Servicio `TicketsPurgeService` ahora **siempre** emite un log por ejecución con el formato **`purged N files`** (incluye `N=0`).
- `purgeOnce(dir?, now?)` expuesto como **público** y devuelve el **conteo exacto** de archivos eliminados; sin cambios en guards, CORS ni esquema de BD.
- **Test unitario** `src/api-keys/tickets-purge.service.spec.ts`: usa un directorio temporal aislado, crea archivos que **cumplen/no cumplen** el patrón y con timestamps **expirados/no expirados**; verifica borrado, conteo y **log único** (espía de `Logger`).
- `npm run test` → todas las suites en verde (incluye este spec).

## 2025-09-05 — BFF — E2E críticos de tickets (descarga por ticket)

- **Tests E2E** añadidos: `verifactu-bff/test/tickets.e2e-spec.ts` (sin cambios en producción).
- **Casos cubiertos** (GET `/v1/connector-package/tickets/:token`):
  - Éxito → `200 OK`, `Content-Type: application/zip`, `Content-Length` **exacto** y `> 0`, y **borrado** del ZIP temporal al finalizar.
  - Firma inválida → `401 {"message":"Firma inválida"}`.
  - Token expirado → `401 {"message":"Token expirado"}`.
  - Reuso tras descarga (artefacto ya no existe) → `401 {"message":"Artefacto no disponible"}`.
  - Ruta pública/whitelist (sin JWT/x-api-key) con token malformado → `401 {"message":"Token inválido"}`.
- **Asserts adicionales**: `Content-Length` y inexistencia del archivo en `os.tmpdir()` tras la descarga.
- **Compatibilidad**: se mantiene en verde el test de whitelist previo.
- **Ejecución**: `npm run test:e2e` → **3 suites, 7 tests: todos OK**.
- **Evidencia (código)**: mensajes lanzados por el controller:
  - `throw new UnauthorizedException('Firma inválida'|'Token expirado'|'Token inválido'|'Artefacto no disponible');`

## 2025-09-05 — BFF — Cabeceras de seguridad (helmet)

- **Dependencia** añadida: `helmet` (runtime).
- **`src/main.ts`**: se aplica `helmet` sin tocar CORS existente.
  - **CSP** (`helmet.contentSecurityPolicy`): perfil **dev** laxo (`'unsafe-inline'`, `'unsafe-eval'` para no romper dashboard) y **prod** más estricto.
  - **X-Frame-Options** (`helmet.frameguard`): `DENY` (además de `frame-ancestors 'none'` en CSP).
  - **Referrer-Policy**: `strict-origin-when-cross-origin`.
  - **HSTS** (`helmet.hsts`): **solo en producción/HTTPS**.
- **CORS**: sin cambios (misma whitelist por `CORS_ORIGINS`, mismos headers).
- **Smoke test** en dev (HTTP): `HEAD /v1/healthz` devuelve
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - No aparece `Strict-Transport-Security`.

## 2025-09-05 — Backups & restore mínimo (Windows verificado)

- **Scripts** añadidos: `scripts/backup/backup.ps1` (PowerShell) y `scripts/backup/backup.sh` (bash opcional); **doc**: `docs/RESTORE.md`.
- **Backup** probado en Windows con runtime de pgAdmin 4 (`pg_dump.exe`): genera ZIP con timestamp y **tamaño > 0** y copia `logs/*.jsonl` si existen.
- **Restore** verificado en BD `verifactu_bff_restore_test` con `psql`; **nota**: si aparece `unrecognized configuration parameter "transaction_timeout"`, quitar esa línea del `.sql` antes de ejecutar.
- **Sin cambios** en CI ni esquema de BD; uso de `DATABASE_URL` o variables `PG*` para conexión; `-PgDumpPath` permite apuntar a `pg_dump.exe` del runtime de pgAdmin.

## 2025-09-05 — Implementada rotación de JWT

- BFF: `JwtModule` ahora lee `JWT_SECRET` desde `.env` (se elimina secreto hardcodeado).
- Se añade `JWT_SECRET_NEXT` como opcional en validación de entorno.
- Nueva estrategia de validación: acepta tokens firmados con `JWT_SECRET` y también con `JWT_SECRET_NEXT` durante la ventana de rotación.
- Probado con éxito: login emite JWT válido (`JWT_SECRET`), y `healthz` responde OK con tokens firmados con ambos secretos.

## 2025-09-04 — BFF — Hardening para producción (completado)

- **CORS whitelist por `.env`**: `CORS_ORIGINS=http://localhost:8080`.
  - Verificado:
    - `curl -i -H "Origin: http://localhost:8080" /v1/healthz` → `Access-Control-Allow-Origin: http://localhost:8080`.
    - `curl -i -H "Origin: https://evil.test" /v1/healthz` → **sin** `Access-Control-Allow-Origin`.
- **Descarga por ticket endurecida**:
  - `ApiKeyGuard` whitelistea `GET /(v\d+\/)?connector-package/tickets/:token` (público solo por token).
  - **Rate limiting** activado (cabeceras `X-RateLimit-*` visibles).
  - **Rotación de secreto** de tickets soportada: `DOWNLOAD_TICKET_SECRET` + `DOWNLOAD_TICKET_SECRET_NEXT` (verificación intenta ambos).
  - Evidencia de flujo real:
    - `GET /v1/connector-package/tickets/TESTTOKEN123` → `401 {"message":"Token inválido"}`.
    - Firma con **NEXT** y prueba → `401 {"message":"Artefacto no disponible"}` (firma válida, artefacto no existe).
    - Token firmado con secreto actual **y** artefacto temporal presente → `200 OK`, `Content-Type: application/zip`, descarga de `dummy`, y borrado del temporal (`File exists after download? False`).
- **Logging estructurado** (JSONL por día) + `x-request-id`:
  - Archivo: `logs/app-YYYY-MM-DD.jsonl` (rotación diaria).
  - Ejemplo real:
    ```
    {"time":"...","reqId":"...","method":"GET","url":"/v1/connector-package/tickets/TESTTOKEN123","ip":"::1","tenantId":null,"level":"error","status":401,"duration_ms":2,"error":{"name":"UnauthorizedException","message":"Token inválido"}}
    ```
- **Job de purga**: servicio de limpieza de tickets/ZIPs expirados registrado (ScheduleModule activo).
  - Además del borrado inmediato tras servir, queda limpieza periódica de temporales expirados.
- **Tests e2e** (guard whitelist):
  - Nuevo `test/apikey-whitelist.e2e-spec.ts` valida que la ruta pública **salta** el guard global y responde `401 "Token inválido"` en el controlador (firma errónea), evitando exigir `x-api-key`.
  - `jest.config.js` añadido y `tsconfig.spec.json` ajustado (tipos de Jest) para estabilidad local de pruebas.
- **Otros**:
  - `main.ts`: CORS con whitelist (cuando `CORS_ORIGINS` está definido) y exposición de `x-request-id`.
  - `connector-package.controller`: verificación de ticket con HMAC SHA-256 y **rotación** (`*_NEXT`), throttling por endpoint.
- **Variables de entorno relevantes**:
  - `CORS_ORIGINS` (coma-separado).
  - `DOWNLOAD_TICKET_SECRET` y opcional `DOWNLOAD_TICKET_SECRET_NEXT`.
  - (Operativa de rotación de JWT definida; pendiente consolidar uso de `JWT_SECRET(_NEXT)` en todos los guards/estrategias si no lo estuvieran ya).
- **Evidencia de cabeceras** observadas:
  - `X-RateLimit-Limit: 10`, `X-RateLimit-Remaining: 9` en `GET /v1/connector-package/tickets/...`.
  - `Access-Control-Allow-Origin: http://localhost:8080` en origin permitido; ausencia en `https://evil.test`.

## 2025-09-03 — BFF/Electron — ZIP mínimo + tickets de descarga nativos (finalizado)

- **ZIP del conector**: ahora incluye **solo** `config.json` + `VeriFactu-Connector-Setup-*.exe` (sin `win-unpacked`). Tamaño observado estable **~75–79 MB** con `Content-Length` correcto.
- **Endpoints**:
  - `POST /v1/connector-package/tickets` (JWT) → genera API Key + crea ZIP temporal en `os.tmpdir()` y devuelve `{ url, filename, size, expiresAt }`.
  - `GET /v1/connector-package/tickets/:token` → valida token HMAC (**SHA-256**) con expiración (**10 min**) y sirve el ZIP con `Content-Disposition` + `Content-Length`; borra el artefacto temporal al finalizar.
- **UI** (`dashboard.html`): el botón **“Descargar Conector”** primero pide el **ticket** y luego navega a la **URL GET** para obtener **progreso nativo del navegador** / “Guardar como…”.
- **Seguridad**:
  - Token firmado con `DOWNLOAD_TICKET_SECRET` (HMAC SHA-256) + `exp`. Validación con `timingSafeEqual`.
  - `ApiKeyGuard` permite **solo** el `GET /v1/connector-package/tickets/:token` sin JWT (el token actúa como credencial efímera). Resto de rutas siguen protegidas por **JWT o x-api-key**.
- **Logging**: `event_log` registra `CONFIG_UPDATE` `{ action: "CONNECTOR_PACKAGE_GENERATED" }` y `{ ticket: true }` cuando aplica.
- **Evidencia** (sesión):
  - `POST /v1/connector-package` → `Content-Length: 78602008` / ZIP con **2 ficheros** (`config.json` + `.exe`).
  - `POST /v1/connector-package/tickets` → devuelve `url` firmada y `size: 78602009`.
  - `GET /v1/connector-package/tickets/:token` → `200 OK` con `Content-Length: 78602009` y descarga correcta por GET.
- **Notas**:
  - `win-unpacked/` puede seguir existiendo **en disco local** tras `electron-builder`, pero **no** se incluye en el ZIP distribuido.
  - Variable de entorno: **`DOWNLOAD_TICKET_SECRET`** (default dev: `change-me-dev-secret`).
  - Próximo opcional: evaluar **`nsis-web`** para reducir aún más el tamaño inicial (stub).

## 2025-09-03 — BFF/Dashboard — Descarga “Guardar como…” + progreso (estabilizada)

- **Endpoint**: `POST /v1/connector-package` (JWT). Respuesta `application/zip` con `Content-Disposition` (nombre de archivo) y **`Content-Length`** (descarga determinista).
- **CORS**: `Access-Control-Allow-Headers: Authorization, Content-Type` y `Access-Control-Expose-Headers: Content-Disposition`; preflight `OPTIONS` verificado (204).
- **Dashboard**: emplea **File System Access API** cuando está disponible → diálogo **“Guardar como…”** y escritura por _streaming_ con progreso en el botón. _Fallback_ universal a Blob + `<a> download</a>`.
- **Verificación**: descarga reproducible con `curl` (ZIP ~183–187 MB recibido completo).
- **Sin cambios de contrato**: el botón sigue apuntando a `/v1/connector-package`; no se requieren ajustes de rutas.
- **Pendiente (tamaño)**: instalador Electron voluminoso. Próximo trabajo propuesto: `nsis-web` (web installer) o recorte de artefactos incluidos. No afecta a la **estabilidad** de la descarga actual.

## 2025-09-01 — BFF — Paquete del conector (MVP descargable)

- Endpoint **POST /connector-package** (JWT-only): genera API Key dedicada y devuelve un **ZIP** con `config.json` `{apiKey, tenantId}` + binarios.
- Incluye instalador Windows **`bin/VeriFactu-Connector-Setup-1.0.0.exe`** (si existe en `verifactu-printer-connector/bin`); si no, agrega `bin/README.txt`.
- `event_log`: registra `CONFIG_UPDATE` con `{action:"API_KEY_CREATED"}` y `{action:"CONNECTOR_PACKAGE_GENERATED"}` (tenant_id=1).
- BFF: dependencia **archiver** añadida; uso correcto `import * as archiver` + `archiver.create(...)`; resolución de rutas robusta hacia `verifactu-printer-connector/bin`.
- Conector: añadido **electron-builder** (NSIS), `directories.output=bin`, `artifactName=VeriFactu-Connector-Setup-${version}.${ext}`; fijada versión **24.6.3** por estabilidad en Windows.
- QA: ZIP ~75 MB con `.exe` + `config.json` correcto, verificado con `curl` y apertura local.

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

- **Endpoint BFF** de descarga del PDF oficial: `GET /invoices/:id/pdf` → `200 OK`, `Content-Type: application/pdf`, `Content-Disposition: inline; filename="verifactu-<serie>-<numero>.pdf"`.
- **Composición PDF A4** con `pdf-lib` + `qrcode`:
  - Cabecera/pie con leyenda **“VERI*FACTU — Factura verificable en la sede electrónica de la AEAT”**.
  - **QR** con URL:
    `https://verifactu.local/verify?nif=<emisor_nif>&serie=<serie>&numero=<numero>&fecha=<YYYY-MM-DD>&total=<importe_total_2d>&hash=<hash_actual>`.
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