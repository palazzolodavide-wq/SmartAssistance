param(
  [string]$ProjectRoot = "C:\SmartAssistance",
  [string]$PublicUrl = "https://7590.ns0.it"
)

$ErrorActionPreference = "Continue"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Ko {
  param([string]$Message)
  Write-Host "[KO] $Message" -ForegroundColor Red
}

Write-Host ""
Write-Host "Smart Assistance - Check operativo REV2.1" -ForegroundColor White
Write-Host ("Data: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor DarkGray

Write-Section "Docker containers"
$requiredContainers = @("sa-postgres", "sa-backend", "sa-frontend", "sa-caddy")
$runningContainers = docker ps --format "{{.Names}}"

foreach ($container in $requiredContainers) {
  if ($runningContainers -contains $container) {
    Write-Ok "$container running"
  } else {
    Write-Ko "$container non attivo"
  }
}

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Section "Backend health locale"
try {
  $health = Invoke-RestMethod http://localhost:3006/health -TimeoutSec 10

  if ($health.status -eq "ok" -and $health.database -eq "connected") {
    Write-Ok "Backend OK - Database connected"
  } else {
    Write-Warn "Risposta health inattesa"
    $health | Format-List
  }
} catch {
  Write-Ko "Backend health KO: $($_.Exception.Message)"
}

Write-Section "Frontend locale"
try {
  $frontend = Invoke-WebRequest http://localhost:3005 -UseBasicParsing -TimeoutSec 10

  if ($frontend.StatusCode -ge 200 -and $frontend.StatusCode -lt 400) {
    Write-Ok "Frontend locale OK - HTTP $($frontend.StatusCode)"
  } else {
    Write-Warn "Frontend locale HTTP $($frontend.StatusCode)"
  }
} catch {
  Write-Ko "Frontend locale KO: $($_.Exception.Message)"
}

Write-Section "Sito pubblico"
try {
  $public = Invoke-WebRequest $PublicUrl -UseBasicParsing -TimeoutSec 15

  if ($public.StatusCode -ge 200 -and $public.StatusCode -lt 400) {
    Write-Ok "$PublicUrl raggiungibile - HTTP $($public.StatusCode)"
  } else {
    Write-Warn "$PublicUrl HTTP $($public.StatusCode)"
  }
} catch {
  Write-Warn "$PublicUrl non raggiungibile dal server: $($_.Exception.Message)"
}

Write-Section "Database rapido"
try {
  $dbUser = ((docker exec sa-postgres printenv POSTGRES_USER) -join "").Trim()
  $dbName = ((docker exec sa-postgres printenv POSTGRES_DB) -join "").Trim()

  $query = @"
SELECT 'users' AS tabella, COUNT(*) AS totale FROM users
UNION ALL
SELECT 'devices', COUNT(*) FROM devices
UNION ALL
SELECT 'offers', COUNT(*) FROM offers
UNION ALL
SELECT 'offer_clicks', COUNT(*) FROM offer_clicks;
"@

  $query | docker exec -i sa-postgres psql -U $dbUser -d $dbName
  Write-Ok "Query database eseguita"
} catch {
  Write-Ko "Query database KO: $($_.Exception.Message)"
}

Write-Section "Statistiche click database"
try {
  $dbUser = ((docker exec sa-postgres printenv POSTGRES_USER) -join "").Trim()
  $dbName = ((docker exec sa-postgres printenv POSTGRES_DB) -join "").Trim()

  $statsQuery = @"
SELECT
  COUNT(*) AS click_totali,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS click_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS click_7_giorni,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS click_30_giorni,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days') AS clienti_7_giorni
FROM offer_clicks;
"@

  $statsQuery | docker exec -i sa-postgres psql -U $dbUser -d $dbName
  Write-Ok "Statistiche click lette da database"
} catch {
  Write-Warn "Statistiche click database KO: $($_.Exception.Message)"
}

Write-Section "Backup recenti"
$backupRoot = Join-Path $ProjectRoot "backup"

if (Test-Path -LiteralPath $backupRoot) {
  $backups = Get-ChildItem -Path $backupRoot -Filter "smartassistance-full-*.zip" |
    Sort-Object LastWriteTime -Descending

  if ($backups.Count -gt 0) {
    $last = $backups | Select-Object -First 1
    $ageHours = [math]::Round(((Get-Date) - $last.LastWriteTime).TotalHours, 1)

    Write-Ok "Ultimo backup completo: $($last.Name) - $ageHours ore fa"
    Write-Host ("Dimensione: " + [math]::Round($last.Length / 1MB, 2) + " MB")

    $backups |
      Select-Object -First 5 Name, @{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}, LastWriteTime |
      Format-Table -AutoSize
  } else {
    Write-Warn "Nessun backup completo smartassistance-full-*.zip trovato"
  }

  $oldBackups = Get-ChildItem -Path $backupRoot -Filter "smartassistance-backup-*.zip" |
    Sort-Object LastWriteTime -Descending

  if ($oldBackups.Count -gt 0) {
    Write-Host ""
    Write-Host "Backup vecchio formato presenti:" -ForegroundColor DarkYellow
    $oldBackups |
      Select-Object -First 3 Name, @{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}, LastWriteTime |
      Format-Table -AutoSize
  }
} else {
  Write-Warn "Cartella backup non trovata: $backupRoot"
}

Write-Section "Attività pianificata"
try {
  $task = Get-ScheduledTask -TaskName "SmartAssistance Full Backup REV2" -ErrorAction SilentlyContinue

  if ($task) {
    Write-Ok "Task presente: $($task.TaskName) - Stato $($task.State)"
  } else {
    Write-Warn "Task SmartAssistance Full Backup REV2 non presente"
  }
} catch {
  Write-Warn "Impossibile leggere task: $($_.Exception.Message)"
}

Write-Section "Git"
try {
  Push-Location $ProjectRoot
  $branch = git rev-parse --abbrev-ref HEAD
  $commit = git log -1 --oneline
  $status = git status --short

  Write-Host "Branch: $branch"
  Write-Host "Ultimo commit: $commit"

  if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Ok "Working tree pulito"
  } else {
    Write-Warn "Working tree con modifiche:"
    $status
  }
} catch {
  Write-Warn "Git KO: $($_.Exception.Message)"
} finally {
  Pop-Location
}

Write-Host ""
Write-Ok "Check completato"
