[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\SmartAssistance",
    [string]$TaskName = "Smart Assistance - Backup e Check giornaliero",
    [string]$At = "07:00",
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $ProjectRoot "scripts\SmartAssistance-DailyBackupCheck.ps1"
if (-not (Test-Path -LiteralPath $scriptPath)) { throw "Script non trovato: $scriptPath" }

$time = [datetime]::ParseExact($At, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
$actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectRoot `"$ProjectRoot`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArgs
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Attivita pianificata creata/aggiornata: $TaskName alle $At"
Write-Host "Nota: con Docker Desktop, il task e pensato per girare con l'utente Windows loggato."

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Task avviato ora. Controlla l'esito con:"
    Write-Host "Get-ScheduledTaskInfo -TaskName `"$TaskName`""
}
