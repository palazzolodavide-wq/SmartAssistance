param(
  [string]$ProjectRoot = "C:\SmartAssistance",
  [string]$PublicUrl = "https://7590.ns0.it",
  [int]$BackupMaxAgeHours = 36
)

$ErrorActionPreference = "Continue"

function Write-Ok($message) {
  Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Write-Fail($message) {
  Write-Host "[FAIL] $message" -ForegroundColor Red
}

Write-Host ""
Write-Host "Smart Assistance - Check operativo" -ForegroundColor Cyan
Write-Host "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

$hasErrors = $false

Write-Host "== Docker containers =="
$containers = @("sa-postgres", "sa-backend", "sa-frontend", "sa-caddy")

foreach ($container in $containers) {
  try {
    $status = (docker inspect -f "{{.State.Status}}" $container 2>$null).Trim()

    if ($status -eq "running") {
      Write-Ok "$container running"
    } else {
      Write-Fail "$container stato: $status"
      $hasErrors = $true
    }
  } catch {
    Write-Fail "$container non trovato"
    $hasErrors = $true
  }
}

Write-Host ""
Write-Host "== Backend health locale =="
try {
  $health = Invoke-RestMethod "http://localhost:3006/health" -TimeoutSec 8

  if ($health.status -eq "ok") {
    Write-Ok "Backend OK - Database $($health.database)"
  } else {
    Write-Fail "Backend health anomalo"
    $hasErrors = $true
  }
} catch {
  Write-Fail "Backend non raggiungibile su http://localhost:3006/health"
  $hasErrors = $true
}

Write-Host ""
Write-Host "== Sito pubblico =="
try {
  $response = Invoke-WebRequest $PublicUrl -UseBasicParsing -TimeoutSec 12

  if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
    Write-Ok "$PublicUrl raggiungibile - HTTP $($response.StatusCode)"
  } else {
    Write-Warn "$PublicUrl HTTP $($response.StatusCode)"
  }
} catch {
  Write-Warn "$PublicUrl non raggiungibile dal server: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "== Database rapido =="
try {
  $dbUser = ((docker exec sa-postgres printenv POSTGRES_USER) -join "").Trim()
  $dbName = ((docker exec sa-postgres printenv POSTGRES_DB) -join "").Trim()

  $sql = @"
SELECT 'users' AS tabella, COUNT(*)::text AS totale FROM users
UNION ALL
SELECT 'devices', COUNT(*)::text FROM devices
UNION ALL
SELECT 'offers', COUNT(*)::text FROM offers
UNION ALL
SELECT 'offer_clicks', COUNT(*)::text FROM offer_clicks;
"@

  $sql | docker exec -i sa-postgres psql -U $dbUser -d $dbName
  Write-Ok "Query database eseguita"
} catch {
  Write-Warn "Query database non completata: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "== Backup =="
$backupPath = Join-Path $ProjectRoot "backup"

if (!(Test-Path $backupPath)) {
  Write-Fail "Cartella backup non trovata: $backupPath"
  $hasErrors = $true
} else {
  $latestBackup = Get-ChildItem -Path $backupPath -Filter "smartassistance-backup-*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (!$latestBackup) {
    Write-Fail "Nessun backup ZIP trovato"
    $hasErrors = $true
  } else {
    $ageHours = [Math]::Round(((Get-Date) - $latestBackup.LastWriteTime).TotalHours, 1)

    if ($ageHours -le $BackupMaxAgeHours) {
      Write-Ok "Ultimo backup: $($latestBackup.Name) - $ageHours ore fa"
    } else {
      Write-Warn "Ultimo backup vecchio: $($latestBackup.Name) - $ageHours ore fa"
    }

    Write-Host "Dimensione: $([Math]::Round($latestBackup.Length / 1MB, 2)) MB"
  }
}

Write-Host ""
Write-Host "== Git =="
try {
  Push-Location $ProjectRoot
  $branch = (git branch --show-current).Trim()
  $status = (git status --short)

  Write-Host "Branch: $branch"

  if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Ok "Working tree pulito"
  } else {
    Write-Warn "Ci sono modifiche non committate:"
    $status | ForEach-Object { Write-Host $_ }
  }

  Pop-Location
} catch {
  Write-Warn "Git check non completato"
}

Write-Host ""
if ($hasErrors) {
  Write-Fail "Check completato con errori da correggere."
  exit 1
}

Write-Ok "Check completato."
exit 0
