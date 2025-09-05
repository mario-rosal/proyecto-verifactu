# RESTORE — Veri*Factu BFF (PostgreSQL)

**Objetivo:** restaurar una copia realizada con `scripts/backup/backup.ps1` (Windows) o `scripts/backup/backup.sh` (bash).

## 1) Preparación

1. Instala PostgreSQL (incluye `psql`, `pg_dump`, `createdb`).
2. Exporta variables de entorno **(elige una de estas dos opciones)**:
   - **Opción A (recomendada):** `DATABASE_URL`  
     Ejemplo:  
     - Windows (PowerShell):  
       ```powershell
       $env:DATABASE_URL = "postgres://USER:PASSWORD@HOST:5432/DBNAME"
       ```
     - bash:  
       ```bash
       export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME"
       ```
   - **Opción B:** variables PG*  
     `PGHOST`, `PGPORT` (opcional), `PGDATABASE`, `PGUSER`, `PGPASSWORD`.

> **Nota:** el `.env` del BFF contiene secretos de app (JWT, tickets). **No** provee credenciales de BD. Debes definir `DATABASE_URL` o las `PG*` en tu entorno antes de restaurar.

## 2) Descomprimir el backup

Localiza tu archivo de backup (ejemplos):
- Windows: `backups\verifactu-bff_backup_YYYYMMDD_HHMMSS.zip`
- Linux/macOS: `backups/verifactu-bff_backup_YYYYMMDD_HHMMSS.tar.gz`

Descomprime en una carpeta temporal (p. ej. `restore_tmp/`):

- **Windows (ZIP):**
  1. Explorar → botón derecho → *Extraer todo…*, o  
  2. PowerShell:
     ```powershell
     $zip = ".\backups\verifactu-bff_backup_YYYYMMDD_HHMMSS.zip"
     Expand-Archive -Path $zip -DestinationPath .\restore_tmp -Force
     ```
- **bash (TAR.GZ):**
  ```bash
  mkdir -p restore_tmp
  tar -C restore_tmp -xzf backups/verifactu-bff_backup_YYYYMMDD_HHMMSS.tar.gz
  ```

Tras descomprimir verás un archivo `verifactu-bff_YYYYMMDD_HHMMSS.sql` y, opcionalmente, `logs/*.jsonl`.

## 3) Crear la base de datos (si no existe)

Elige **un nombre de BD** (ej.: `verifactu_bff`) y créala:

- **Windows (PowerShell):**
  ```powershell
  createdb verifactu_bff
  # Si falla por existir, ignora el error o usa:
  # psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE verifactu_bff" || Write-Host "La BD ya existe (ok)"
  ```
- **bash:**
  ```bash
  createdb verifactu_bff || echo "La BD ya existe (ok)"
  ```

> Si usas `DATABASE_URL`, asegúrate de que el nombre al final de la URL coincide con la BD creada.

## 4) Restaurar el dump (formato SQL plano)

Apunta al archivo `.sql` descomprimido:

- **Windows (PowerShell):**
  ```powershell
  $sql = ".\restore_tmp\verifactu-bff_YYYYMMDD_HHMMSS.sql"
  psql -v ON_ERROR_STOP=1 -f $sql
  ```
- **bash:**
  ```bash
  SQL="./restore_tmp/verifactu-bff_YYYYMMDD_HHMMSS.sql"
  psql -v ON_ERROR_STOP=1 -f "$SQL"
  ```

Esto ejecuta el SQL contra la BD indicada por `DATABASE_URL` o las `PG*`.

## 5) Verificación rápida

Comprueba conectividad y una tabla clave:

```bash
psql -c "SELECT 1;"
psql -c "\dt"
```

Deberías ver el listado de tablas del BFF (incluyendo `event_log` y `invoice_record`).

## 6) Notas operativas

- **Orden exacto:** 1) definir credenciales (`DATABASE_URL` o PG*), 2) descomprimir backup, 3) crear BD si no existe, 4) `psql -f dump.sql`.  
- **Logs:** los `logs/*.jsonl` del backup son solo copia de seguridad de archivos —no se restauran en la BD—. Copia manualmente si quieres preservarlos.
- **Errores comunes:**
  - `psql: error: connection refused` → revisar host/puerto/firewall y credenciales.  
  - `relation already exists` → el SQL puede contener CREATEs; considera limpiar antes o usar una BD vacía.  
  - `permission denied` → tu usuario no tiene permisos para crear objetos; usa un rol con privilegios adecuados.
