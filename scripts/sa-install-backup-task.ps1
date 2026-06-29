param(
  [string]$TaskName = "SmartAssistance Full Backup REV2",
  [string]$ScriptPath = "C:\SmartAssistance\scripts\sa-backup.ps1",
  [string]$At = "03:15",
  [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $ScriptPath)) {
  throw "Script backup non trovato: $ScriptPath"
}

$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -KeepDays $KeepDays"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument $argument

$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At $At

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Backup completo Smart Assistance REV2: database, configurazioni, storage, diagnostica" `
  -Force | Out-Null

Write-Host "Task creato/aggiornato:" -ForegroundColor Green
Write-Host $TaskName -ForegroundColor Green
Write-Host "Orario: $At" -ForegroundColor Green
Write-Host "Retention: $KeepDays giorni" -ForegroundColor Green
