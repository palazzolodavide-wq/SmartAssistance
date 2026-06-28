param(
  [string]$BackupRoot = "C:\SmartAssistance\backup",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $BackupRoot $timestamp

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$dbUser = ((docker exec sa-postgres printenv POSTGRES_USER) -join "").Trim()
$dbName = ((docker exec sa-postgres printenv POSTGRES_DB) -join "").Trim()

if ([string]::IsNullOrWhiteSpace($dbUser) -or [string]::IsNullOrWhiteSpace($dbName)) {
  throw "Impossibile leggere POSTGRES_USER o POSTGRES_DB dal container sa-postgres"
}

$dbFile = Join-Path $backupDir "smartassistance-db-$timestamp.sql"

Write-Host "Backup database in corso..."
docker exec sa-postgres pg_dump -U $dbUser -d $dbName | Out-File -FilePath $dbFile -Encoding UTF8

if (!(Test-Path $dbFile) -or ((Get-Item $dbFile).Length -le 0)) {
  throw "Backup database non creato o vuoto"
}

$zipFile = Join-Path $BackupRoot "smartassistance-backup-$timestamp.zip"

Write-Host "Compressione backup..."
Compress-Archive -Path (Join-Path $backupDir "*") -DestinationPath $zipFile -Force

if (!(Test-Path $zipFile) -or ((Get-Item $zipFile).Length -le 0)) {
  throw "ZIP backup non creato o vuoto"
}

Remove-Item -Path $backupDir -Recurse -Force

Write-Host "Pulizia backup più vecchi di $KeepDays giorni..."
Get-ChildItem -Path $BackupRoot -Filter "smartassistance-backup-*.zip" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

Write-Host "Backup completato:"
Write-Host $zipFile
