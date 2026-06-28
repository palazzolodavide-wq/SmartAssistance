param(
  [Parameter(Mandatory = $true)]
  [string]$BackupZip
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupZip)) {
  throw "File backup non trovato: $BackupZip"
}

$tempDir = Join-Path $env:TEMP ("smartassistance-restore-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Expand-Archive -Path $BackupZip -DestinationPath $tempDir -Force

$sqlFile = Get-ChildItem -Path $tempDir -Filter "*.sql" | Select-Object -First 1

if (!$sqlFile) {
  throw "Nessun file SQL trovato nel backup"
}

$dbUser = ((docker exec sa-postgres printenv POSTGRES_USER) -join "").Trim()
$dbName = ((docker exec sa-postgres printenv POSTGRES_DB) -join "").Trim()

Write-Host "ATTENZIONE: il restore sovrascriverà il database $dbName."
$confirm = Read-Host "Scrivi RESTORE per continuare"

if ($confirm -ne "RESTORE") {
  Write-Host "Restore annullato."
  exit 0
}

Write-Host "Restore database in corso..."

Get-Content -LiteralPath $sqlFile.FullName -Raw |
  docker exec -i sa-postgres psql -U $dbUser -d $dbName

Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Restore completato."
