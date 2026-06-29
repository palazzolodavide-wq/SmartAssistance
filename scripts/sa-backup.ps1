param(
  [string]$ProjectRoot = "C:\SmartAssistance",
  [string]$BackupRoot = "C:\SmartAssistance\backup",
  [int]$KeepDays = 30,
  [switch]$SkipStorage
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Command {
  param([string]$Name)

  if (!(Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando non disponibile: $Name"
  }
}

function Copy-IfExists {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (Test-Path -LiteralPath $Source) {
    $destinationDir = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    return $true
  }

  return $false
}

function Get-DockerEnv {
  param(
    [string]$Container,
    [string]$Key
  )

  return ((docker exec $Container printenv $Key) -join "").Trim()
}

Assert-Command "docker"

if (!(Test-Path -LiteralPath $ProjectRoot)) {
  throw "Cartella progetto non trovata: $ProjectRoot"
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$logRoot = Join-Path $BackupRoot "logs"
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupName = "smartassistance-full-$timestamp"
$workDir = Join-Path $BackupRoot $backupName
$zipFile = Join-Path $BackupRoot "$backupName.zip"
$hashFile = Join-Path $BackupRoot "$backupName.zip.sha256"
$logFile = Join-Path $logRoot "$backupName.log"

Start-Transcript -Path $logFile -Append | Out-Null

try {
  Write-Step "Preparazione backup"
  New-Item -ItemType Directory -Path $workDir -Force | Out-Null

  $dbDir = Join-Path $workDir "database"
  $projectFilesDir = Join-Path $workDir "project-files"
  $diagnosticsDir = Join-Path $workDir "diagnostics"

  New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
  New-Item -ItemType Directory -Path $projectFilesDir -Force | Out-Null
  New-Item -ItemType Directory -Path $diagnosticsDir -Force | Out-Null

  Write-Step "Controllo container richiesti"
  $dockerPs = docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  $dockerPs | Out-File -FilePath (Join-Path $diagnosticsDir "docker-ps.txt") -Encoding UTF8

  foreach ($container in @("sa-postgres", "sa-backend", "sa-frontend")) {
    $running = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $container }

    if (!$running) {
      throw "Container richiesto non attivo: $container"
    }

    Write-Host "[OK] $container attivo" -ForegroundColor Green
  }

  Write-Step "Backup database PostgreSQL"
  $dbUser = Get-DockerEnv -Container "sa-postgres" -Key "POSTGRES_USER"
  $dbName = Get-DockerEnv -Container "sa-postgres" -Key "POSTGRES_DB"

  if ([string]::IsNullOrWhiteSpace($dbUser) -or [string]::IsNullOrWhiteSpace($dbName)) {
    throw "Impossibile leggere POSTGRES_USER o POSTGRES_DB dal container sa-postgres"
  }

  $dbFile = Join-Path $dbDir "smartassistance-db-$timestamp.sql"

  docker exec sa-postgres pg_dump `
    -U $dbUser `
    -d $dbName `
    --clean `
    --if-exists `
    --no-owner `
    --no-privileges |
    Out-File -FilePath $dbFile -Encoding UTF8

  if (!(Test-Path -LiteralPath $dbFile) -or ((Get-Item -LiteralPath $dbFile).Length -le 0)) {
    throw "Dump SQL non creato o vuoto"
  }

  $dbHash = Get-FileHash -Algorithm SHA256 -LiteralPath $dbFile

  Write-Step "Backup configurazioni e file operativi"
  $copiedFiles = @()

  $relativeFiles = @(
    ".env",
    ".env.local",
    ".gitignore",
    "docker-compose.yml",
    "docker\docker-compose.yml",
    "backend\.env",
    "backend\.env.local",
    "backend\package.json",
    "frontend\.env",
    "frontend\.env.local",
    "frontend\package.json",
    "frontend\next.config.js",
    "frontend\next.config.mjs"
  )

  foreach ($relativeFile in $relativeFiles) {
    $source = Join-Path $ProjectRoot $relativeFile
    $destination = Join-Path $projectFilesDir $relativeFile

    if (Copy-IfExists -Source $source -Destination $destination) {
      $copiedFiles += $relativeFile
      Write-Host "[OK] $relativeFile"
    }
  }

  foreach ($folderName in @("scripts", "docs")) {
    $sourceFolder = Join-Path $ProjectRoot $folderName

    if (Test-Path -LiteralPath $sourceFolder) {
      $destinationFolder = Join-Path $projectFilesDir $folderName
      Copy-Item -LiteralPath $sourceFolder -Destination $destinationFolder -Recurse -Force
      $copiedFiles += "$folderName\"
      Write-Host "[OK] $folderName\"
    }
  }

  if (!$SkipStorage) {
    $storagePath = Join-Path $ProjectRoot "storage"

    if (Test-Path -LiteralPath $storagePath) {
      Write-Step "Backup storage"
      $storageZip = Join-Path $workDir "storage.zip"
      Compress-Archive -Path (Join-Path $storagePath "*") -DestinationPath $storageZip -Force
      Write-Host "[OK] storage.zip"
    } else {
      Write-Host "[INFO] Cartella storage non presente"
    }
  }

  Write-Step "Diagnostica"
  docker images | Out-File -FilePath (Join-Path $diagnosticsDir "docker-images.txt") -Encoding UTF8
  docker inspect sa-postgres | Out-File -FilePath (Join-Path $diagnosticsDir "sa-postgres-inspect.json") -Encoding UTF8
  docker inspect sa-backend | Out-File -FilePath (Join-Path $diagnosticsDir "sa-backend-inspect.json") -Encoding UTF8
  docker inspect sa-frontend | Out-File -FilePath (Join-Path $diagnosticsDir "sa-frontend-inspect.json") -Encoding UTF8

  try {
    Push-Location $ProjectRoot
    git rev-parse --abbrev-ref HEAD | Out-File -FilePath (Join-Path $diagnosticsDir "git-branch.txt") -Encoding UTF8
    git rev-parse HEAD | Out-File -FilePath (Join-Path $diagnosticsDir "git-commit.txt") -Encoding UTF8
    git status --short | Out-File -FilePath (Join-Path $diagnosticsDir "git-status.txt") -Encoding UTF8
  } catch {
    "Git non disponibile o cartella non repository: $($_.Exception.Message)" |
      Out-File -FilePath (Join-Path $diagnosticsDir "git-error.txt") -Encoding UTF8
  } finally {
    Pop-Location
  }

  Write-Step "Manifest backup"
  $manifest = [ordered]@{
    project = "Smart Assistance"
    backup_schema = 2
    backup_type = "full"
    created_at = (Get-Date).ToString("s")
    host = $env:COMPUTERNAME
    user = $env:USERNAME
    project_root = $ProjectRoot
    backup_root = $BackupRoot
    database = [ordered]@{
      container = "sa-postgres"
      db_user = $dbUser
      db_name = $dbName
      sql_file = "database\$(Split-Path -Leaf $dbFile)"
      sql_sha256 = $dbHash.Hash
      sql_size_bytes = (Get-Item -LiteralPath $dbFile).Length
    }
    included_project_files = $copiedFiles
    storage_included = (Test-Path -LiteralPath (Join-Path $workDir "storage.zip"))
    restore_script = "scripts\sa-restore.ps1"
    warning = "Questo backup può contenere dati clienti e file .env. Conservare in modo sicuro."
  }

  $manifestPath = Join-Path $workDir "backup-manifest.json"
  $manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $manifestPath -Encoding UTF8

  Write-Step "Compressione ZIP"
  Compress-Archive -Path (Join-Path $workDir "*") -DestinationPath $zipFile -Force

  if (!(Test-Path -LiteralPath $zipFile) -or ((Get-Item -LiteralPath $zipFile).Length -le 0)) {
    throw "ZIP backup non creato o vuoto"
  }

  $zipHash = Get-FileHash -Algorithm SHA256 -LiteralPath $zipFile
  $zipHash.Hash | Out-File -FilePath $hashFile -Encoding ASCII

  Write-Step "Verifica integrità ZIP"
  $verifyDir = Join-Path $env:TEMP ("smartassistance-verify-" + $timestamp)
  New-Item -ItemType Directory -Path $verifyDir -Force | Out-Null

  try {
    Expand-Archive -Path $zipFile -DestinationPath $verifyDir -Force
    $verifySql = Get-ChildItem -Path $verifyDir -Recurse -Filter "*.sql" | Select-Object -First 1

    if (!$verifySql -or ((Get-Item -LiteralPath $verifySql.FullName).Length -le 0)) {
      throw "Verifica fallita: SQL non trovato nello ZIP"
    }

    Write-Host "[OK] ZIP verificato"
  } finally {
    if (Test-Path -LiteralPath $verifyDir) {
      Remove-Item -LiteralPath $verifyDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  Remove-Item -LiteralPath $workDir -Recurse -Force

  Write-Step "Retention backup"
  Get-ChildItem -Path $BackupRoot -Filter "smartassistance-full-*.zip" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    ForEach-Object {
      $oldHash = "$($_.FullName).sha256"
      Remove-Item -LiteralPath $_.FullName -Force
      if (Test-Path -LiteralPath $oldHash) {
        Remove-Item -LiteralPath $oldHash -Force
      }
    }

  Write-Host ""
  Write-Host "BACKUP COMPLETO OK" -ForegroundColor Green
  Write-Host $zipFile -ForegroundColor Green
  Write-Host "SHA256: $($zipHash.Hash)" -ForegroundColor Green
  Write-Host ""
  Write-Host "Nota: conserva questo ZIP in modo sicuro perché può contenere dati clienti e segreti." -ForegroundColor Yellow
} catch {
  Write-Host ""
  Write-Host "BACKUP FALLITO: $($_.Exception.Message)" -ForegroundColor Red

  if (Test-Path -LiteralPath $workDir) {
    Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  throw
} finally {
  Stop-Transcript | Out-Null
}
