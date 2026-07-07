param(
  [string]$Root = "C:\SmartAssistance",
  [switch]$NoRetention
)

$ErrorActionPreference = "Stop"

$BackupRoot = Join-Path $Root "backups"
$ConfigPath = Join-Path $Root "config\offsite-backup.env"
$HistoryDir = Join-Path $BackupRoot "offsite-history"
$LastTxt = Join-Path $BackupRoot "last-offsite-backup-report.txt"
$LastJson = Join-Path $BackupRoot "last-offsite-backup-report.json"

New-Item -ItemType Directory -Path $HistoryDir -Force | Out-Null

$RunStarted = Get-Date
$Stamp = $RunStarted.ToString("yyyyMMdd_HHmmss")
$RunTxt = Join-Path $HistoryDir "offsite-backup-$Stamp.txt"
$RunJson = Join-Path $HistoryDir "offsite-backup-$Stamp.json"
$RcloneLog = Join-Path $HistoryDir "offsite-rclone-$Stamp.log"

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Config offsite non trovato: $Path"
  }

  $map = @{}

  foreach ($line in Get-Content $Path) {
    $trim = $line.Trim()

    if ([string]::IsNullOrWhiteSpace($trim)) { continue }
    if ($trim.StartsWith("#")) { continue }

    if ($trim -match '^([^=]+)=(.*)$') {
      $map[$matches[1].Trim()] = $matches[2].Trim()
    }
  }

  return $map
}

function Invoke-RcloneSafe {
  param([string[]]$CommandArgs)

  $output = & $script:RcloneExe --config $script:RcloneConfig @CommandArgs 2>&1
  $exitCode = $LASTEXITCODE

  return [pscustomobject]@{
    ExitCode = $exitCode
    Lines = @($output)
    Text = ($output | Out-String -Width 340).Trim()
  }
}

function Format-Bytes {
  param([double]$Bytes)

  if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }

  return "$Bytes B"
}

$status = "KO"
$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

$remoteZipCount = 0
$remoteTotalBytes = 0
$latestRemoteFound = $false
$latestRemoteSizeBytes = 0
$latestLocalZip = $null
$Remote = ""
$RetentionDays = 0

try {
  $cfg = Read-EnvFile -Path $ConfigPath

  $script:RcloneExe = $cfg["SA_OFFSITE_RCLONE_EXE"]
  $script:RcloneConfig = $cfg["SA_OFFSITE_RCLONE_CONFIG"]
  $Remote = $cfg["SA_OFFSITE_REMOTE"]
  $RetentionDays = [int]($cfg["SA_OFFSITE_RETENTION_DAYS"])

  if ([string]::IsNullOrWhiteSpace($script:RcloneExe)) { throw "SA_OFFSITE_RCLONE_EXE mancante" }
  if ([string]::IsNullOrWhiteSpace($script:RcloneConfig)) { throw "SA_OFFSITE_RCLONE_CONFIG mancante" }
  if ([string]::IsNullOrWhiteSpace($Remote)) { throw "SA_OFFSITE_REMOTE mancante" }

  if (-not (Test-Path $script:RcloneExe)) { throw "rclone.exe non trovato: $script:RcloneExe" }
  if (-not (Test-Path $script:RcloneConfig)) { throw "rclone.conf non trovato: $script:RcloneConfig" }
  if (-not (Test-Path $BackupRoot)) { throw "Backup root non trovato: $BackupRoot" }

  $localZips = @(Get-ChildItem $BackupRoot -Filter "SmartAssistanceBackup-*.zip" -File | Sort-Object LastWriteTime -Descending)

  if ($localZips.Count -eq 0) {
    throw "Nessun backup ZIP locale trovato in $BackupRoot"
  }

  $latestLocalZip = $localZips[0]

  $copyArgs = @(
    "copy",
    $BackupRoot,
    $Remote,
    "--filter", "+ SmartAssistanceBackup-*.zip",
    "--filter", "+ last-daily-check-report.txt",
    "--filter", "+ last-restore-test-report.txt",
    "--filter", "- *",
    "--log-file", $RcloneLog,
    "--log-level", "INFO",
    "--stats-one-line",
    "--retries", "3",
    "--low-level-retries", "10"
  )

  $copyResult = Invoke-RcloneSafe -CommandArgs $copyArgs

  if ($copyResult.ExitCode -ne 0) {
    [void]$errors.Add("rclone copy fallito con exit code $($copyResult.ExitCode): $($copyResult.Text)")
  }

  if (-not $NoRetention -and $RetentionDays -gt 0) {
    $retentionArgs = @(
      "delete",
      $Remote,
      "--min-age", "${RetentionDays}d",
      "--filter", "+ SmartAssistanceBackup-*.zip",
      "--filter", "- *",
      "--log-file", $RcloneLog,
      "--log-level", "INFO",
      "--retries", "3",
      "--low-level-retries", "10"
    )

    $retentionResult = Invoke-RcloneSafe -CommandArgs $retentionArgs

    if ($retentionResult.ExitCode -ne 0) {
      [void]$warnings.Add("retention remota fallita con exit code $($retentionResult.ExitCode): $($retentionResult.Text)")
    }
  }

  $remoteNamesResult = Invoke-RcloneSafe -CommandArgs @(
    "lsf",
    $Remote,
    "--files-only"
  )

  if ($remoteNamesResult.ExitCode -ne 0) {
    [void]$errors.Add("lista nomi remota fallita con exit code $($remoteNamesResult.ExitCode): $($remoteNamesResult.Text)")
  } else {
    $remoteZipNames = @($remoteNamesResult.Lines | ForEach-Object { "$_".Trim() } | Where-Object { $_ -like "SmartAssistanceBackup-*.zip" })
    $remoteZipCount = $remoteZipNames.Count
  }

  $latestRemotePath = "$Remote/$($latestLocalZip.Name)"

  $latestLslResult = Invoke-RcloneSafe -CommandArgs @(
    "lsl",
    $latestRemotePath
  )

  if ($latestLslResult.ExitCode -ne 0) {
    [void]$errors.Add("ultimo ZIP non leggibile su Drive: $($latestLocalZip.Name) / $($latestLslResult.Text)")
  } else {
    $lslText = $latestLslResult.Text

    if ($lslText -match '^\s*(\d+)\s+') {
      $latestRemoteSizeBytes = [int64]$matches[1]

      if ($latestRemoteSizeBytes -eq [int64]$latestLocalZip.Length) {
        $latestRemoteFound = $true
      } else {
        [void]$errors.Add("ultimo ZIP trovato su Drive ma dimensione diversa: locale=$($latestLocalZip.Length), remoto=$latestRemoteSizeBytes")
      }
    } else {
      [void]$errors.Add("impossibile leggere dimensione ultimo ZIP remoto da rclone lsl: $lslText")
    }
  }

  $remoteSizeResult = Invoke-RcloneSafe -CommandArgs @(
    "size",
    $Remote,
    "--json",
    "--filter", "+ SmartAssistanceBackup-*.zip",
    "--filter", "- *"
  )

  if ($remoteSizeResult.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($remoteSizeResult.Text)) {
    try {
      $sizeObj = $remoteSizeResult.Text | ConvertFrom-Json
      if ($null -ne $sizeObj.bytes) {
        $remoteTotalBytes = [int64]$sizeObj.bytes
      }

      if ($null -ne $sizeObj.count -and [int]$sizeObj.count -gt $remoteZipCount) {
        $remoteZipCount = [int]$sizeObj.count
      }
    } catch {
      [void]$warnings.Add("rclone size JSON non leggibile: $($_.Exception.Message)")
    }
  } else {
    [void]$warnings.Add("rclone size non disponibile: $($remoteSizeResult.Text)")
  }

  if ($remoteZipCount -le 0) {
    [void]$errors.Add("nessuno ZIP remoto rilevato in Google Drive")
  }

  if (-not $latestRemoteFound) {
    [void]$errors.Add("ultimo ZIP locale non verificato su Google Drive con stesso nome/dimensione: $($latestLocalZip.Name)")
  }

  if ($errors.Count -eq 0) {
    $status = "OK"
  }
} catch {
  [void]$errors.Add($_.Exception.Message)
}

