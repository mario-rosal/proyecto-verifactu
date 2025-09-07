# Runbook de operación — Veri*Factu BFF

**Ámbito:** procedimientos para *rotar secretos sin downtime*, *purgar tickets temporales*, *restaurar backups* y *leer logs*.  
**Stack:** NestJS + TypeORM + PostgreSQL · n8n · Electron.  
**Fuente de verdad:** `docs/LOG.md` (priorizar lo más reciente) y `docs/DECISIONS.md`.  
**No romper:** CORS (whitelist por `.env`), guards globales, CI. **No** tocar esquema de BD.

---

## 0) Prerrequisitos

- Acceso a la máquina del **BFF** (Windows o Linux) y a la **BD PostgreSQL**.  
- Variables de entorno gestionadas *fuera* del repo (no commitear secretos).  
- Logs del BFF en `verifactu-bff/logs/app-YYYY-MM-DD.jsonl` (formato JSONL).

---

## 1) Rotar secretos sin downtime (JWT y Tickets)

El BFF soporta **rotación dual** (`*_NEXT`) para transición segura:

- **JWT:** `JWT_SECRET` y `JWT_SECRET_NEXT`  
- **Tickets de descarga:** `DOWNLOAD_TICKET_SECRET` y `DOWNLOAD_TICKET_SECRET_NEXT`

> Objetivo: activar el nuevo secreto con `*_NEXT`, validar que se aceptan tokens firmados con ambos, **promocionar** y retirar el antiguo sin cortar sesiones.

### 1.1 Pasos (válido para JWT y para Tickets)

1. **Preparar nuevo secreto**
   - Genera un secreto fuerte (32+ bytes). Ejemplos:
     - **PowerShell (Windows):**
       ```powershell
       $New = [Convert]::ToBase64String((1..48 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))
       $New
       ```
     - **bash (Linux/macOS):**
       ```bash
       openssl rand -base64 48
       ```

2. **Cargar `*_NEXT` en todas las instancias**
   - **Windows (servicio/PM2, ejemplo):**
     ```powershell
     # JWT (ejemplo)
     setx JWT_SECRET_NEXT  "<PEGAR_AQUI_EL_SECRETO_NUEVO>"
     # Tickets (ejemplo)
     setx DOWNLOAD_TICKET_SECRET_NEXT "<PEGAR_AQUI_EL_SECRETO_NUEVO>"
     # Reinicio en rolling (uno por vez) para aplicar entorno
     # (adaptar a tu gestor: pm2 restart bff, nssm restart, iisreset, etc.)
     ```
   - **bash:**
     ```bash
     # export temporal (sesión actual) — en producción usa tu secret manager
     export JWT_SECRET_NEXT="<NEW>"
     export DOWNLOAD_TICKET_SECRET_NEXT="<NEW>"
     # Reinicio en rolling de la app (systemd/pm2/docker según despliegue)
     ```

3. **Verificar aceptación del secreto NEXT**
   - **JWT:** genera un JWT con el NEXT y accede a una ruta protegida.
     - En `verifactu-bff/` existe `sign_jwt_next.js`:
       ```bash
       node sign_jwt_next.js    # imprime un JWT firmado con JWT_SECRET_NEXT
       ```
       Usa ese token para llamar a alguna ruta protegida (ejemplo genérico):
       ```bash
       curl -H "Authorization: Bearer <TOKEN_NEXT>" http://localhost:3001/v1/dashboard
       ```
       Debe responder 200/JSON válido (según permisos del usuario).
   - **Tickets:** usa `sign_ticket_next.js` y prueba la **ruta whitelisteada**:
     ```bash
     node sign_ticket_next.js                   # imprime un <TOKEN_NEXT>
     curl -v "http://localhost:3001/v1/connector-package/tickets/<TOKEN_NEXT>" -o /tmp/payload.zip
     ```
     Debe descargar un ZIP válido.  
     > La whitelist permite `GET /v1/connector-package/tickets/:token` sin API key.

