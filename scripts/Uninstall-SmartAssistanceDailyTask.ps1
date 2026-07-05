[CmdletBinding()]
param(
    [string]$TaskName = "Smart Assistance - Backup e Check giornaliero"
)

$ErrorActionPreference = "Stop"
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Attivita pianificata rimossa: $TaskName"
} else {
    Write-Host "Attivita pianificata non trovata: $TaskName"
}
