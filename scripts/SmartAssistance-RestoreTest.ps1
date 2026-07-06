param(
    [string]$ProjectRoot = "C:\SmartAssistance",
    [string]$BackupRoot = "C:\SmartAssistance\backups",
    [string]$BackupZip = "",
    [string]$ContainerName = "sa-restoretest-postgres",
    [string]$VolumeName = "sa_restoretest_pgdata",
    [string]$ImageName = "postgres:16",
    [switch]$KeepContainer
)

$ErrorActionPreference = "Stop"

$startedAt = Get-Date
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $BackupRoot "restore-test-run-$stamp"
$extractDir = Join-Path $runDir "extract"
$reportTxtPath = Join-Path $BackupRoot "last-restore-test-report.txt"
$reportJsonPath = Join-Path $BackupRoot "last-restore-test-report.json"

$warnings = New-Object System.Collections.Generic.List[string]
$errors = New-Object System.Collections.Generic.List[string]
$tableChecks = New-Object System.Collections.Generic.List[object]

$restoreMethod = "NON ESEGUITO"
$selectedBackup = ""
$dumpPath = ""
$sqlPath = ""
$publicTableCount = 0
$cleanupText = "NON ESEGUITO"

function Add-WarningMessage {
    param([string]$Message)
    if (-not [string]::IsNullOrWhiteSpace($Message)) {
        [void]$warnings.Add($Message)
    }
}

function Add-ErrorMessage {
    param([string]$Message)
    if (-not [string]::IsNullOrWhiteSpace($Message)) {
        [void]$errors.Add($Message)
    }
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

    $parent = Split-Path $Path -Parent
    if ($parent) { Ensure-Directory $parent }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Invoke-Docker {
    param(
        [string[]]$ArgsList,
        [switch]$AllowFailure
    )

    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $output = & docker @ArgsList 2>&1
        $exit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $oldPreference
    }

    $text = (($output | Out-String -Width 300).Trim())

    if ($exit -ne 0 -and -not $AllowFailure) {
        throw "docker $($ArgsList -join ' ') non riuscito [$exit]: $text"
    }

    return [pscustomobject]@{
        ExitCode = $exit
        Text = $text
    }
}

function Invoke-RestorePsql {
    param(
        [string]$Sql,
        [switch]$AllowFailure
    )

    return Invoke-Docker `
        -ArgsList @(
            "exec",
            "-e", "PGPASSWORD=restoretest",
            $ContainerName,
            "psql",
            "-U", "sauser",
            "-d", "smartassistance",
            "-t",
            "-A",
            "-F", "|",
            "-c", $Sql
        ) `
        -AllowFailure:$AllowFailure
}

function Get-FirstDataLine {
    # PATCH_71C_RESTORE_TEST_STRING_PARSE_FIX
    param([object]$Text)

    if ($null -eq $Text) {
        return ""
    }

    $value = [string]$Text
    $lines = $value -split "\r?\n"

    foreach ($line in $lines) {
        $trimmed = ([string]$line).Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
            return $trimmed
        }
    }

    return ""
}
function Test-TableExists {
    param([string]$TableName)

    $res = Invoke-RestorePsql -Sql "SELECT CASE WHEN to_regclass('public.$TableName') IS NULL THEN 'false' ELSE 'true' END;"
    $value = Get-FirstDataLine $res.Text
    return ($value -eq "true")
}

function Get-TableCount {
    param([string]$TableName)

    $res = Invoke-RestorePsql -Sql "SELECT COUNT(*)::BIGINT FROM public.$TableName;"
    $value = Get-FirstDataLine $res.Text

    $parsed = 0
    if ([int64]::TryParse($value, [ref]$parsed)) {
        return $parsed
    }

    return 0
}