$RunEnded = Get-Date
$DurationSeconds = [int]($RunEnded - $RunStarted).TotalSeconds

$reportObj = [pscustomobject]@{
  success = ($status -eq "OK")
  status = $status
  started_at = $RunStarted.ToString("yyyy-MM-dd HH:mm:ss")
  ended_at = $RunEnded.ToString("yyyy-MM-dd HH:mm:ss")
  duration_seconds = $DurationSeconds
  provider = "google-drive-rclone"
  remote = $Remote
  upload_mode = "copy"
  retention_days = $RetentionDays
  local_backup_root = $BackupRoot
  latest_local_zip = if ($latestLocalZip) { $latestLocalZip.Name } else { "" }
  latest_local_zip_size_bytes = if ($latestLocalZip) { [int64]$latestLocalZip.Length } else { 0 }
  latest_remote_found = $latestRemoteFound
  latest_remote_size_bytes = $latestRemoteSizeBytes
  remote_zip_count = $remoteZipCount
  remote_total_bytes = [int64]$remoteTotalBytes
  remote_total_human = Format-Bytes $remoteTotalBytes
  warnings = @($warnings)
  errors = @($errors)
  rclone_log = $RcloneLog
}

$txt = New-Object System.Collections.Generic.List[string]
[void]$txt.Add("Smart Assistance - Offsite backup Google Drive: $status")
[void]$txt.Add("Data: $($RunEnded.ToString('yyyy-MM-dd HH:mm:ss'))")
[void]$txt.Add("Remote: $($reportObj.remote)")
[void]$txt.Add("Metodo: rclone copy")
[void]$txt.Add("Retention remota: $($reportObj.retention_days) giorni")
[void]$txt.Add("Ultimo ZIP locale: $($reportObj.latest_local_zip) / $(Format-Bytes $reportObj.latest_local_zip_size_bytes)")
[void]$txt.Add("Ultimo ZIP remoto size: $(Format-Bytes $reportObj.latest_remote_size_bytes)")
[void]$txt.Add("Ultimo ZIP verificato su Drive: $($reportObj.latest_remote_found)")
[void]$txt.Add("ZIP remoti: $($reportObj.remote_zip_count) / spazio stimato: $($reportObj.remote_total_human)")
[void]$txt.Add("Durata: ${DurationSeconds}s")

if ($warnings.Count -gt 0) {
  [void]$txt.Add("")
  [void]$txt.Add("Warning:")
  foreach ($w in $warnings) { [void]$txt.Add("- $w") }
}

if ($errors.Count -gt 0) {
  [void]$txt.Add("")
  [void]$txt.Add("Errori:")
  foreach ($e in $errors) { [void]$txt.Add("- $e") }
}

[System.IO.File]::WriteAllLines($RunTxt, $txt, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllLines($LastTxt, $txt, (New-Object System.Text.UTF8Encoding($false)))
$reportObj | ConvertTo-Json -Depth 8 | Set-Content -Path $RunJson -Encoding UTF8
$reportObj | ConvertTo-Json -Depth 8 | Set-Content -Path $LastJson -Encoding UTF8

$txt | ForEach-Object { Write-Host $_ }

if ($status -ne "OK") { exit 2 }

exit 0