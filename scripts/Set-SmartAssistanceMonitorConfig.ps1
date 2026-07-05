[CmdletBinding()]
param(
    [string]$ProjectRoot = "C:\SmartAssistance",
    [Nullable[bool]]$WhatsAppEnabled,
    [string]$WahaBaseUrl,
    [string]$WahaApiKey,
    [string]$WahaApiKeyEnv = "SA_WAHA_API_KEY",
    [string]$WahaSession,
    [string]$WahaChatId,

    [Nullable[bool]]$EmailEnabled,
    [string]$SmtpServer,
    [int]$SmtpPort = 587,
    [Nullable[bool]]$UseSsl,
    [string]$EmailFrom,
    [string[]]$EmailTo,
    [string]$SmtpUsername,
    [string]$SmtpPassword,
    [string]$SmtpPasswordEnv = "SA_MONITOR_SMTP_PASSWORD",

    [string]$BackupRoot,
    [int]$RetentionDays = 14,
    [string]$PublicUrl,
    [string]$BackendHealthUrl,
    [string]$FrontendUrl
)

$ErrorActionPreference = "Stop"
$configPath = Join-Path $ProjectRoot "scripts\smart-assistance-monitor-config.json"

function New-DefaultConfig {
    return [pscustomobject]@{
        Backup = [pscustomobject]@{
            Root = "C:\SmartAssistance\backups"
            RetentionDays = 14
            Compress = $true
            DatabaseContainer = "sa-postgres"
            ProjectContainers = @("sa-caddy", "sa-frontend", "sa-backend", "sa-postgres", "sa-telegram-live")
            BackendHealthUrl = "http://localhost:3006/health"
            FrontendUrl = "http://localhost:3005/login"
            PublicUrl = "https://7590.ns0.it/"
        }
        Notifications = [pscustomobject]@{
            WhatsApp = [pscustomobject]@{
                Enabled = $false
                BaseUrl = "http://localhost:3000"
                ApiKeyEnv = "SA_WAHA_API_KEY"
                Session = "default"
                ChatId = ""
            }
            Email = [pscustomobject]@{
                Enabled = $false
                SmtpServer = ""
                SmtpPort = 587
                UseSsl = $true
                From = ""
                To = @()
                Username = ""
                PasswordEnv = "SA_MONITOR_SMTP_PASSWORD"
            }
        }
    }
}

if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $config = New-DefaultConfig
}

# Normalizza sezioni mancanti
$default = New-DefaultConfig
foreach ($section in @("Backup", "Notifications")) {
    if ($null -eq $config.PSObject.Properties[$section]) { $config | Add-Member -NotePropertyName $section -NotePropertyValue $default.$section }
}
foreach ($sub in @("WhatsApp", "Email")) {
    if ($null -eq $config.Notifications.PSObject.Properties[$sub]) { $config.Notifications | Add-Member -NotePropertyName $sub -NotePropertyValue $default.Notifications.$sub }
}

if ($null -ne $WhatsAppEnabled) { $config.Notifications.WhatsApp.Enabled = [bool]$WhatsAppEnabled }
if (-not [string]::IsNullOrWhiteSpace($WahaBaseUrl)) { $config.Notifications.WhatsApp.BaseUrl = $WahaBaseUrl }
if (-not [string]::IsNullOrWhiteSpace($WahaApiKeyEnv)) { $config.Notifications.WhatsApp.ApiKeyEnv = $WahaApiKeyEnv }
if (-not [string]::IsNullOrWhiteSpace($WahaSession)) { $config.Notifications.WhatsApp.Session = $WahaSession }
if (-not [string]::IsNullOrWhiteSpace($WahaChatId)) { $config.Notifications.WhatsApp.ChatId = $WahaChatId }
if (-not [string]::IsNullOrWhiteSpace($WahaApiKey)) {
    [Environment]::SetEnvironmentVariable($WahaApiKeyEnv, $WahaApiKey, "User")
    [Environment]::SetEnvironmentVariable($WahaApiKeyEnv, $WahaApiKey, "Process")
    Write-Host "API key WAHA salvata nella variabile utente $WahaApiKeyEnv"
}

if ($null -ne $EmailEnabled) { $config.Notifications.Email.Enabled = [bool]$EmailEnabled }
if (-not [string]::IsNullOrWhiteSpace($SmtpServer)) { $config.Notifications.Email.SmtpServer = $SmtpServer }
if ($PSBoundParameters.ContainsKey("SmtpPort")) { $config.Notifications.Email.SmtpPort = $SmtpPort }
if ($null -ne $UseSsl) { $config.Notifications.Email.UseSsl = [bool]$UseSsl }
if (-not [string]::IsNullOrWhiteSpace($EmailFrom)) { $config.Notifications.Email.From = $EmailFrom }
if ($null -ne $EmailTo -and $EmailTo.Count -gt 0) { $config.Notifications.Email.To = @($EmailTo) }
if (-not [string]::IsNullOrWhiteSpace($SmtpUsername)) { $config.Notifications.Email.Username = $SmtpUsername }
if (-not [string]::IsNullOrWhiteSpace($SmtpPasswordEnv)) { $config.Notifications.Email.PasswordEnv = $SmtpPasswordEnv }
if (-not [string]::IsNullOrWhiteSpace($SmtpPassword)) {
    [Environment]::SetEnvironmentVariable($SmtpPasswordEnv, $SmtpPassword, "User")
    [Environment]::SetEnvironmentVariable($SmtpPasswordEnv, $SmtpPassword, "Process")
    Write-Host "Password SMTP salvata nella variabile utente $SmtpPasswordEnv"
}

if (-not [string]::IsNullOrWhiteSpace($BackupRoot)) { $config.Backup.Root = $BackupRoot }
if ($PSBoundParameters.ContainsKey("RetentionDays")) { $config.Backup.RetentionDays = $RetentionDays }
if (-not [string]::IsNullOrWhiteSpace($PublicUrl)) { $config.Backup.PublicUrl = $PublicUrl }
if (-not [string]::IsNullOrWhiteSpace($BackendHealthUrl)) { $config.Backup.BackendHealthUrl = $BackendHealthUrl }
if (-not [string]::IsNullOrWhiteSpace($FrontendUrl)) { $config.Backup.FrontendUrl = $FrontendUrl }

New-Item -Path (Split-Path -Parent $configPath) -ItemType Directory -Force | Out-Null
$config | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $configPath -Encoding UTF8
Write-Host "Config aggiornata: $configPath"
Write-Host "WhatsApp enabled: $($config.Notifications.WhatsApp.Enabled) - ChatId: $($config.Notifications.WhatsApp.ChatId)"
Write-Host "Email enabled: $($config.Notifications.Email.Enabled) - To: $(@($config.Notifications.Email.To) -join ', ')"
Write-Host "BackupRoot: $($config.Backup.Root) - RetentionDays: $($config.Backup.RetentionDays)"
