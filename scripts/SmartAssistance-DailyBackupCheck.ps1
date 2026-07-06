<#
Smart Assistance - Patch 58.6
Backup giornaliero + check generale + notifiche opzionali.
Compatibile Windows PowerShell 5.1.
Versione anti-blocco: comandi Docker/Postgres eseguiti tramite PowerShell Job con timeout.
#>

param(
    [string]$ProjectRoot = "C:\SmartAssistance",
    [string]$BackupRoot = "C:\SmartAssistance\backups",
    [string]$ConfigPath = "C:\SmartAssistance\scripts\smart-assistance-monitor-config.json",
    [switch]$NoNotify
)

$ErrorActionPreference = "Stop"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$startedAt = Get-Date
$runDir = Join-Path $BackupRoot "run-$stamp"
$logsDir = Join-Path $runDir "logs"
$dbDir = Join-Path $runDir "db"
$stateDir = Join-Path $runDir "state"
$payloadDir = Join-Path $runDir "backup-content"
$keyFilesDir = Join-Path $payloadDir "key-files"
$projectFilesDir = Join-Path $payloadDir "project-files"

$warnings = New-Object System.Collections.Generic.List[string]
$errors = New-Object System.Collections.Generic.List[string]
$summary = [ordered]@{
    Backup = "NON CREATO"
    Backend = "NON TESTATO"
    Frontend = "NON TESTATO"
    Pubblico = "NON TESTATO"
    PostgresDump = "NON TESTATO"
    # PATCH_68A_BACKUP_RESTORE_CHECK_SUMMARY
    BackupRestoreCheck = "NON TESTATO"
    LiveOffers24h = "NON TESTATO"
    LiveOffersLast = "NON TESTATO"
    # PATCH_67A_LIVE_OFFERS_QUALITY_SUMMARY
    LiveOffersQuality = "NON TESTATO"
}

function Add-WarningMessage {
    param([string]$Message)
    if (-not [string]::IsNullOrWhiteSpace($Message)) { [void]$warnings.Add($Message) }
}

function Add-ErrorMessage {
    param([string]$Message)
    if (-not [string]::IsNullOrWhiteSpace($Message)) { [void]$errors.Add($Message) }
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Save-TextFile {
    param(
        [string]$Path,
        [string]$Content
    )
    $parent = Split-Path -Parent $Path
    if ($parent) { Ensure-Directory $parent }
    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-JobCommand {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$OutputPath,
        [switch]$IgnoreExitCode,
        [int]$TimeoutSeconds = 60,
        [string]$WorkingDirectory = ""
    )

    $job = Start-Job -ScriptBlock {
        param($exe, [string[]]$argList, $wd)
        $ErrorActionPreference = "Continue"
        try {
            if (-not [string]::IsNullOrWhiteSpace($wd)) { Set-Location -LiteralPath $wd }
            $output = & $exe @argList 2>&1 | ForEach-Object { $_.ToString() }
            $code = $LASTEXITCODE
            if ($null -eq $code) { $code = 0 }
            [pscustomobject]@{
                ExitCode = [int]$code
                Text = ($output -join [Environment]::NewLine)
            }
        } catch {
            [pscustomobject]@{
                ExitCode = 999
                Text = $_.Exception.Message
            }
        }
    } -ArgumentList $FilePath, $Arguments, $WorkingDirectory

    try {
        $finished = Wait-Job -Job $job -Timeout $TimeoutSeconds
        if ($null -eq $finished) {
            Stop-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null
            $text = "TIMEOUT dopo ${TimeoutSeconds}s: $FilePath $($Arguments -join ' ')"
            if ($OutputPath) { Save-TextFile -Path $OutputPath -Content $text }
            if (-not $IgnoreExitCode) { throw $text }
            return [pscustomobject]@{ ExitCode = 124; Text = $text }
        }

        $result = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($null -eq $result) {
            $result = [pscustomobject]@{ ExitCode = 999; Text = "Nessun output dal job: $FilePath $($Arguments -join ' ')" }
        }
        if ($result -is [array]) { $result = $result | Select-Object -Last 1 }
        $text = [string]$result.Text
        $exitCode = [int]$result.ExitCode
        if ($OutputPath) { Save-TextFile -Path $OutputPath -Content $text }
        if (($exitCode -ne 0) -and (-not $IgnoreExitCode)) {
            throw "Comando fallito ($exitCode): $FilePath $($Arguments -join ' ')`n$text"
        }
        return [pscustomobject]@{ ExitCode = $exitCode; Text = $text }
    } finally {
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null
    }
}

function Read-MonitorConfig {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {
            Add-WarningMessage "Config monitor non leggibile: $($_.Exception.Message)"
        }
    }
    return [pscustomobject]@{
        WhatsAppEnabled = $false
        WahaBaseUrl = "http://localhost:3000"
        WahaSession = "default"
        WahaChatId = ""
        EmailEnabled = $false
        SmtpServer = ""
        SmtpPort = 587
        UseSsl = $true
        EmailFrom = ""
        EmailTo = ""
        SmtpUsername = ""
    }
}

function Get-ConfigValue {
    param(
        [object]$Config,
        [string[]]$Names,
        [object]$DefaultValue = $null
    )
    foreach ($name in $Names) {
        if ($null -ne $Config.PSObject.Properties[$name]) { return $Config.PSObject.Properties[$name].Value }
    }
    return $DefaultValue
}


function Get-ConfigSection {
    param(
        [object]$Config,
        [string[]]$Path
    )
    $current = $Config
    foreach ($part in $Path) {
        if ($null -eq $current) { return $null }
        if ($null -eq $current.PSObject.Properties[$part]) { return $null }
        $current = $current.PSObject.Properties[$part].Value
    }
    return $current
}

function Get-EnvValueAnyScope {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
    foreach ($scope in @("Process", "User", "Machine")) {
        $value = [Environment]::GetEnvironmentVariable($Name, $scope)
        if (-not [string]::IsNullOrWhiteSpace($value)) { return $value }
    }
    return $null
}

function Copy-IfExists {
    param(
        [string]$Source,
        [string]$Destination
    )
    try {
        if (Test-Path -LiteralPath $Source) {
            $parent = Split-Path -Parent $Destination
            if ($parent) { Ensure-Directory $parent }
            Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force -ErrorAction Stop
            return $true
        }
    } catch {
        Add-WarningMessage "Copia non riuscita: $Source -> $Destination - $($_.Exception.Message)"
    }
    return $false
}