function Select-LatestBackupZip {
    if (-not [string]::IsNullOrWhiteSpace($BackupZip)) {
        $provided = Get-Item -LiteralPath $BackupZip -ErrorAction Stop
        return $provided
    }

    $latest = Get-ChildItem -LiteralPath $BackupRoot -Filter "SmartAssistanceBackup-*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Length -gt 1MB } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $latest) {
        throw "Nessun backup ZIP valido trovato in $BackupRoot"
    }

    return $latest
}

function Write-FinalReport {
    # PATCH_71B_RESTORE_TEST_REPORT_FIX
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

    $tableArray = @()
    foreach ($item in $tableChecks) {
        $tableArray += [pscustomobject]@{
            name = [string]$item.name
            required = [bool]$item.required
            exists = [bool]$item.exists
            rows = $item.rows
        }
    }

    $warningArray = @()
    foreach ($warning in $warnings) {
        $warningArray += [string]$warning
    }

    $errorArray = @()
    foreach ($err in $errors) {
        $errorArray += [string]$err
    }

    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add("Smart Assistance - Restore test: $status")
    [void]$lines.Add("Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    [void]$lines.Add("Backup usato: $selectedBackup")
    [void]$lines.Add("Metodo restore: $restoreMethod")
    [void]$lines.Add("Container temporaneo: $ContainerName")
    [void]$lines.Add("Volume temporaneo: $VolumeName")
    [void]$lines.Add("Tabelle public: $publicTableCount")
    [void]$lines.Add("Cleanup: $cleanupText")
    [void]$lines.Add("Durata: ${duration}s")

    if ($tableArray.Count -gt 0) {
        [void]$lines.Add("")
        [void]$lines.Add("Tabelle verificate:")
        foreach ($item in $tableArray) {
            $rowText = if ($null -eq $item.rows) { "-" } else { [string]$item.rows }
            [void]$lines.Add("- $($item.name): exists=$($item.exists) / rows=$rowText / required=$($item.required)")
        }
    }

    if ($warningArray.Count -gt 0) {
        [void]$lines.Add("")
        [void]$lines.Add("Avvisi:")
        foreach ($warning in $warningArray) {
            [void]$lines.Add("- $warning")
        }
    }

    if ($errorArray.Count -gt 0) {
        [void]$lines.Add("")
        [void]$lines.Add("Errori:")
        foreach ($err in $errorArray) {
            [void]$lines.Add("- $err")
        }
    }

    $reportText = $lines -join [Environment]::NewLine

    try {
        Save-TextFile -Path $reportTxtPath -Content $reportText
        Save-TextFile -Path (Join-Path $runDir "restore-test-report.txt") -Content $reportText
    } catch {
        Write-Host "ERRORE salvataggio TXT restore test: $($_.Exception.Message)"
    }

    try {
        $jsonObj = [pscustomobject][ordered]@{
            status = $status
            exitCode = $exitCode
            date = (Get-Date).ToString("s")
            backupZip = [string]$selectedBackup
            restoreMethod = [string]$restoreMethod
            containerName = [string]$ContainerName
            volumeName = [string]$VolumeName
            publicTableCount = [int]$publicTableCount
            tableChecks = @($tableArray)
            warnings = @($warningArray)
            errors = @($errorArray)
            cleanup = [string]$cleanupText
            durationSeconds = [int]$duration
            runDir = [string]$runDir
        }

        $json = $jsonObj | ConvertTo-Json -Depth 10
        Save-TextFile -Path $reportJsonPath -Content $json
        Save-TextFile -Path (Join-Path $runDir "restore-test-report.json") -Content $json
    } catch {
        $fallbackJson = [pscustomobject]@{
            status = "ERRORE"
            exitCode = 2
            date = (Get-Date).ToString("s")
            backupZip = [string]$selectedBackup
            restoreMethod = [string]$restoreMethod
            publicTableCount = [int]$publicTableCount
            warnings = @("Report JSON restore test non generato: $($_.Exception.Message)")
            errors = @($errorArray)
            cleanup = [string]$cleanupText
            durationSeconds = [int]$duration
            runDir = [string]$runDir
        } | ConvertTo-Json -Depth 6

        Save-TextFile -Path $reportJsonPath -Content $fallbackJson
        Save-TextFile -Path (Join-Path $runDir "restore-test-report.json") -Content $fallbackJson
    }

    Write-Host $reportText
    exit $exitCode
}
try {
    Ensure-Directory $BackupRoot
    Ensure-Directory $runDir
    Ensure-Directory $extractDir

    if (-not (Test-Path -LiteralPath $ProjectRoot)) {
        throw "ProjectRoot non trovato: $ProjectRoot"
    }

    $backupItem = Select-LatestBackupZip
    $selectedBackup = $backupItem.FullName

    Write-Host "Smart Assistance - Restore test reale"
    Write-Host "Backup: $selectedBackup"
    Write-Host "Container temporaneo: $ContainerName"
    Write-Host ""

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($backupItem.FullName, $extractDir)

    $dumpPath = Join-Path $extractDir "db\smartassistance.dump"
    $sqlPath = Join-Path $extractDir "db\smartassistance.sql"

    if (-not (Test-Path -LiteralPath $dumpPath)) {
        throw "Dump custom non trovato nel backup: db\smartassistance.dump"
    }

    if (-not (Test-Path -LiteralPath $sqlPath)) {
        Add-WarningMessage "Dump SQL fallback non trovato nel backup: db\smartassistance.sql"
    }

    Write-Host "=== Pulizia eventuale container restore precedente ==="
    Invoke-Docker -ArgsList @("rm", "-f", $ContainerName) -AllowFailure | Out-Null
    Invoke-Docker -ArgsList @("volume", "rm", $VolumeName) -AllowFailure | Out-Null

    Write-Host "=== Verifica immagine PostgreSQL ==="
    $imageCheck = Invoke-Docker -ArgsList @("image", "inspect", $ImageName) -AllowFailure
    if ($imageCheck.ExitCode -ne 0) {
        Write-Host "Immagine $ImageName non trovata localmente. Provo docker pull..."
        Invoke-Docker -ArgsList @("pull", $ImageName) | Out-Null
    }

    Write-Host "=== Avvio container temporaneo ==="
    Invoke-Docker -ArgsList @(
        "run", "-d",
        "--name", $ContainerName,
        "-e", "POSTGRES_USER=sauser",
        "-e", "POSTGRES_PASSWORD=restoretest",
        "-e", "POSTGRES_DB=smartassistance",
        "-v", "${VolumeName}:/var/lib/postgresql/data",
        $ImageName
    ) | Out-Null

    Write-Host "=== Attesa PostgreSQL temporaneo ==="
    $ready = $false
    for ($i = 1; $i -le 60; $i += 1) {
        $probe = Invoke-Docker -ArgsList @(
            "exec",
            "-e", "PGPASSWORD=restoretest",
            $ContainerName,
            "pg_isready",
            "-U", "sauser",
            "-d", "smartassistance"
        ) -AllowFailure

        if ($probe.ExitCode -eq 0) {
            $ready = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if (-not $ready) {
        throw "PostgreSQL temporaneo non pronto entro il timeout"
    }

    Write-Host "=== Copia dump nel container temporaneo ==="
    Invoke-Docker -ArgsList @("cp", $dumpPath, "${ContainerName}:/tmp/smartassistance.dump") | Out-Null

    Write-Host "=== Restore da dump custom ==="
    Invoke-RestorePsql -Sql "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO sauser;" | Out-Null

    try {
        Invoke-Docker -ArgsList @(
            "exec",
            "-e", "PGPASSWORD=restoretest",
            $ContainerName,
            "pg_restore",
            "-U", "sauser",
            "-d", "smartassistance",
            "--no-owner",
            "--no-acl",
            "/tmp/smartassistance.dump"
        ) | Out-Null

        $restoreMethod = "custom dump"
    } catch {
        Add-WarningMessage "Restore custom dump fallito: $($_.Exception.Message)"

        if (-not (Test-Path -LiteralPath $sqlPath)) {
            throw "Restore custom fallito e dump SQL fallback assente"
        }

        Write-Host "=== Fallback restore da SQL ==="
        Invoke-RestorePsql -Sql "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO sauser;" | Out-Null
        Invoke-Docker -ArgsList @("cp", $sqlPath, "${ContainerName}:/tmp/smartassistance.sql") | Out-Null
        Invoke-Docker -ArgsList @(
            "exec",
            "-e", "PGPASSWORD=restoretest",
            $ContainerName,
            "psql",
            "-U", "sauser",
            "-d", "smartassistance",
            "-v", "ON_ERROR_STOP=1",
            "-f", "/tmp/smartassistance.sql"
        ) | Out-Null

        $restoreMethod = "plain SQL fallback"
    }

    Write-Host "=== Verifica tabelle ripristinate ==="
    $tableCountResult = Invoke-RestorePsql -Sql "SELECT COUNT(*)::INT FROM pg_tables WHERE schemaname='public';"
    $publicTableCountText = Get-FirstDataLine $tableCountResult.Text
    # PATCH_71C_RESTORE_TEST_PUBLIC_TABLE_COUNT_PARSE_FIX
    $parsedPublicTableCount = 0
    if ([int]::TryParse($publicTableCountText, [ref]$parsedPublicTableCount)) {
        $publicTableCount = $parsedPublicTableCount
    } else {
        $publicTableCount = 0
    }

    if ($publicTableCount -le 0) {
        Add-ErrorMessage "Nessuna tabella public trovata dopo restore"
    }

    $tablesToCheck = @(
        @{ name = "users"; required = $true },
        @{ name = "devices"; required = $true },
        @{ name = "offers"; required = $true },
        @{ name = "support_requests"; required = $true },
        @{ name = "live_offers"; required = $false },
        @{ name = "live_offer_sources"; required = $false },
        @{ name = "live_offer_settings"; required = $false },
        @{ name = "offer_clicks"; required = $false },
        @{ name = "app_analytics_sessions"; required = $false },
        @{ name = "app_analytics_events"; required = $false },
        @{ name = "app_analytics_peaks"; required = $false },
        @{ name = "webapp_guides"; required = $false },
        @{ name = "whatsapp_broadcasts"; required = $false },
        @{ name = "whatsapp_broadcast_recipients"; required = $false }
    )

    foreach ($table in $tablesToCheck) {
        $name = [string]$table.name
        $required = [bool]$table.required
        $exists = Test-TableExists -TableName $name
        $rows = $null

        if ($exists) {
            $rows = Get-TableCount -TableName $name
        } elseif ($required) {
            Add-ErrorMessage "Tabella obbligatoria assente dopo restore: $name"
        } else {
            Add-WarningMessage "Tabella opzionale assente dopo restore: $name"
        }

        [void]$tableChecks.Add([pscustomobject]@{
            name = $name
            required = $required
            exists = $exists
            rows = $rows
        })
    }

} catch {
    Add-ErrorMessage $_.Exception.Message
} finally {
    try {
        if (-not $KeepContainer) {
            Invoke-Docker -ArgsList @("rm", "-f", $ContainerName) -AllowFailure | Out-Null
            Invoke-Docker -ArgsList @("volume", "rm", $VolumeName) -AllowFailure | Out-Null
            $cleanupText = "container e volume temporanei rimossi"
        } else {
            $cleanupText = "container e volume temporanei mantenuti per debug"
        }
    } catch {
        $cleanupText = "cleanup non riuscito: $($_.Exception.Message)"
        Add-WarningMessage $cleanupText
    }

    try {
        if (Test-Path -LiteralPath $extractDir) {
            Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Add-WarningMessage "Pulizia extract restore non riuscita: $($_.Exception.Message)"
    }

    Write-FinalReport
}
