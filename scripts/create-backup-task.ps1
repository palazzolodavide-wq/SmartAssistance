$ErrorActionPreference = "Stop"

$taskName = "SmartAssistance Daily Backup"
$scriptPath = "C:\SmartAssistance\scripts\backup-smartassistance.ps1"

if (!(Test-Path $scriptPath)) {
  throw "Script backup non trovato: $scriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger `
  -Daily `
  -At 3:00AM

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Backup automatico giornaliero Smart Assistance" `
  -Force

Write-Host "Operazione pianificata creata/aggiornata:"
Write-Host $taskName