function Invoke-ContainerShell {
    param(
        [string]$Script,
        [string]$OutputPath,
        [int]$TimeoutSeconds = 60,
        [switch]$IgnoreExitCode
    )
    return Invoke-JobCommand -FilePath "docker" -Arguments @("exec", "sa-postgres", "sh", "-lc", $Script) -OutputPath $OutputPath -TimeoutSeconds $TimeoutSeconds -IgnoreExitCode:$IgnoreExitCode
}

function Invoke-PsqlText {
    param(
        [string]$Sql,
        [string]$OutputPath,
        [int]$TimeoutSeconds = 60
    )
    $safeSql = $Sql.Replace('"', '\"')
    $script = 'U="${POSTGRES_USER:-postgres}"; D="${POSTGRES_DB:-postgres}"; psql -U "$U" -d "$D" -Atc "' + $safeSql + '"'
    $res = Invoke-ContainerShell -Script $script -OutputPath $OutputPath -TimeoutSeconds $TimeoutSeconds -IgnoreExitCode
    if ($res.ExitCode -ne 0) {
        Add-WarningMessage "Query Postgres non riuscita: $($res.Text.Trim())"
        return ""
    }
    return $res.Text.Trim()
}

function Get-ContainerStatus {
    param([string]$ContainerName)
    $inspect = Invoke-JobCommand -FilePath "docker" -Arguments @("inspect", "-f", "{{.State.Status}}", $ContainerName) -IgnoreExitCode -TimeoutSeconds 30
    if ($inspect.ExitCode -ne 0) { return "missing" }
    return $inspect.Text.Trim()
}