4. **Promocionar y retirar el viejo**
   - Copia el valor de `*_NEXT` a la variable **principal** y **vacía** `*_NEXT`:
     - **PowerShell (Windows):**
       ```powershell
       # JWT
       setx JWT_SECRET "<MISMO_VALOR_QUE_JWT_SECRET_NEXT>"
       setx JWT_SECRET_NEXT ""
       # Tickets
       setx DOWNLOAD_TICKET_SECRET "<MISMO_VALOR_QUE_DOWNLOAD_TICKET_SECRET_NEXT>"
       setx DOWNLOAD_TICKET_SECRET_NEXT ""
       ```
     - **bash:**
       ```bash
       export JWT_SECRET="$JWT_SECRET_NEXT"; export JWT_SECRET_NEXT=""
       export DOWNLOAD_TICKET_SECRET="$DOWNLOAD_TICKET_SECRET_NEXT"; export DOWNLOAD_TICKET_SECRET_NEXT=""
       ```
   - **Reinicia en rolling** otra vez para aplicar cambios.

5. **Verificación final**
   - JWT con script actual:
     ```bash
     node sign_jwt_next.js    # generar y probar con el secreto vigente
     ```
   - Tickets con script **NOW**:
     ```bash
     node sign_ticket_now.js
     curl -v "http://localhost:3001/v1/connector-package/tickets/<TOKEN_NOW>" -o /tmp/payload.zip
     ```

**Checklist de éxito**
- [ ] Tokens firmados con **NEXT** funcionaron antes de la promoción.  
- [ ] Tras la promoción, tokens firmados con el **nuevo actual** funcionan.  
- [ ] `*_NEXT` quedó vacío.  
- [ ] No hubo downtime (rolling OK).

---

## 2) Purga **manual** de tickets temporales

Contexto: los ZIP se crean en `os.tmpdir()` con patrón  
`verifactu-connector-<tenantDigits>-<timestamp>.zip`.

El servicio `TicketsPurgeService`:
- Ejecuta una purga en **onModuleInit** y luego **cada minuto** (`@Interval(60_000)`).
- Siempre registra un log con el formato **`"purged N files"`**.

### 2.1 Opciones de purga manual

**A) Reinicio controlado del BFF (dispara la purga inmediata)**
1. Reinicia **en rolling** el proceso del BFF.  
2. Verifica en los logs del día que aparece el mensaje:
   - **PowerShell (Windows):**
     ```powershell
     Get-Content .\verifactu-bff\logs\app-$(Get-Date -Format yyyy-MM-dd).jsonl |
       Where-Object { $_ -match '"message":"purged ' }
     ```
   - **bash:**
     ```bash
     LOG="verifactu-bff/logs/app-$(date +%F).jsonl"
     grep -F '"message":"purged ' "$LOG"
     ```

**B) Esperar a la purga periódica (≈1 minuto)**
1. Espera 60–70s.  
2. Revisa logs como en (A).

**C) Limpieza manual (si se desea forzar sin reinicio)**
> **Nota:** preferir (A) o (B). La manual es auxiliar y no emite el log `"purged N files"` desde el servicio.
- **PowerShell:**
  ```powershell
  $tmp=[IO.Path]::GetTempPath()
  Get-ChildItem $tmp -Filter 'verifactu-connector-*-*.zip' | Remove-Item -Force
  ```
- **bash:**
  ```bash
  find "$(python - <<< 'import tempfile,sys;print(tempfile.gettempdir())')" \
       -maxdepth 1 -type f -name 'verifactu-connector-*-*.zip' -delete
  ```

**Checklist de éxito**
- [ ] Aparece al menos una línea de log con `"message":"purged N files"` (N puede ser 0).  
- [ ] En caso de purga esperada, los ZIP expirados ya no están en `os.tmpdir()`.

---

## 3) Restore de BD y copia de logs

