param(
  [Parameter(Mandatory = $true)]
  [string]$BackupZip,

  [string]$ProjectRoot = "C:\SmartAssistance",

  [switch]$RestoreProjectFiles,

  [switch]$RestoreStorage,

  [switch]$SkipSafetyBackup
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-DockerEnv {
  param(
    [string]$Container,
    [string]$Key
  )

  return ((docker exec $Container printenv $Key) -join "").Trim()
}

if (!(Test-Path -LiteralPath $BackupZip)) {
  throw "Backup non trovato: $BackupZip"
}

$tempDir = Join-Path $env:TEMP ("smartassistance-restore-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
  Write-Step "Estrazione backup"
  Expand-Archive -Path $BackupZip -DestinationPath $tempDir -Force

  $manifestPath = Join-Path $tempDir "backup-manifest.json"

  if (Test-Path -LiteralPath $manifestPath) {
    Write-Host "Manifest trovato:" -ForegroundColor DarkCyan
    Get-Content -LiteralPath $manifestPath | Write-Host
  } else {
    Write-Host "Manifest non trovato. Procedo con ricerca SQL." -ForegroundColor Yellow
  }

  $sqlFile = Get-ChildItem -Path $tempDir -Recurse -Filter "*.sql" | Select-Object -First 1

  if (!$sqlFile) {
    throw "Nessun file SQL trovato nel backup"
  }

  Write-Step "Controllo container PostgreSQL"
  $running = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "sa-postgres" }

  if (!$running) {
    throw "Container sa-postgres non attivo"
  }

  $dbUser = Get-DockerEnv -Container "sa-postgres" -Key "POSTGRES_USER"
  $dbName = Get-DockerEnv -Container "sa-postgres" -Key "POSTGRES_DB"

  if ([string]::IsNullOrWhiteSpace($dbUser) -or [string]::IsNullOrWhiteSpace($dbName)) {
    throw "Impossibile leggere POSTGRES_USER o POSTGRES_DB"
  }

  if (!$SkipSafetyBackup) {
    Write-Step "Backup di sicurezza pre-restore"
    $safetyRoot = Join-Path $ProjectRoot "backup"
    New-Item -ItemType Directory -Path $safetyRoot -Force | Out-Null
    $safetyFile = Join-Path $safetyRoot ("pre-restore-safety-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".sql")

    docker exec sa-postgres pg_dump `
      -U $dbUser `
      -d $dbName `
      --clean `
      --if-exists `
      --no-owner `
      --no-privileges |
      Out-File -FilePath $safetyFile -Encoding UTF8

    Write-Host "Creato backup sicurezza: $safetyFile" -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "ATTENZIONE: il restore sovrascriverà il database '$dbName'." -ForegroundColor Yellow
  Write-Host "Backup sorgente: $BackupZip" -ForegroundColor Yellow
  $confirm = Read-Host "Scrivi RESTORE per continuare"

  if ($confirm -ne "RESTORE") {
    Write-Host "Restore annullato."
    exit 0
  }

  Write-Step "Restore database"
  Get-Content -LiteralPath $sqlFile.FullName -Raw |
    docker exec -i sa-postgres psql -U $dbUser -d $dbName

  if ($RestoreProjectFiles) {
    Write-Step "Restore project-files"
    $projectFiles = Join-Path $tempDir "project-files"

    if (Test-Path -LiteralPath $projectFiles) {
      Copy-Item -LiteralPath (Join-Path $projectFiles "*") -Destination $ProjectRoot -Recurse -Force
      Write-Host "Project-files ripristinati in $ProjectRoot" -ForegroundColor Green
    } else {
      Write-Host "Cartella project-files non presente nel backup." -ForegroundColor Yellow
    }
  }

  if ($RestoreStorage) {
    Write-Step "Restore storage"
    $storageZip = Join-Path $tempDir "storage.zip"

    if (Test-Path -LiteralPath $storageZip) {
      $storagePath = Join-Path $ProjectRoot "storage"
      New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
      Expand-Archive -Path $storageZip -DestinationPath $storagePath -Force
      Write-Host "Storage ripristinato in $storagePath" -ForegroundColor Green
    } else {
      Write-Host "storage.zip non presente nel backup." -ForegroundColor Yellow
    }
  }

  Write-Step "Riavvio servizi applicativi"
  docker restart sa-backend sa-frontend | Out-Null

  Write-Host ""
  Write-Host "RESTORE COMPLETATO" -ForegroundColor Green
  Write-Host "Verifica ora:" -ForegroundColor Green
  Write-Host "powershell.exe -ExecutionPolicy Bypass -File `"$ProjectRoot\scripts\sa-check.ps1`"" -ForegroundColor Green
} finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
