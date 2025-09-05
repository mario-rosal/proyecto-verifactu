#!/usr/bin/env bash
# Backup mínimo de BD Postgres (BFF) + logs/*.jsonl (si existen).
# Requiere: pg_dump, tar, gzip
# Uso: ./scripts/backup/backup.sh [OUT_DIR]
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
STAGING="$OUT_DIR/staging_$TS"
mkdir -p "$STAGING"

DUMP_SQL="$STAGING/verifactu-bff_${TS}.sql"
ARCHIVE="$OUT_DIR/verifactu-bff_backup_${TS}.tar.gz"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] ERROR: pg_dump no encontrado en PATH" >&2
  exit 1
fi

echo "[backup] Ejecutando pg_dump..."
set +e
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump -F p -v -f "$DUMP_SQL" "$DATABASE_URL"
else
  # Requiere PGHOST/PGDATABASE/PGUSER y opcional PGPORT/PGPASSWORD
  [[ -n "${PGHOST:-}" && -n "${PGDATABASE:-}" && -n "${PGUSER:-}" ]] || { echo "[backup] ERROR: faltan PGHOST/PGDATABASE/PGUSER o DATABASE_URL"; exit 1; }
  pg_dump -F p -v -f "$DUMP_SQL"
fi
RC=$?
set -e
if [[ $RC -ne 0 ]]; then
  echo "[backup] ERROR: pg_dump terminó con código $RC" >&2
  exit $RC
fi

[[ -s "$DUMP_SQL" ]] || { echo "[backup] ERROR: dump vacío"; exit 1; }

# Copiar logs si existen
if [[ -d "./logs" ]]; then
  shopt -s nullglob
  LOG_FILES=(./logs/*.jsonl)
  if [[ ${#LOG_FILES[@]} -gt 0 ]]; then
    mkdir -p "$STAGING/logs"
    cp ./logs/*.jsonl "$STAGING/logs/"
    echo "[backup] Copiados ${#LOG_FILES[@]} logs (*.jsonl)."
  else
    echo "[backup] No se encontraron logs *.jsonl (ok)."
  fi
else
  echo "[backup] Carpeta ./logs no existe (ok)."
fi

echo "[backup] Comprimiendo a $ARCHIVE ..."
tar -C "$STAGING" -czf "$ARCHIVE" .
rm -rf "$STAGING"

[[ -s "$ARCHIVE" ]] || { echo "[backup] ERROR: archivo resultante vacío"; exit 1; }

SIZE_KB=$(du -k "$ARCHIVE" | cut -f1)
echo "[backup] ✅ Backup OK → $ARCHIVE (${SIZE_KB} KB)"
