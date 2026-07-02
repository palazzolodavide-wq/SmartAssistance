param(
  [string]$ProjectRoot = "C:\SmartAssistance",
  [string]$PublicUrl = "https://7590.ns0.it",
  [ValidateSet("whatsapp", "none")]
  [string]$NotifyMode = "whatsapp",
  [string]$NotifyWhatsApp = "393297655557"
)

$ErrorActionPreference = "Continue"

$script:CheckWarnings = New-Object System.Collections.Generic.List[string]
$script:CheckErrors = New-Object System.Collections.Generic.List[string]
$script:CheckOkCount = 0
$script:LastBackupSummary = "n/d"
$script:GitSummary = "n/d"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  $script:CheckOkCount++
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  $script:CheckWarnings.Add($Message) | Out-Null
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Ko {
  param([string]$Message)
  $script:CheckErrors.Add($Message) | Out-Null
  Write-Host "[KO] $Message" -ForegroundColor Red
}

function Get-EnvFileValue {
  param(
    [string]$Path,
    [string]$Key
  )

  if (!(Test-Path -LiteralPath $Path)) {
    return ""
  }

  $line = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Key))=" } |
    Select-Object -Last 1

  if (!$line) {
    return ""
  }

  return (($line -replace "^\s*$([regex]::Escape($Key))=", "").Trim().Trim('"').Trim("'"))
}

function Normalize-WahaPhone {
  param([string]$Phone)

  $raw = ($Phone -replace "\D", "")

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return ""
  }

  if ($raw.StartsWith("0039")) {
    $raw = $raw.Substring(4)
  }

  if (!$raw.StartsWith("39")) {
    $raw = "39$raw"
  }

  return "$raw@c.us"
}

function Send-CheckWhatsAppNotification {
  param([string]$Message)

  if ($NotifyMode -ne "whatsapp") {
    return
  }

  try {
    $envFile = Join-Path $ProjectRoot "backend\.env"

    $baseUrl = Get-EnvFileValue -Path $envFile -Key "WAHA_BASE_URL"
    $apiKey = Get-EnvFileValue -Path $envFile -Key "WAHA_API_KEY"
    $session = Get-EnvFileValue -Path $envFile -Key "WAHA_SESSION"
    $sendPath = Get-EnvFileValue -Path $envFile -Key "WAHA_SEND_TEXT_PATH"

    if ([string]::IsNullOrWhiteSpace($baseUrl)) {
      $baseUrl = "http://localhost:3000"
    }

    if ($baseUrl -match "host\.docker\.internal") {
      $baseUrl = $baseUrl -replace "host\.docker\.internal", "localhost"
    }

    $baseUrl = $baseUrl.TrimEnd("/")

    if ([string]::IsNullOrWhiteSpace($apiKey)) {
      $apiKey = $env:WAHA_API_KEY
    }

    if ([string]::IsNullOrWhiteSpace($apiKey)) {
      Write-Warn "Notifica WhatsApp non inviata: WAHA_API_KEY non trovata in backend\.env"
      return
    }

    if ([string]::IsNullOrWhiteSpace($session)) {
      $session = "default"
    }

    if ([string]::IsNullOrWhiteSpace($sendPath)) {
      $sendPath = "/api/sendText"
    }

    $chatId = Normalize-WahaPhone -Phone $NotifyWhatsApp

    if ([string]::IsNullOrWhiteSpace($chatId)) {
      Write-Warn "Notifica WhatsApp non inviata: numero destinatario non valido"
      return
    }

    $payload = @{
      session = $session
      chatId = $chatId
      text = $Message
    } | ConvertTo-Json -Depth 5

    $headers = @{
      "X-Api-Key" = $apiKey
    }

    $paths = @($sendPath, "/api/sendText", "/api/send-text") |
      Where-Object { $_ } |
      Select-Object -Unique

    $lastError = ""

    foreach ($path in $paths) {
      if (!$path.StartsWith("/")) {
        $path = "/$path"
      }

      $url = "$baseUrl$path"

      try {
        Invoke-RestMethod `
          -Uri $url `
          -Method Post `
          -Headers $headers `
          -ContentType "application/json" `
          -Body $payload `
          -TimeoutSec 20 | Out-Null

        Write-Ok "Notifica WhatsApp check inviata a $NotifyWhatsApp"
        return
      } catch {
        $lastError = $_.Exception.Message

        if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
          continue
        }
      }
    }

    Write-Warn "Notifica WhatsApp non inviata: $lastError"
  } catch {
    Write-Warn "Errore notifica WhatsApp: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Smart Assistance - Check operativo REV2.2" -ForegroundColor White
Write-Host ("Data: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")) -ForegroundColor DarkGray

Write-Section "Docker containers"
try {
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
} catch {
  Write-Ko "Docker KO: $($_.Exception.Message)"
}

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
SELECT 'offer_clicks', COUNT(*) FROM offer_clicks
UNION ALL
SELECT 'whatsapp_broadcasts', COUNT(*) FROM whatsapp_broadcasts;
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
    $script:LastBackupSummary = "$($last.Name) - $ageHours ore fa"

    Write-Ok "Ultimo backup completo: $script:LastBackupSummary"
    Write-Host ("Dimensione: " + [math]::Round($last.Length / 1MB, 2) + " MB")

    $backups |
      Select-Object -First 5 Name, @{Name="MB";Expression={[math]::Round($_.Length / 1MB, 2)}}, LastWriteTime |
      Format-Table -AutoSize
  } else {
    $script:LastBackupSummary = "nessun backup completo trovato"
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
  $script:LastBackupSummary = "cartella backup non trovata"
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
    $script:GitSummary = "$branch pulito - $commit"
    Write-Ok "Working tree pulito"
  } else {
    $script:GitSummary = "$branch con modifiche"
    Write-Warn "Working tree con modifiche:"
    $status
  }
} catch {
  $script:GitSummary = "Git KO"
  Write-Warn "Git KO: $($_.Exception.Message)"
} finally {
  Pop-Location
}

$statusLabel = if ($script:CheckErrors.Count -gt 0) {
  "KO"
} elseif ($script:CheckWarnings.Count -gt 0) {
  "WARN"
} else {
  "OK"
}

Write-Host ""
Write-Ok "Check completato - Stato $statusLabel"

$summaryLines = @(
  "Smart Assistance - check $statusLabel",
  "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
  "PC: $env:COMPUTERNAME",
  "OK: $script:CheckOkCount | WARN: $($script:CheckWarnings.Count) | KO: $($script:CheckErrors.Count)",
  "Backup: $script:LastBackupSummary",
  "Git: $script:GitSummary"
)

if ($script:CheckErrors.Count -gt 0) {
  $summaryLines += "Errori:"
  $summaryLines += ($script:CheckErrors | Select-Object -First 5 | ForEach-Object { "- $_" })
}

if ($script:CheckWarnings.Count -gt 0) {
  $summaryLines += "Warning:"
  $summaryLines += ($script:CheckWarnings | Select-Object -First 5 | ForEach-Object { "- $_" })
}

Send-CheckWhatsAppNotification -Message ($summaryLines -join "`n")
