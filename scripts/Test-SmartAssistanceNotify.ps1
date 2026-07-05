[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\SmartAssistance"
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $ProjectRoot "scripts\smart-assistance-monitor-config.json"

function Get-ConfigSection {
    param([object]$Config, [string[]]$Path)
    $current = $Config
    foreach ($part in $Path) {
        if ($null -eq $current) { return $null }
        if ($null -eq $current.PSObject.Properties[$part]) { return $null }
        $current = $current.PSObject.Properties[$part].Value
    }
    return $current
}

function Get-ConfigValue {
    param([object]$Config, [string[]]$Names, [object]$DefaultValue = $null)
    foreach ($name in $Names) {
        if ($null -ne $Config -and $null -ne $Config.PSObject.Properties[$name]) { return $Config.PSObject.Properties[$name].Value }
    }
    return $DefaultValue
}

function Get-EnvValueAnyScope {
    param([string]$Name)
    foreach ($scope in @("Process", "User", "Machine")) {
        $value = [Environment]::GetEnvironmentVariable($Name, $scope)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return $null
}

if (-not (Test-Path -LiteralPath $configPath)) { throw "Config non trovata: $configPath" }
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$wa = Get-ConfigSection -Config $config -Path @("Notifications", "WhatsApp")
if ($null -eq $wa) { throw "Sezione Notifications.WhatsApp non trovata nella config" }

$enabled = [bool](Get-ConfigValue -Config $wa -Names @("Enabled", "enabled") -DefaultValue $false)
if (-not $enabled) { throw "WhatsApp non abilitato nella config" }

$baseUrl = [string](Get-ConfigValue -Config $wa -Names @("BaseUrl", "baseUrl") -DefaultValue "http://localhost:3000")
$session = [string](Get-ConfigValue -Config $wa -Names @("Session", "session") -DefaultValue "default")
$chatId = [string](Get-ConfigValue -Config $wa -Names @("ChatId", "chatId") -DefaultValue "")
$apiKeyEnv = [string](Get-ConfigValue -Config $wa -Names @("ApiKeyEnv", "apiKeyEnv") -DefaultValue "SA_WAHA_API_KEY")
$apiKey = Get-EnvValueAnyScope -Name $apiKeyEnv

if ([string]::IsNullOrWhiteSpace($chatId)) { throw "ChatId WhatsApp non configurato" }
if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "API key WAHA non trovata in $apiKeyEnv" }

$text = "Test notifica Smart Assistance Patch 58.6 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$uri = $baseUrl.TrimEnd('/') + "/api/sendText"
$headers = @{ "X-Api-Key" = $apiKey }
$body = @{ session = $session; chatId = $chatId; text = $text } | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 30 | Out-Null
Write-Host "WhatsApp: test inviato a $chatId"
exit 0
