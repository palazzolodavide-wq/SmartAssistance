[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\SmartAssistance",
    [string]$BaseUrl,
    [string]$ApiKeyEnv,
    [string]$Session,
    [int]$Limit = 80
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $ProjectRoot "scripts\smart-assistance-monitor-config.json"

if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) { $BaseUrl = if ($config) { [string]$config.Notifications.WhatsApp.BaseUrl } else { "http://localhost:3000" } }
if ([string]::IsNullOrWhiteSpace($ApiKeyEnv)) { $ApiKeyEnv = if ($config) { [string]$config.Notifications.WhatsApp.ApiKeyEnv } else { "SA_WAHA_API_KEY" } }
if ([string]::IsNullOrWhiteSpace($Session)) { $Session = if ($config) { [string]$config.Notifications.WhatsApp.Session } else { "default" } }

function Get-EnvSecret {
    param([string]$Name)
    foreach ($target in @("Process", "User", "Machine")) {
        $value = [Environment]::GetEnvironmentVariable($Name, $target)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return $null
}

$headers = @{}
$apiKey = Get-EnvSecret $ApiKeyEnv
if (-not [string]::IsNullOrWhiteSpace($apiKey)) { $headers["X-Api-Key"] = $apiKey }

$uri = ($BaseUrl.TrimEnd('/')) + "/api/$Session/chats?limit=$Limit&offset=0"
$chats = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 30

if ($null -ne $chats.data) { $items = @($chats.data) } else { $items = @($chats) }

$items |
    Select-Object `
        @{Name="chatId";Expression={ if ($_.id._serialized) { $_.id._serialized } elseif ($_.id) { $_.id } else { $_.chatId } }},
        @{Name="name";Expression={ if ($_.name) { $_.name } elseif ($_.pushname) { $_.pushname } else { $_.formattedTitle } }},
        @{Name="isGroup";Expression={ if ($_.isGroup -ne $null) { $_.isGroup } elseif ($_.id.server -eq "g.us") { $true } else { $false } }} |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Per configurare il destinatario WhatsApp:"
Write-Host ".\scripts\Set-SmartAssistanceMonitorConfig.ps1 -WhatsAppEnabled `$true -WahaChatId \"CHAT_ID_SCELTO\""