Sigue **exactamente** `docs/RESTORE.md`. Resumen operativo:
1. Define **`DATABASE_URL`** (o variables `PG*`).  
2. Descomprime el backup en `restore_tmp/`.  
3. Crea la BD si no existe.  
4. `psql -v ON_ERROR_STOP=1 -f <dump>.sql`.  
5. Verifica con `SELECT 1;` y `\dt` (debes ver `event_log` e `invoice_record`).

> Los `logs/*.jsonl` que venían en el backup son archivos (no BD). Cópialos manualmente si quieres preservarlos.

**Checklist de éxito**
- [ ] `psql -c "SELECT 1"` OK.
- [ ] `\dt` muestra tablas del BFF (incl. `event_log`, `invoice_record`).  
- [ ] La app levanta y `GET /healthz` responde 200.

---

## 4) Lectura e interpretación de logs (`logs/*.jsonl`)

Formato: **JSON por línea** (JSONL). Campos típicos: `timestamp`, `level`, `context`, `message`, `meta` (puede variar).

### 4.1 Consultas rápidas

- **Todos los mensajes de purga del día (Windows):**
  ```powershell
  $today = Get-Date -Format yyyy-MM-dd
  Get-Content ".\verifactu-bff\logs\app-$today.jsonl" |
    ConvertFrom-Json |
    Where-Object { $_.message -like 'purged * files' } |
    Select-Object timestamp,level,context,message
  ```

- **Todos los mensajes de purga del día (bash + jq):**
  ```bash
  LOG="verifactu-bff/logs/app-$(date +%F).jsonl"
  jq -c 'select(.message|test("^purged [0-9]+ files$")) | {timestamp,level,context,message}' "$LOG"
  ```

- **Errores del día (Windows):**
  ```powershell
  Get-Content ".\verifactu-bff\logs\app-$(Get-Date -Format yyyy-MM-dd).jsonl" |
    ConvertFrom-Json |
    Where-Object { $_.level -match 'error|warn' } |
    Select-Object timestamp,level,context,message
  ```

- **Errores del día (bash + jq):**
  ```bash
  LOG="verifactu-bff/logs/app-$(date +%F).jsonl"
  jq -c 'select(.level=="error" or .level=="warn") | {timestamp,level,context,message}' "$LOG"
  ```

### 4.2 Consejos de inspección
- Filtra por `context` para centrarte en un módulo (`TicketsPurgeService`, `AuthService`, etc.).  
- Si hay `requestId` en `meta`, úsalo para correlacionar peticiones.

---

## 5) Anexos

### 5.1 Hard-stops (si ocurre, detén y consulta el LOG)
- CORS: **no** cambiar configuración de orígenes; edita `.env` y despliega **en rolling**.  
- BD: **no** realizar migraciones que alteren esquema sin aprobación.  
- CI: **no** añadir jobs ni modificar bloqueos sin consenso.

### 5.2 Referencias internas
- `docs/LOG.md` — decisiones y últimos cambios.  
- `docs/RESTORE.md` — procedimiento detallado de restore.  
- `verifactu-bff/sign_ticket_now.js` / `sign_ticket_next.js` — verificación de secretos de tickets.  
- `verifactu-bff/sign_jwt_next.js` — verificación de secreto NEXT para JWT.

---

## 6) Listas de verificación rápidas

**Rotación de secretos (JWT/Tickets)**
1. Generar **NEXT** seguro en todas las instancias.  
2. Verificar tokens firmados con **NEXT** (JWT y/o ticket).  
3. Promocionar (`*_NEXT` → actual) y **vaciar** `*_NEXT`.  
4. Verificar tokens **actuales**.  
5. Confirmar estabilidad en logs y monitoreo.

**Purga manual**
1. Reiniciar en rolling → revisar `"purged N files"` (puede ser N=0).  
2. (Alt) esperar 60s y revisar logs.  
3. (Alt) limpieza manual en `os.tmpdir()` si urge (sin log del servicio).