# PATCH_66A_SMART_LOG_WARNINGS_START
function Test-SaTextHasOperationalError {
    param(
        [string]$ContainerName,
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $false
    }

    $lines = @($Text -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $joined = $lines -join "`n"

    # npm audit e notice di build non sono errori runtime del servizio.
    if ($ContainerName -in @("sa-frontend", "sa-backend")) {
        $runtimeLines = @(
            $lines | Where-Object {
                $_ -notmatch "(?i)npm notice|npm audit|vulnerabilit|vulnerability|run npm audit|npm fund|packages are looking for funding|npm install -g npm|new major version of npm"
            }
        )

        $runtimeText = $runtimeLines -join "`n"
        return ($runtimeText -match "(?im)\buncaught\b|\bfatal\b|\bpanic\b|ECONNREFUSED|database.*error|connection refused|UnhandledPromiseRejection|EADDRINUSE")
    }

    # PATCH_66B_REDUCE_TRANSIENT_LOG_WARNINGS_CADDY
    # Caddy può registrare 502/EOF o upstream refused durante rebuild/restart frontend.
    # Lo stato reale pubblico viene già verificato più avanti con Invoke-WebRequest.
    # Qui segnaliamo solo problemi strutturali TLS/certificati o crash.
    if ($ContainerName -eq "sa-caddy") {
        $criticalCaddyLines = @(
            $lines | Where-Object {
                $_ -match "(?i)\bpanic\b|\bfatal\b|certificate.*failed|acme.*failed|tls.*failed"
            }
        )

        return ($criticalCaddyLines.Count -gt 0)
    }

    # PATCH_66B_REDUCE_TRANSIENT_LOG_WARNINGS_TELEGRAM
    # Telegram Live può avere fetch/heartbeat temporanei durante restart backend o rete.
    # Lo stato funzionale viene già verificato dal conteggio Offerte Live 24h e dall'ultima offerta importata.
    # Qui segnaliamo solo crash reali del worker.
    if ($ContainerName -eq "sa-telegram-live") {
        $criticalTelegramLines = @(
            $lines | Where-Object {
                $_ -match "(?i)\buncaught\b|\bfatal\b|\bpanic\b|UnhandledPromiseRejection"
            }
        )

        return ($criticalTelegramLines.Count -gt 0)
    }

    return ($joined -match "(?im)\buncaught\b|\bfatal\b|\bpanic\b|ECONNREFUSED|database.*error|connection refused|UnhandledPromiseRejection")
}

function Save-DockerLog {
    param([string]$ContainerName)

    $path = Join-Path $logsDir "$ContainerName-tail-300.log"
    $res = Invoke-JobCommand -FilePath "docker" -Arguments @("logs", "--tail", "300", $ContainerName) -OutputPath $path -IgnoreExitCode -TimeoutSeconds 45

    if ($res.ExitCode -eq 124) {
        Add-WarningMessage "${ContainerName}: docker logs timeout, log parziale o non disponibile"
    } elseif ($res.ExitCode -ne 0) {
        Add-WarningMessage "${ContainerName}: docker logs ha restituito codice $($res.ExitCode), log salvato se disponibile"
    }

    $text = [string]$res.Text

    if (Test-SaTextHasOperationalError -ContainerName $ContainerName -Text $text) {
        Add-WarningMessage "${ContainerName}: log contiene errori runtime recenti da verificare"
    }
}
# PATCH_66A_SMART_LOG_WARNINGS_END

function Create-ZipFromDirectory {
    param(
        [string]$SourceDirectory,
        [string]$DestinationZip
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $DestinationZip) { Remove-Item -LiteralPath $DestinationZip -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($SourceDirectory, $DestinationZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
}

# PATCH_68A_BACKUP_RESTORE_CHECK_FUNCTION_START
function Find-SaZipEntry {
    param(
        [array]$Entries,
        [string]$Pattern
    )

    foreach ($entry in $Entries) {
        if ($entry.NormalizedName -match $Pattern) {
            return $entry
        }
    }

    return $null
}

function Test-SaBackupZipRestoreStructure {
    param(
        [string]$ZipPath,
        [bool]$RequireBackendEnv = $false,
        [bool]$RequireFrontendEnv = $false,
        [bool]$RequireTelegramEnv = $false,
        [bool]$RequireTelegramSession = $false
    )

    $result = [ordered]@{
        Ok = $false
        Text = "NON TESTATO"
        EntryCount = 0
        DumpBytes = 0
        SqlBytes = 0
        Missing = @()
        Error = ""
    }

    try {
        if (-not (Test-Path -LiteralPath $ZipPath)) {
            $result.Text = "ERRORE - ZIP non trovato"
            $result.Error = "ZIP non trovato: $ZipPath"
            return [pscustomobject]$result
        }

        Add-Type -AssemblyName System.IO.Compression.FileSystem

        $zipInfo = Get-Item -LiteralPath $ZipPath
        if ($zipInfo.Length -lt 1MB) {
            $result.Missing += "ZIP troppo piccolo (<1MB)"
        }

        $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

        try {
            $entries = @(
                $zip.Entries | ForEach-Object {
                    [pscustomobject]@{
                        FullName = $_.FullName
                        NormalizedName = (($_.FullName -replace '/', '\').ToLowerInvariant())
                        Length = $_.Length
                        CompressedLength = $_.CompressedLength
                    }
                }
            )

            $result.EntryCount = $entries.Count

            $required = New-Object System.Collections.Generic.List[object]

            [void]$required.Add([pscustomobject]@{ Name = "db/smartassistance.dump"; Pattern = "^db\\smartassistance\.dump$"; MinBytes = 1024 })
            [void]$required.Add([pscustomobject]@{ Name = "db/smartassistance.sql"; Pattern = "^db\\smartassistance\.sql$"; MinBytes = 1024 })
            [void]$required.Add([pscustomobject]@{ Name = "db/globals.sql"; Pattern = "^db\\globals\.sql$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "db/db-info.txt"; Pattern = "^db\\db-info\.txt$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "key-files/docker-compose.yml"; Pattern = "^key-files\\docker-compose\.ya?ml$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "key-files/docker-compose.telegram-live.yml"; Pattern = "^key-files\\docker-compose\.telegram-live\.ya?ml$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "key-files/backend-package.json"; Pattern = "^key-files\\backend-package\.json$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "key-files/frontend-package.json"; Pattern = "^key-files\\frontend-package\.json$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "project-files/scripts/SmartAssistance-DailyBackupCheck.ps1"; Pattern = "^project-files\\scripts\\smartassistance-dailybackupcheck\.ps1$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "project-files/database/*.sql"; Pattern = "^project-files\\database\\.+\.sql$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "state/docker-compose-config.txt"; Pattern = "^state\\docker-compose-config\.txt$"; MinBytes = 1 })
            [void]$required.Add([pscustomobject]@{ Name = "MANIFEST.txt"; Pattern = "^manifest\.txt$"; MinBytes = 1 })

            if ($RequireBackendEnv) {
                [void]$required.Add([pscustomobject]@{ Name = "key-files/backend.env"; Pattern = "^key-files\\backend\.env$"; MinBytes = 1 })
            }

            if ($RequireFrontendEnv) {
                [void]$required.Add([pscustomobject]@{ Name = "key-files/frontend env"; Pattern = "^key-files\\frontend\.env(\.local)?$"; MinBytes = 1 })
            }

            if ($RequireTelegramEnv) {
                [void]$required.Add([pscustomobject]@{ Name = "key-files/telegram-live.env"; Pattern = "^key-files\\telegram-live\.env$"; MinBytes = 1 })
            }

            if ($RequireTelegramSession) {
                [void]$required.Add([pscustomobject]@{ Name = "key-files/telegram-live-session/telegram.session"; Pattern = "^key-files\\telegram-live-session\\telegram\.session$"; MinBytes = 1 })
            }

            foreach ($item in $required) {
                $found = Find-SaZipEntry -Entries $entries -Pattern $item.Pattern
                if ($null -eq $found) {
                    $result.Missing += $item.Name
                } elseif ($found.Length -lt $item.MinBytes) {
                    $result.Missing += "$($item.Name) vuoto"
                }
            }

            $dumpEntry = Find-SaZipEntry -Entries $entries -Pattern "^db\\smartassistance\.dump$"
            $sqlEntry = Find-SaZipEntry -Entries $entries -Pattern "^db\\smartassistance\.sql$"

            if ($null -ne $dumpEntry) { $result.DumpBytes = [int64]$dumpEntry.Length }
            if ($null -ne $sqlEntry) { $result.SqlBytes = [int64]$sqlEntry.Length }

            if ($result.EntryCount -lt 20) {
                $result.Missing += "numero file ZIP anomalo (<20)"
            }

            $dumpMb = [math]::Round(($result.DumpBytes / 1MB), 2)
            $sqlMb = [math]::Round(($result.SqlBytes / 1MB), 2)

            if ($result.Missing.Count -eq 0) {
                $result.Ok = $true
                $result.Text = "OK - ZIP ripristinabile strutturalmente / file: $($result.EntryCount) / dump: ${dumpMb} MB / SQL: ${sqlMb} MB"
            } else {
                $result.Ok = $false
                $result.Text = "ATTENZIONE - ZIP leggibile ma mancano: $($result.Missing -join ', ')"
            }
        } finally {
            if ($zip) { $zip.Dispose() }
        }
    } catch {
        $result.Ok = $false
        $result.Text = "ERRORE - verifica ZIP non riuscita"
        $result.Error = $_.Exception.Message
    }

    return [pscustomobject]$result
}
# PATCH_68A_BACKUP_RESTORE_CHECK_FUNCTION_END
function Send-WhatsAppNotification {
    param(
        [object]$Config,
        [string]$Message
    )

    $waConfig = Get-ConfigSection -Config $Config -Path @("Notifications", "WhatsApp")
    if ($null -eq $waConfig) { $waConfig = $Config }

    $enabled = [bool](Get-ConfigValue -Config $waConfig -Names @("Enabled", "WhatsAppEnabled", "whatsappEnabled", "enabled") -DefaultValue $false)
    if (-not $enabled) { return $false }

    $baseUrl = [string](Get-ConfigValue -Config $waConfig -Names @("BaseUrl", "WahaBaseUrl", "wahaBaseUrl", "baseUrl") -DefaultValue "http://localhost:3000")
    $session = [string](Get-ConfigValue -Config $waConfig -Names @("Session", "WahaSession", "wahaSession", "session") -DefaultValue "default")
    $chatId = [string](Get-ConfigValue -Config $waConfig -Names @("ChatId", "WahaChatId", "wahaChatId", "chatId") -DefaultValue "")
    $apiKeyEnv = [string](Get-ConfigValue -Config $waConfig -Names @("ApiKeyEnv", "WahaApiKeyEnv", "wahaApiKeyEnv", "apiKeyEnv") -DefaultValue "SA_WAHA_API_KEY")

    $apiKey = Get-EnvValueAnyScope -Name $apiKeyEnv
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = Get-EnvValueAnyScope -Name "SA_WAHA_API_KEY" }
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = Get-EnvValueAnyScope -Name "SA_MONITOR_WAHA_API_KEY" }
    if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = Get-EnvValueAnyScope -Name "WAHA_API_KEY" }

    if ([string]::IsNullOrWhiteSpace($chatId)) {
        Write-Host "WhatsApp: ChatId non configurato"
        return $false
    }
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Host "WhatsApp: API key non trovata nella variabile ambiente $apiKeyEnv"
        return $false
    }

    try {
        $uri = ($baseUrl.TrimEnd("/") + "/api/sendText")
        $headers = @{ "X-Api-Key" = $apiKey }
        $body = @{ session = $session; chatId = $chatId; text = $Message } | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 30 | Out-Null
        Write-Host "WhatsApp: notifica inviata a $chatId"
        return $true
    } catch {
        Write-Host "WhatsApp: invio non riuscito - $($_.Exception.Message)"
        return $false
    }
}

function Send-EmailNotification {
    param(
        [object]$Config,
        [string]$Subject,
        [string]$Message
    )

    $emailConfig = Get-ConfigSection -Config $Config -Path @("Notifications", "Email")
    if ($null -eq $emailConfig) { $emailConfig = $Config }

    $enabled = [bool](Get-ConfigValue -Config $emailConfig -Names @("Enabled", "EmailEnabled", "emailEnabled", "enabled") -DefaultValue $false)
    if (-not $enabled) { return $false }

    $server = [string](Get-ConfigValue -Config $emailConfig -Names @("SmtpServer", "smtpServer") -DefaultValue "")
    $port = [int](Get-ConfigValue -Config $emailConfig -Names @("SmtpPort", "smtpPort") -DefaultValue 587)
    $useSsl = [bool](Get-ConfigValue -Config $emailConfig -Names @("UseSsl", "useSsl") -DefaultValue $true)
    $from = [string](Get-ConfigValue -Config $emailConfig -Names @("From", "EmailFrom", "emailFrom") -DefaultValue "")
    $toValue = Get-ConfigValue -Config $emailConfig -Names @("To", "EmailTo", "emailTo") -DefaultValue @()
    $to = @($toValue) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    $username = [string](Get-ConfigValue -Config $emailConfig -Names @("Username", "SmtpUsername", "smtpUsername") -DefaultValue "")
    $passwordEnv = [string](Get-ConfigValue -Config $emailConfig -Names @("PasswordEnv", "SmtpPasswordEnv", "smtpPasswordEnv") -DefaultValue "SA_MONITOR_SMTP_PASSWORD")
    $password = Get-EnvValueAnyScope -Name $passwordEnv

    if ([string]::IsNullOrWhiteSpace($server) -or [string]::IsNullOrWhiteSpace($from) -or $to.Count -eq 0) {
        Write-Host "Email: configurazione incompleta"
        return $false
    }

    try {
        $mailParams = @{
            SmtpServer = $server
            Port = $port
            UseSsl = $useSsl
            From = $from
            To = $to
            Subject = $Subject
            Body = $Message
            Encoding = "UTF8"
        }
        if (-not [string]::IsNullOrWhiteSpace($username) -and -not [string]::IsNullOrWhiteSpace($password)) {
            $secure = ConvertTo-SecureString $password -AsPlainText -Force
            $mailParams.Credential = New-Object System.Management.Automation.PSCredential($username, $secure)
        }
        Send-MailMessage @mailParams
        Write-Host "Email: notifica inviata a $($to -join ', ')"
        return $true
    } catch {
        Write-Host "Email: invio non riuscito - $($_.Exception.Message)"
        return $false
    }
}

Write-Host "Smart Assistance Patch 58.6 - backup e check giornaliero"
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "BackupRoot: $BackupRoot"
Write-Host ""

try {
    Ensure-Directory $BackupRoot
    Ensure-Directory $runDir
    Ensure-Directory $logsDir
    Ensure-Directory $dbDir
    Ensure-Directory $stateDir
    Ensure-Directory $payloadDir
    Ensure-Directory $keyFilesDir
    Ensure-Directory $projectFilesDir

    if (-not (Test-Path -LiteralPath $ProjectRoot)) { throw "ProjectRoot non trovato: $ProjectRoot" }
    if (-not (Test-CommandExists "docker")) { throw "Docker non trovato nel PATH" }

    Write-Host "=== Stato Docker ==="
    Invoke-JobCommand -FilePath "docker" -Arguments @("ps", "--format", "table {{.Names}}`t{{.Status}}`t{{.Ports}}") -OutputPath (Join-Path $stateDir "docker-ps.txt") -IgnoreExitCode -TimeoutSeconds 30 | Out-Null
    Invoke-JobCommand -FilePath "docker" -Arguments @("images") -OutputPath (Join-Path $stateDir "docker-images.txt") -IgnoreExitCode -TimeoutSeconds 30 | Out-Null
    Invoke-JobCommand -FilePath "docker" -Arguments @("compose", "config") -OutputPath (Join-Path $stateDir "docker-compose-config.txt") -WorkingDirectory $ProjectRoot -IgnoreExitCode -TimeoutSeconds 45 | Out-Null

    Write-Host "=== Container Smart Assistance ==="
    $containers = @("sa-caddy", "sa-frontend", "sa-backend", "sa-postgres", "sa-telegram-live")
    $containerLines = New-Object System.Collections.Generic.List[string]
    foreach ($c in $containers) {
        $st = Get-ContainerStatus -ContainerName $c
        [void]$containerLines.Add("$c=$st")
        if ($st -ne "running") { Add-ErrorMessage "Container non running: $c ($st)" }
        Save-DockerLog -ContainerName $c
    }
    Save-TextFile -Path (Join-Path $stateDir "smartassistance-containers.txt") -Content ($containerLines -join [Environment]::NewLine)

    Write-Host "=== Stato Git ==="
    if (Test-CommandExists "git") {
        Invoke-JobCommand -FilePath "git" -Arguments @("status", "--short") -OutputPath (Join-Path $stateDir "git-status-short.txt") -WorkingDirectory $ProjectRoot -IgnoreExitCode -TimeoutSeconds 30 | Out-Null
        Invoke-JobCommand -FilePath "git" -Arguments @("rev-parse", "HEAD") -OutputPath (Join-Path $stateDir "git-head.txt") -WorkingDirectory $ProjectRoot -IgnoreExitCode -TimeoutSeconds 30 | Out-Null
        Invoke-JobCommand -FilePath "git" -Arguments @("branch", "--show-current") -OutputPath (Join-Path $stateDir "git-branch.txt") -WorkingDirectory $ProjectRoot -IgnoreExitCode -TimeoutSeconds 30 | Out-Null
    }

    Write-Host "=== Health backend/frontend/pubblico ==="
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3006/health" -TimeoutSec 15
        $summary.Backend = "$($health.status) / DB $($health.database)"
        if ($health.status -ne "ok") { Add-ErrorMessage "Backend health non OK" }
    } catch {
        $summary.Backend = "ERRORE"
        Add-ErrorMessage "Backend health non raggiungibile: $($_.Exception.Message)"
    }

    try {
        $frontend = Invoke-WebRequest -Uri "http://localhost:3005/" -UseBasicParsing -TimeoutSec 15
        $summary.Frontend = [string]$frontend.StatusCode
        if ($frontend.StatusCode -lt 200 -or $frontend.StatusCode -ge 400) { Add-WarningMessage "Frontend locale status $($frontend.StatusCode)" }
    } catch {
        $summary.Frontend = "ERRORE"
        Add-ErrorMessage "Frontend locale non raggiungibile: $($_.Exception.Message)"
    }

    try {
        $public = Invoke-WebRequest -Uri "https://7590.ns0.it/" -UseBasicParsing -TimeoutSec 20
        $summary.Pubblico = [string]$public.StatusCode
        if ($public.StatusCode -lt 200 -or $public.StatusCode -ge 400) { Add-WarningMessage "Dominio pubblico status $($public.StatusCode)" }
    } catch {
        $summary.Pubblico = "ERRORE"
        Add-WarningMessage "Dominio pubblico non raggiungibile dal server: $($_.Exception.Message)"
    }

    Write-Host "=== Dump PostgreSQL ==="
    $dumpScript = 'rm -rf /tmp/sa-daily-backup && mkdir -p /tmp/sa-daily-backup && U="${POSTGRES_USER:-postgres}" && D="${POSTGRES_DB:-postgres}" && echo "POSTGRES_USER=$U" > /tmp/sa-daily-backup/db-info.txt && echo "POSTGRES_DB=$D" >> /tmp/sa-daily-backup/db-info.txt && pg_dump -U "$U" -d "$D" -Fc -f /tmp/sa-daily-backup/smartassistance.dump && pg_dump -U "$U" -d "$D" -f /tmp/sa-daily-backup/smartassistance.sql && pg_dumpall -U "$U" --globals-only -f /tmp/sa-daily-backup/globals.sql && psql -U "$U" -d "$D" -c "\\dt" > /tmp/sa-daily-backup/tables.txt'
    $dumpRes = Invoke-ContainerShell -Script $dumpScript -OutputPath (Join-Path $logsDir "postgres-dump-command.log") -TimeoutSeconds 240 -IgnoreExitCode
    if ($dumpRes.ExitCode -ne 0) {
        Add-ErrorMessage "Dump PostgreSQL fallito: $($dumpRes.Text.Trim())"
    } else {
        $cpRes = Invoke-JobCommand -FilePath "docker" -Arguments @("cp", "sa-postgres:/tmp/sa-daily-backup/.", $dbDir) -OutputPath (Join-Path $logsDir "postgres-docker-cp.log") -TimeoutSeconds 120 -IgnoreExitCode
        Invoke-ContainerShell -Script 'rm -rf /tmp/sa-daily-backup' -TimeoutSeconds 30 -IgnoreExitCode | Out-Null
        if ($cpRes.ExitCode -ne 0) { Add-ErrorMessage "Copia dump PostgreSQL fallita: $($cpRes.Text.Trim())" }
    }

    $dbInfoPath = Join-Path $dbDir "db-info.txt"
    if (Test-Path -LiteralPath $dbInfoPath) {
        $summary.PostgresDump = ((Get-Content -LiteralPath $dbInfoPath -Raw) -replace "`r?`n", " / ").Trim()
    }
    $dumpLocal = Join-Path $dbDir "smartassistance.dump"
    $sqlLocal = Join-Path $dbDir "smartassistance.sql"
    if (Test-Path -LiteralPath $dumpLocal) {
        $dumpSize = (Get-Item -LiteralPath $dumpLocal).Length
        if ($dumpSize -le 0) { Add-ErrorMessage "Dump PostgreSQL custom creato ma vuoto" }
    } else {
        Add-ErrorMessage "Dump PostgreSQL custom assente"
    }
    if (-not (Test-Path -LiteralPath $sqlLocal)) { Add-WarningMessage "Dump PostgreSQL SQL assente" }

    Write-Host "=== Controllo Offerte Live ==="
    $dbUser = "sauser"
    $dbName = "smartassistance"
    $dbInfoText = ""
    if (Test-Path -LiteralPath $dbInfoPath) {
        $dbInfoText = Get-Content -LiteralPath $dbInfoPath -Raw -ErrorAction SilentlyContinue
        if ($dbInfoText -match "(?m)^POSTGRES_USER=(.+)$") { $dbUser = $Matches[1].Trim() }
        if ($dbInfoText -match "(?m)^POSTGRES_DB=(.+)$") { $dbName = $Matches[1].Trim() }
    }

    $columnsSql = "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='live_offers' ORDER BY ordinal_position;"
    $columnsRes = Invoke-JobCommand -FilePath "docker" -Arguments @("exec", "sa-postgres", "psql", "-U", $dbUser, "-d", $dbName, "-At", "-c", $columnsSql) -OutputPath (Join-Path $stateDir "live_offers_columns.txt") -TimeoutSeconds 60 -IgnoreExitCode

    if ($columnsRes.ExitCode -ne 0) {
        Add-WarningMessage "Controllo live_offers non riuscito: $($columnsRes.Text.Trim())"
    } else {
        $liveColumns = @($columnsRes.Text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($liveColumns -contains "imported_at") {
            # PATCH_67A_LIVE_OFFERS_QUALITY_START
            function ConvertTo-Patch67Int {
                param(
                    [object]$Value,
                    [int]$Default = 0
                )

                $parsed = 0
                if ([int]::TryParse(([string]$Value).Trim(), [ref]$parsed)) {
                    return $parsed
                }

                return $Default
            }

            $maxAgeHours = ConvertTo-Patch67Int -Value $env:SA_LIVE_OFFERS_MAX_AGE_HOURS -Default 24
            if ($maxAgeHours -lt 1) { $maxAgeHours = 24 }

            $qualitySql = @"
WITH stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'published')::INT AS published_total,
    COUNT(*) FILTER (WHERE status = 'published' AND imported_at >= NOW() - INTERVAL '24 hours')::INT AS published_24h,
    COUNT(*) FILTER (WHERE status = 'published' AND imported_at >= NOW() - INTERVAL '6 hours')::INT AS published_6h,
    CASE
      WHEN MAX(imported_at) IS NULL THEN -1
      ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(imported_at))) / 60)::INT
    END AS latest_age_minutes
  FROM live_offers
),
latest AS (
  SELECT
    imported_at,
    COALESCE(source_channel, '') AS source_channel,
    COALESCE(asin, '') AS asin,
    COALESCE(LEFT(REPLACE(title, '|', ' '), 80), '') AS title
  FROM live_offers
  ORDER BY imported_at DESC NULLS LAST
  LIMIT 1
),
channel_rows AS (
  SELECT
    COALESCE(NULLIF(source_channel, ''), '(n/d)') AS source_channel,
    COUNT(*)::INT AS rows_24h
  FROM live_offers
  WHERE status = 'published'
    AND imported_at >= NOW() - INTERVAL '24 hours'
  GROUP BY COALESCE(NULLIF(source_channel, ''), '(n/d)')
),
channels AS (
  SELECT
    COALESCE(string_agg(source_channel || ':' || rows_24h, ', ' ORDER BY rows_24h DESC, source_channel), 'nessuno') AS channels_24h
  FROM channel_rows
)
SELECT
  s.published_24h || '|' ||
  s.published_6h || '|' ||
  s.published_total || '|' ||
  s.latest_age_minutes || '|' ||
  COALESCE(to_char(l.imported_at, 'YYYY-MM-DD HH24:MI:SS'), '') || '|' ||
  COALESCE(l.source_channel, '') || '|' ||
  COALESCE(l.asin, '') || '|' ||
  COALESCE(l.title, '') || '|' ||
  ch.channels_24h
FROM stats s
LEFT JOIN latest l ON TRUE
CROSS JOIN channels ch;
"@

            $qualityRes = Invoke-JobCommand -FilePath "docker" -Arguments @("exec", "sa-postgres", "psql", "-U", $dbUser, "-d", $dbName, "-At", "-F", "|", "-c", $qualitySql) -OutputPath (Join-Path $stateDir "live_offers_quality.txt") -TimeoutSeconds 60 -IgnoreExitCode

            if ($qualityRes.ExitCode -eq 0) {
                $qualityLine = @($qualityRes.Text -split "`r?`n" | Where-Object { $_ -match "\|" } | Select-Object -First 1)

                if ([string]::IsNullOrWhiteSpace($qualityLine)) {
                    Add-WarningMessage "Controllo qualita Offerte Live senza risultato"
                    $summary.LiveOffersQuality = "ATTENZIONE - controllo qualita senza risultato"
                    $summary.LiveOffers24h = "0"
                    $summary.LiveOffersLast = "Nessuna offerta trovata"
                } else {
                    $parts = ([string]$qualityLine).Split('|')

                    $published24h = if ($parts.Count -gt 0) { ConvertTo-Patch67Int -Value $parts[0] -Default 0 } else { 0 }
                    $published6h = if ($parts.Count -gt 1) { ConvertTo-Patch67Int -Value $parts[1] -Default 0 } else { 0 }
                    $publishedTotal = if ($parts.Count -gt 2) { ConvertTo-Patch67Int -Value $parts[2] -Default 0 } else { 0 }
                    $latestAgeMinutes = if ($parts.Count -gt 3) { ConvertTo-Patch67Int -Value $parts[3] -Default -1 } else { -1 }
                    $latestImportedAt = if ($parts.Count -gt 4) { ([string]$parts[4]).Trim() } else { "" }
                    $latestSource = if ($parts.Count -gt 5) { ([string]$parts[5]).Trim() } else { "" }
                    $latestAsin = if ($parts.Count -gt 6) { ([string]$parts[6]).Trim() } else { "" }
                    $latestTitle = if ($parts.Count -gt 7) { ([string]$parts[7]).Trim() } else { "" }
                    $channels24h = if ($parts.Count -gt 8) { ([string]$parts[8]).Trim() } else { "nessuno" }

                    $summary.LiveOffers24h = [string]$published24h

                    if ([string]::IsNullOrWhiteSpace($latestImportedAt)) {
                        $summary.LiveOffersLast = "Nessuna offerta trovata"
                    } else {
                        $summary.LiveOffersLast = "$latestImportedAt | $latestSource | $latestAsin | $latestTitle"
                    }

                    if ($latestAgeMinutes -ge 0) {
                        $latestAgeHoursText = "$([math]::Round(($latestAgeMinutes / 60), 1))h fa"
                    } else {
                        $latestAgeHoursText = "n/d"
                    }

                    $qualityState = "OK"

                    if ($published24h -le 0) {
                        $qualityState = "ATTENZIONE"
                        Add-WarningMessage "Offerte Live: nessuna offerta pubblicata nelle ultime 24h"
                    } elseif ($latestAgeMinutes -ge 0 -and $latestAgeMinutes -gt ($maxAgeHours * 60)) {
                        $qualityState = "ATTENZIONE"
                        Add-WarningMessage "Offerte Live: ultima offerta piu vecchia di ${maxAgeHours}h"
                    }

                    $summary.LiveOffersQuality = "$qualityState - $published24h pubblicate 24h / $published6h ultime 6h / totale pubblicate: $publishedTotal / ultima: $latestAgeHoursText / canali 24h: $channels24h"
                }
            } else {
                Add-WarningMessage "Controllo qualita Offerte Live non riuscito: $($qualityRes.Text.Trim())"
                $summary.LiveOffersQuality = "ATTENZIONE - controllo qualita non riuscito"
            }
                        # PATCH_67A_LIVE_OFFERS_QUALITY_END
        } elseif ($liveColumns.Count -gt 0) {
            Add-WarningMessage "Tabella live_offers leggibile ma colonna imported_at assente"
        } else {
            Add-WarningMessage "Tabella live_offers non trovata o senza colonne leggibili"
        }
    }

    Write-Host "=== Copio file critici ==="
    Copy-IfExists -Source (Join-Path $ProjectRoot ".env") -Destination (Join-Path $keyFilesDir ".env") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "docker-compose.yml") -Destination (Join-Path $keyFilesDir "docker-compose.yml") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "docker-compose.telegram-live.yml") -Destination (Join-Path $keyFilesDir "docker-compose.telegram-live.yml") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "caddy") -Destination (Join-Path $projectFilesDir "caddy") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "database") -Destination (Join-Path $projectFilesDir "database") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "scripts") -Destination (Join-Path $projectFilesDir "scripts") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "telegram-live\session") -Destination (Join-Path $keyFilesDir "telegram-live-session") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "telegram-live\.env") -Destination (Join-Path $keyFilesDir "telegram-live.env") | Out-Null
    # PATCH_68A_BACKUP_RESTORE_CHECK_COPY_ENV
    Copy-IfExists -Source (Join-Path $ProjectRoot "backend\.env") -Destination (Join-Path $keyFilesDir "backend.env") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "frontend\.env") -Destination (Join-Path $keyFilesDir "frontend.env") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "frontend\.env.local") -Destination (Join-Path $keyFilesDir "frontend.env.local") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "backend\package.json") -Destination (Join-Path $keyFilesDir "backend-package.json") | Out-Null
    Copy-IfExists -Source (Join-Path $ProjectRoot "frontend\package.json") -Destination (Join-Path $keyFilesDir "frontend-package.json") | Out-Null

    Copy-Item -LiteralPath $dbDir -Destination (Join-Path $payloadDir "db") -Recurse -Force
    Copy-Item -LiteralPath $stateDir -Destination (Join-Path $payloadDir "state") -Recurse -Force
    Copy-Item -LiteralPath $logsDir -Destination (Join-Path $payloadDir "logs") -Recurse -Force

    $manifestPath = Join-Path $payloadDir "MANIFEST.txt"
    $manifest = @()
    $manifest += "Smart Assistance backup giornaliero Patch 58.5.1"
    $manifest += "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $manifest += "ProjectRoot: $ProjectRoot"
    $manifest += "BackupRun: $runDir"
    $manifest += ""
    $manifest += "Contenuto:"
    $manifest += "- db/smartassistance.dump"
    $manifest += "- db/smartassistance.sql"
    $manifest += "- key-files/"
    # PATCH_68A_BACKUP_RESTORE_CHECK_MANIFEST
    $manifest += "- key-files/backend.env, frontend.env, frontend.env.local se presenti"
    $manifest += "- project-files/caddy,database,scripts"
    $manifest += "- state/"
    $manifest += "- logs/"
    Save-TextFile -Path $manifestPath -Content ($manifest -join [Environment]::NewLine)

    Write-Host "=== Creo ZIP finale ==="
    $backupZip = Join-Path $BackupRoot "SmartAssistanceBackup-$stamp.zip"
    Create-ZipFromDirectory -SourceDirectory $payloadDir -DestinationZip $backupZip
    if (-not (Test-Path -LiteralPath $backupZip)) {
        Add-ErrorMessage "ZIP backup non creato"
    } else {
        $zipLen = (Get-Item -LiteralPath $backupZip).Length
        if ($zipLen -le 0) { Add-ErrorMessage "ZIP backup creato ma vuoto" }
        $summary.Backup = "OK - $(Split-Path $backupZip -Leaf) - $([math]::Round($zipLen / 1MB, 2)) MB"

        # PATCH_68A_BACKUP_RESTORE_CHECK_RUN_START
        $requireBackendEnv = Test-Path -LiteralPath (Join-Path $ProjectRoot "backend\.env")
        $requireFrontendEnv = (Test-Path -LiteralPath (Join-Path $ProjectRoot "frontend\.env")) -or (Test-Path -LiteralPath (Join-Path $ProjectRoot "frontend\.env.local"))
        $requireTelegramEnv = Test-Path -LiteralPath (Join-Path $ProjectRoot "telegram-live\.env")
        $requireTelegramSession = Test-Path -LiteralPath (Join-Path $ProjectRoot "telegram-live\session\telegram.session")

        $restoreCheck = Test-SaBackupZipRestoreStructure `
            -ZipPath $backupZip `
            -RequireBackendEnv $requireBackendEnv `
            -RequireFrontendEnv $requireFrontendEnv `
            -RequireTelegramEnv $requireTelegramEnv `
            -RequireTelegramSession $requireTelegramSession

        $summary.BackupRestoreCheck = $restoreCheck.Text

        $restoreCheckPath = Join-Path $stateDir "backup_restore_check.json"
        Save-TextFile -Path $restoreCheckPath -Content (($restoreCheck | ConvertTo-Json -Depth 5))

        try {
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            $zipUpdate = [System.IO.Compression.ZipFile]::Open($backupZip, [System.IO.Compression.ZipArchiveMode]::Update)
            try {
                $existingEntry = $zipUpdate.GetEntry("state/backup_restore_check.json")
                if ($existingEntry) { $existingEntry.Delete() }
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipUpdate, $restoreCheckPath, "state/backup_restore_check.json") | Out-Null
            } finally {
                if ($zipUpdate) { $zipUpdate.Dispose() }
            }

            $zipLenFinal = (Get-Item -LiteralPath $backupZip).Length
            $summary.Backup = "OK - $(Split-Path $backupZip -Leaf) - $([math]::Round($zipLenFinal / 1MB, 2)) MB"
        } catch {
            Add-WarningMessage "Backup restore check salvato ma non inserito nello ZIP: $($_.Exception.Message)"
        }

        if (-not $restoreCheck.Ok) {
            Add-WarningMessage "Backup restore check: $($restoreCheck.Text)"
        }
        # PATCH_68A_BACKUP_RESTORE_CHECK_RUN_END
    }

} catch {
    Add-ErrorMessage "Errore generale: $($_.Exception.Message)"
}

$duration = [int]((Get-Date) - $startedAt).TotalSeconds
$status = "OK"
$exitCode = 0
if ($errors.Count -gt 0) {
    $status = "ERRORE"
    $exitCode = 2
} elseif ($warnings.Count -gt 0) {
    $status = "OK CON AVVISI"
    $exitCode = 1
}

# PATCH_65_WEBAPP_ANALYTICS_REPORT_START
function ConvertTo-SaInt {
    param([object]$Value)

    $parsed = 0
    if ([int]::TryParse(([string]$Value).Trim(), [ref]$parsed)) {
        return $parsed
    }

    return 0
}

function Get-WebAppAnalyticsReport {
    $retentionDays = ConvertTo-SaInt $env:SA_ANALYTICS_EVENTS_RETENTION_DAYS
    if ($retentionDays -lt 7) { $retentionDays = 90 }

    $fallback = [pscustomobject]@{
        Available = $false
        Text = "non disponibile"
        VisitsToday = 0
        UniqueCustomersToday = 0
        PeakOnlineToday = 0
        SessionsTotal = 0
        Active5m = 0
        EventsTotal = 0
        LastActivityAt = ""
        RetentionDays = $retentionDays
        Error = ""
    }

    try {
        $sql = "SELECT (SELECT COUNT(*)::INT FROM app_analytics_events WHERE event_type = 'visit' AND created_at::DATE = CURRENT_DATE), (SELECT COUNT(DISTINCT customer_id)::INT FROM app_analytics_events WHERE created_at::DATE = CURRENT_DATE), (SELECT COALESCE(MAX(peak_online), 0)::INT FROM app_analytics_peaks WHERE scope = 'day:' || CURRENT_DATE::TEXT), (SELECT COUNT(*)::INT FROM app_analytics_sessions), (SELECT COUNT(*)::INT FROM app_analytics_sessions WHERE last_seen_at >= NOW() - INTERVAL '5 minutes'), (SELECT COUNT(*)::INT FROM app_analytics_events), (SELECT COALESCE(TO_CHAR(MAX(last_seen_at) AT TIME ZONE 'Europe/Rome', 'YYYY-MM-DD HH24:MI:SS'), '') FROM app_analytics_sessions);"

        $raw = docker exec sa-postgres psql -U sauser -d smartassistance -t -A -F "|" -c $sql 2>&1

        if ($LASTEXITCODE -ne 0) {
            $fallback.Error = (($raw | Out-String).Trim())
            return $fallback
        }

        $line = @($raw | Where-Object { $_ -match "\|" } | Select-Object -First 1)

        if ([string]::IsNullOrWhiteSpace($line)) {
            $fallback.Error = "Query analytics senza risultato"
            return $fallback
        }

        $parts = [string]$line -split "\|"

        $visitsToday = if ($parts.Count -gt 0) { ConvertTo-SaInt $parts[0] } else { 0 }
        $uniqueCustomersToday = if ($parts.Count -gt 1) { ConvertTo-SaInt $parts[1] } else { 0 }
        $peakOnlineToday = if ($parts.Count -gt 2) { ConvertTo-SaInt $parts[2] } else { 0 }
        $sessionsTotal = if ($parts.Count -gt 3) { ConvertTo-SaInt $parts[3] } else { 0 }
        $active5m = if ($parts.Count -gt 4) { ConvertTo-SaInt $parts[4] } else { 0 }
        $eventsTotal = if ($parts.Count -gt 5) { ConvertTo-SaInt $parts[5] } else { 0 }
        $lastActivityAt = if ($parts.Count -gt 6) { ([string]$parts[6]).Trim() } else { "" }

        if ([string]::IsNullOrWhiteSpace($lastActivityAt)) {
            $lastActivityAt = "nessuno"
        }

        return [pscustomobject]@{
            Available = $true
            Text = "visite oggi: $visitsToday / utenti unici oggi: $uniqueCustomersToday / picco oggi: $peakOnlineToday / sessioni totali: $sessionsTotal / attivi 5 min: $active5m / eventi: $eventsTotal / ultimo accesso: $lastActivityAt / retention: ${retentionDays}gg"
            VisitsToday = $visitsToday
            UniqueCustomersToday = $uniqueCustomersToday
            PeakOnlineToday = $peakOnlineToday
            SessionsTotal = $sessionsTotal
            Active5m = $active5m
            EventsTotal = $eventsTotal
            LastActivityAt = $lastActivityAt
            RetentionDays = $retentionDays
            Error = ""
        }
    } catch {
        $fallback.Error = $_.Exception.Message
        return $fallback
    }
}
# PATCH_65_WEBAPP_ANALYTICS_REPORT_END

# PATCH_65_WEBAPP_ANALYTICS_REPORT_LOAD
$webAppAnalytics = Get-WebAppAnalyticsReport

$reportLines = New-Object System.Collections.Generic.List[string]
[void]$reportLines.Add("Smart Assistance - Check giornaliero: $status")
[void]$reportLines.Add("Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$reportLines.Add("Backup: $($summary.Backup)")
# PATCH_68A_BACKUP_RESTORE_CHECK_REPORT
[void]$reportLines.Add("Verifica backup: $($summary.BackupRestoreCheck)")
[void]$reportLines.Add("Backend: $($summary.Backend)")
[void]$reportLines.Add("Frontend: $($summary.Frontend)")
[void]$reportLines.Add("Pubblico: $($summary.Pubblico)")
[void]$reportLines.Add("Postgres dump: $($summary.PostgresDump)")
# PATCH_67A_LIVE_OFFERS_QUALITY_REPORT
[void]$reportLines.Add("Offerte Live: $($summary.LiveOffersQuality)")
[void]$reportLines.Add("Ultima offerta Live: $($summary.LiveOffersLast)")
# PATCH_65_WEBAPP_ANALYTICS_REPORT_LINE
[void]$reportLines.Add("Analytics WebApp: $($webAppAnalytics.Text)")
if ($warnings.Count -gt 0) {
    [void]$reportLines.Add("Avvisi:")
    foreach ($w in $warnings) { [void]$reportLines.Add("- $w") }
}
if ($errors.Count -gt 0) {
    [void]$reportLines.Add("Errori:")
    foreach ($e in $errors) { [void]$reportLines.Add("- $e") }
}
[void]$reportLines.Add("Durata: ${duration}s")

$report = $reportLines -join [Environment]::NewLine
$lastReportPath = Join-Path $BackupRoot "last-daily-check-report.txt"
$jsonReportPath = Join-Path $BackupRoot "last-daily-check-report.json"
try {
    Save-TextFile -Path $lastReportPath -Content $report
    $json = [ordered]@{
        status = $status
        exitCode = $exitCode
        date = (Get-Date).ToString("s")
        backup = $summary.Backup
        # PATCH_68A_BACKUP_RESTORE_CHECK_JSON
        backupRestoreCheck = $summary.BackupRestoreCheck
        backend = $summary.Backend
        frontend = $summary.Frontend
        public = $summary.Pubblico
        postgresDump = $summary.PostgresDump
        liveOffers24h = $summary.LiveOffers24h
        liveOffersLast = $summary.LiveOffersLast
        # PATCH_67A_LIVE_OFFERS_QUALITY_JSON
        liveOffersQuality = $summary.LiveOffersQuality
        # PATCH_65_WEBAPP_ANALYTICS_REPORT_JSON
        webAppAnalytics = $webAppAnalytics
        warnings = @($warnings)
        errors = @($errors)
        durationSeconds = $duration
        runDir = $runDir
    } | ConvertTo-Json -Depth 6
    Save-TextFile -Path $jsonReportPath -Content $json
    Save-TextFile -Path (Join-Path $runDir "backup-check-report.txt") -Content $report
    Save-TextFile -Path (Join-Path $runDir "backup-check-report.json") -Content $json
} catch {
    Write-Host "ERRORE SALVATAGGIO REPORT: $($_.Exception.Message)"
}

Write-Host $report
Write-Host ""

if (-not $NoNotify) {
    $config = Read-MonitorConfig -Path $ConfigPath
    $subject = "Smart Assistance - Check giornaliero: $status"
    $notifyLines = New-Object System.Collections.Generic.List[string]
    [void]$notifyLines.Add("Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    [void]$notifyLines.Add("Report: $status")

    $waSent = Send-WhatsAppNotification -Config $config -Message $report
    [void]$notifyLines.Add("WhatsApp: $waSent")

    $emailSent = Send-EmailNotification -Config $config -Subject $subject -Message $report
    [void]$notifyLines.Add("Email: $emailSent")

    try {
        Save-TextFile -Path (Join-Path $BackupRoot "last-notification-status.txt") -Content ($notifyLines -join [Environment]::NewLine)
        Save-TextFile -Path (Join-Path $runDir "notification-status.txt") -Content ($notifyLines -join [Environment]::NewLine)
    } catch {
        Write-Host "Notifiche: impossibile salvare stato - $($_.Exception.Message)"
    }
}

exit $exitCode
