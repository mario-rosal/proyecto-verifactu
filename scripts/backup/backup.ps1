#requires -version 5.1
<#
.SYNOPSIS
  Backup mínimo de la BD Postgres (BFF) + copia de logs/*.jsonl (si existen).
  Entorno local Windows. Requiere pg_dump en PATH o ruta provista.

.USO
  powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup.ps1 [-OutDir .\backups] [-PgDumpPath pg_dump]

.CONEXIÓN
  Usa $env:DATABASE_URL directamente si está definido.
  Si no, usa PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD del entorno.
  (No se lee .env; exporta las PG* o DATABASE_URL antes de ejecutar.)
#>
[CmdletBinding()]
param(
  [string]$OutDir = ".\backups",
  [string]$PgDumpPath = "pg_dump"
)

function Fail($msg) {
  Write-Host "[backup] ERROR: $msg" -ForegroundColor Red
  exit 1
}

function Check-Command([string]$cmd) {
  $which = (Get-Command $cmd -ErrorAction SilentlyContinue)
  return $null -ne $which
}

Write-Host "[backup] Iniciando backup de Postgres + logs (*.jsonl)..."

if (!(Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$staging = Join-Path $OutDir "staging_$ts"
New-Item -ItemType Directory -Path $staging | Out-Null

$dumpSql = Join-Path $staging "verifactu-bff_$ts.sql"
$archive = Join-Path $OutDir "verifactu-bff_backup_$ts.zip"

# Verificación de pg_dump
if (-not (Check-Command $PgDumpPath)) {
  Fail "pg_dump no encontrado. Ajusta -PgDumpPath o agrega pg_dump al PATH."
}

# Construye el comando de dump
$pgArgs = @()
if ($env:DATABASE_URL) {
  $pgArgs += @("$($env:DATABASE_URL)")
} else {
  $requiredVars = @("PGHOST","PGDATABASE","PGUSER")
  foreach ($required in $requiredVars) {
    $val = [System.Environment]::GetEnvironmentVariable($required)
    if ([string]::IsNullOrEmpty($val)) { Fail "Variable de entorno $required no definida ni hay DATABASE_URL." }
  }
  # Nota: pg_dump usará PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE del entorno
}
$pgArgs = @("-F","p","-v","-f",$dumpSql) + $pgArgs

Write-Host "[backup] Ejecutando pg_dump..."
try {
  & $PgDumpPath @pgArgs 2>&1 | Tee-Object -Variable DumpOutput | Write-Host
  if ($LASTEXITCODE -ne 0) { Fail "pg_dump terminó con código $LASTEXITCODE." }
} catch {
  Fail "Excepción al ejecutar pg_dump: $($_.Exception.Message)"
}

if (!(Test-Path -LiteralPath $dumpSql) -or ((Get-Item $dumpSql).Length -le 0)) {
  Fail "El archivo SQL no se generó o está vacío: $dumpSql"
}

# Copia logs/*.jsonl si existen
$logsDir = ".\logs"
if (Test-Path -LiteralPath $logsDir) {
  $logFiles = Get-ChildItem -Path $logsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue
  if ($logFiles.Count -gt 0) {
    $destLogs = Join-Path $staging "logs"
    New-Item -ItemType Directory -Path $destLogs | Out-Null
    foreach ($f in $logFiles) {
      Copy-Item -LiteralPath $f.FullName -Destination $destLogs
    }
    Write-Host "[backup] Copiados $($logFiles.Count) logs (*.jsonl)."
  } else {
    Write-Host "[backup] No se encontraron logs *.jsonl (ok)."
  }
} else {
  Write-Host "[backup] Carpeta .\logs no existe (ok)."
}

# Comprimir staging a ZIP
Write-Host "[backup] Comprimiendo a $archive ..."
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -Force

# Limpieza de staging
Remove-Item -LiteralPath $staging -Recurse -Force

# Verificación final
if (!(Test-Path -LiteralPath $archive)) { Fail "No se creó el ZIP final." }
$size = (Get-Item $archive).Length
if ($size -le 0) { Fail "El ZIP existe pero su tamaño es 0 bytes." }

Write-Host "[backup] ✅ Backup OK → $archive ($([Math]::Round($size/1KB,2)) KB)"
exit 0
