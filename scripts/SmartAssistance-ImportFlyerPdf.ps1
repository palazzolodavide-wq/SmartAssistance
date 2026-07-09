param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,

  [string]$Title = ""
)

$ErrorActionPreference = "Stop"

cd C:\SmartAssistance

$ReportDir = "C:\SmartAssistance\backups\patch-reports"
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$report = Join-Path $ReportDir "flyer_pdf_import_$stamp.txt"

function Log($t = "") {
  Add-Content -Path $report -Encoding UTF8 -Value $t
}

function Section($title) {
  Log ""
  Log $title
  Log ("=" * $title.Length)
}

function SqlQuote([string]$s) {
  if ($null -eq $s) {
    return "NULL"
  }

  return "'" + ($s -replace "'", "''") + "'"
}

# PATCH_84A1_FIX4_RETENTION_FUNCTION
function Invoke-FlyerRetentionCleanup {
  param(
    [int]$MaxFlyers = 2
  )

  Section "RETENTION MAX $MaxFlyers FLYERS"

  $root = "C:\SmartAssistance\storage\flyers"
  $originalDir = Join-Path $root "originals"
  $pagesDir = Join-Path $root "pages"

  $retentionSql = @"
WITH keep AS (
  SELECT id
  FROM flyers
  ORDER BY COALESCE(published_at, imported_at) DESC, id DESC
  LIMIT $MaxFlyers
),
old_flyers AS (
  SELECT id, stored_pdf_path
  FROM flyers
  WHERE id NOT IN (SELECT id FROM keep)
),
old_pages AS (
  SELECT fp.flyer_id, fp.image_path
  FROM flyer_pages fp
  JOIN old_flyers f ON f.id = fp.flyer_id
),
payload AS (
  SELECT 'PDF'::text AS kind, id AS flyer_id, stored_pdf_path AS path
  FROM old_flyers
  WHERE stored_pdf_path IS NOT NULL AND stored_pdf_path <> ''
  UNION ALL
  SELECT 'PAGE'::text AS kind, flyer_id, image_path AS path
  FROM old_pages
  WHERE image_path IS NOT NULL AND image_path <> ''
),
deleted AS (
  DELETE FROM flyers
  WHERE id IN (SELECT id FROM old_flyers)
  RETURNING id
)
SELECT kind, flyer_id, path
FROM payload
UNION ALL
SELECT 'DELETED_FLYER'::text AS kind, id AS flyer_id, ''::text AS path
FROM deleted
ORDER BY flyer_id, kind, path;
"@

  $retentionOut = $retentionSql |
    docker exec -i sa-postgres psql -U sauser -d smartassistance -At -F "|" -v ON_ERROR_STOP=1 2>&1

  $retentionExit = $LASTEXITCODE

  $retentionOut |
    Out-String -Width 500 |
    Add-Content -Path $report -Encoding UTF8

  Log "RetentionExit=$retentionExit"

  if ($retentionExit -ne 0) {
    throw "Retention DB fallita."
  }

  foreach ($line in $retentionOut) {
    $s = [string]$line

    if ([string]::IsNullOrWhiteSpace($s)) {
      continue
    }

    $parts = $s.Split("|", 3)

    if ($parts.Count -lt 3) {
      continue
    }

    $kind = $parts[0]
    $rel = $parts[2]

    if ($kind -notin @("PDF", "PAGE")) {
      continue
    }

    if ([string]::IsNullOrWhiteSpace($rel)) {
      continue
    }

    $relClean = $rel.Replace("/", "\").TrimStart("\")
    $full = Join-Path $root $relClean

    if (Test-Path -LiteralPath $full) {
      Remove-Item -LiteralPath $full -Force
      Log "Deleted old referenced file: $full"
    }
  }

  Section "ORPHAN FILE CLEANUP"

  $keepSql = @"
SELECT stored_pdf_path FROM flyers WHERE stored_pdf_path IS NOT NULL AND stored_pdf_path <> ''
UNION
SELECT image_path FROM flyer_pages WHERE image_path IS NOT NULL AND image_path <> '';
"@

  $keepRows = $keepSql |
    docker exec -i sa-postgres psql -U sauser -d smartassistance -At 2>&1

  $keepSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

  foreach ($row in $keepRows) {
    $value = ([string]$row).Trim()

    if (-not [string]::IsNullOrWhiteSpace($value)) {
      [void]$keepSet.Add($value.Replace("\", "/"))
    }
  }

  $cleanupTargets = @(
    @{ Base = $originalDir; Prefix = "originals" },
    @{ Base = $pagesDir; Prefix = "pages" }
  )

  foreach ($target in $cleanupTargets) {
    if (-not (Test-Path -LiteralPath $target.Base)) {
      continue
    }

    Get-ChildItem -LiteralPath $target.Base -File -Force |
      Where-Object { $_.Name -ne ".gitkeep" } |
      ForEach-Object {
        $relative = "$($target.Prefix)/$($_.Name)"

        if (-not $keepSet.Contains($relative)) {
          Remove-Item -LiteralPath $_.FullName -Force
          Log "Deleted orphan file: $($_.FullName)"
        } else {
          Log "Kept referenced file: $($_.FullName)"
        }
      }
  }

  Section "RETENTION RESULT"

  docker exec sa-postgres psql -U sauser -d smartassistance -At -F "|" -c "SELECT id, title, status, page_count, COALESCE(stored_pdf_path,'') FROM flyers ORDER BY COALESCE(published_at, imported_at) DESC, id DESC;" 2>&1 |
    Add-Content -Path $report -Encoding UTF8
}

Set-Content -Path $report -Encoding UTF8 -Value "Smart Assistance - Manual Flyer PDF Import"
Log "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "PdfPath: $PdfPath"
Log "Title: $Title"
Log ""

try {
  Section "INPUT CHECK"

  if (-not (Test-Path -LiteralPath $PdfPath)) {
    throw "PDF non trovato: $PdfPath"
  }

  $pdfFull = (Resolve-Path -LiteralPath $PdfPath).Path

  if ([System.IO.Path]::GetExtension($pdfFull).ToLowerInvariant() -ne ".pdf") {
    throw "Il file non è un PDF: $pdfFull"
  }

  $originalName = [System.IO.Path]::GetFileName($pdfFull)

  if ([string]::IsNullOrWhiteSpace($Title)) {
    $Title = "Volantino " + (Get-Date -Format "dd/MM/yyyy")
  }

  $hash = (Get-FileHash -LiteralPath $pdfFull -Algorithm SHA256).Hash.ToLowerInvariant()

  Log "PDF: $pdfFull"
  Log "Title: $Title"
  Log "OriginalName: $originalName"
  Log "SHA256: $hash"

  Section "TOOL CHECK"

  docker exec sa-backend sh -lc "command -v pdftoppm && command -v pdfinfo" 2>&1 | Add-Content -Path $report -Encoding UTF8
  if ($LASTEXITCODE -ne 0) {
    throw "pdftoppm/pdfinfo non disponibili nel backend."
  }

  Section "DUPLICATE CHECK"

  $dup = docker exec sa-postgres psql -U sauser -d smartassistance -At -c "SELECT id FROM flyers WHERE file_hash = '$hash' LIMIT 1;" 2>&1
  $dupExit = $LASTEXITCODE
  $dup | Out-String -Width 300 | Add-Content -Path $report -Encoding UTF8

  if ($dupExit -ne 0) {
    throw "Controllo duplicati DB fallito."
  }

  if (-not [string]::IsNullOrWhiteSpace(($dup | Out-String).Trim())) {
    Log "PDF già importato. Nessuna modifica eseguita."
    # PATCH_84A1_FIX4_RETENTION_ON_DUPLICATE
    Invoke-FlyerRetentionCleanup -MaxFlyers 2
    Write-Host ""
    Write-Host "PDF già importato - nessuna modifica." -ForegroundColor Yellow
    Write-Host "Report:" -ForegroundColor Yellow
    Write-Host $report -ForegroundColor Yellow
    exit 0
  }

  Section "STORAGE PREPARE"

  $root = "C:\SmartAssistance\storage\flyers"
  $originalDir = Join-Path $root "originals"
  $pagesDir = Join-Path $root "pages"
  $tmpDir = Join-Path $root "tmp"

  New-Item -ItemType Directory -Path $originalDir -Force | Out-Null
  New-Item -ItemType Directory -Path $pagesDir -Force | Out-Null
  New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

  $runName = "flyer_$stamp"
  $storedPdfName = "$runName.pdf"
  $storedPdfHost = Join-Path $originalDir $storedPdfName

  Copy-Item -LiteralPath $pdfFull -Destination $storedPdfHost -Force

  Log "Stored PDF: $storedPdfHost"

  Section "PDF INFO"

  docker exec sa-backend sh -lc "pdfinfo '/storage/flyers/originals/$storedPdfName' 2>/dev/null | head -40" 2>&1 |
    Add-Content -Path $report -Encoding UTF8

  Section "CONVERT PDF TO JPG"

  Get-ChildItem -LiteralPath $pagesDir -Filter "$runName`_page-*.jpg" -ErrorAction SilentlyContinue |
    Remove-Item -Force

  $convertCmd = "pdftoppm -jpeg -r 150 '/storage/flyers/originals/$storedPdfName' '/storage/flyers/pages/$runName`_page'"
  docker exec sa-backend sh -lc $convertCmd 2>&1 | Add-Content -Path $report -Encoding UTF8
  $convertExit = $LASTEXITCODE

  Log "ConvertExit=$convertExit"

  if ($convertExit -ne 0) {
    throw "Conversione PDF fallita."
  }

  $pages = Get-ChildItem -LiteralPath $pagesDir -Filter "$runName`_page-*.jpg" |
    Sort-Object {
      if ($_.BaseName -match "-(\d+)$") {
        [int]$Matches[1]
      } else {
        999999
      }
    }

  $pageCount = ($pages | Measure-Object).Count

  if ($pageCount -eq 0) {
    throw "Nessuna pagina immagine generata."
  }

  Log "GeneratedPages=$pageCount"
  $pages | Select-Object Name, Length |
    Format-Table -AutoSize |
    Out-String -Width 300 |
    Add-Content -Path $report -Encoding UTF8

  Section "DB IMPORT"

  $pageValues = @()

  foreach ($p in $pages) {
    if ($p.BaseName -match "-(\d+)$") {
      $pageNumber = [int]$Matches[1]
    } else {
      throw "Numero pagina non riconosciuto per file: $($p.Name)"
    }

    $imageName = $p.Name
    $imagePath = "pages/$imageName"

    $pageValues += "(v_flyer_id, $pageNumber, $(SqlQuote $imageName), $(SqlQuote $imagePath), NULL, NULL)"
  }

  $pageValuesSql = $pageValues -join ",`n    "

  $titleSql = SqlQuote $Title
  $originalNameSql = SqlQuote $originalName
  $storedPdfPathSql = SqlQuote "originals/$storedPdfName"
  $hashSql = SqlQuote $hash

  $sql = @"
BEGIN;

DO `$patch84a1`$
DECLARE
  v_flyer_id INTEGER;
BEGIN
  UPDATE flyers
  SET status = 'archived'
  WHERE status = 'active';

  INSERT INTO flyers (
    title,
    source_type,
    original_filename,
    stored_pdf_path,
    file_hash,
    page_count,
    status,
    imported_at,
    published_at
  )
  VALUES (
    $titleSql,
    'manual_pdf',
    $originalNameSql,
    $storedPdfPathSql,
    $hashSql,
    $pageCount,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_flyer_id;

  INSERT INTO flyer_pages (
    flyer_id,
    page_number,
    image_filename,
    image_path,
    width,
    height
  )
  VALUES
    $pageValuesSql;
END
`$patch84a1`$;

COMMIT;
"@

  $sqlFile = Join-Path $tmpDir "import_$runName.sql"
  [System.IO.File]::WriteAllText($sqlFile, $sql, (New-Object System.Text.UTF8Encoding($false)))

  Get-Content -LiteralPath $sqlFile -Raw |
    docker exec -i sa-postgres psql -U sauser -d smartassistance -v ON_ERROR_STOP=1 2>&1 |
    Add-Content -Path $report -Encoding UTF8

  $dbExit = $LASTEXITCODE
  Log "DbImportExit=$dbExit"

  if ($dbExit -ne 0) {
    throw "Import DB fallito."
  }

  Section "ACTIVE FLYER CHECK"

  docker exec sa-postgres psql -U sauser -d smartassistance -At -F "|" -c "SELECT f.id, f.title, f.status, f.page_count, COUNT(fp.id) FROM flyers f LEFT JOIN flyer_pages fp ON fp.flyer_id = f.id WHERE f.status = 'active' GROUP BY f.id, f.title, f.status, f.page_count ORDER BY f.id DESC LIMIT 1;" 2>&1 |
    Add-Content -Path $report -Encoding UTF8

  # PATCH_84A1_FIX4_RETENTION_CALL_AFTER_IMPORT
  Invoke-FlyerRetentionCleanup -MaxFlyers 2

  Section "FINAL GIT STATUS"

  git status --short --untracked-files=all 2>&1 |
    Add-Content -Path $report -Encoding UTF8

  Write-Host ""
  Write-Host "IMPORT VOLANTINO COMPLETATO" -ForegroundColor Green
  Write-Host "Pagine generate: $pageCount" -ForegroundColor Green
  Write-Host "Report:" -ForegroundColor Yellow
  Write-Host $report -ForegroundColor Yellow
}
catch {
  Section "ERROR"
  Log "Errore: $($_.Exception.Message)"
  Log "Import non completato."

  Write-Host ""
  Write-Host "IMPORT VOLANTINO FALLITO" -ForegroundColor Red
  Write-Host "Report:" -ForegroundColor Yellow
  Write-Host $report -ForegroundColor Yellow

  throw
}