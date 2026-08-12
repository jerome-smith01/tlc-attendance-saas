# Architecture Review Script
# tools/99.arch_review.ps1
#
# Compares all code changes since the last git tag against the architecture
# documentation library in docs/architecture. Highlights new files and modified
# core files that may require a documentation update. Automatically ignores files/folders
# matching gitignore rules.
#
# Run standalone:  powershell -File tools\99.arch_review.ps1
# Called by:       tools\02.arch_review.bat

param()

$ErrorActionPreference = "Stop"

# ── Header ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  TLC Attendance SaaS -- Architecture Review" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# ── Step 1: Find last git tag ──────────────────────────────────────────────────
Write-Host ""
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$lastTag = git describe --tags --abbrev=0 2>$null
$gitExitCode = $LASTEXITCODE
$ErrorActionPreference = $oldEAP

if ($gitExitCode -ne 0 -or -not $lastTag) {
    Write-Host "[WARN] No git tags found." -ForegroundColor Yellow
    Write-Host "       This is expected on the first publish. All changed files will be reviewed." -ForegroundColor Yellow
    $ErrorActionPreference = "Continue"
    $lastTag = git rev-list --max-parents=0 HEAD 2>$null
    $ErrorActionPreference = $oldEAP
    $tagLabel = "(initial commit)"
} else {
    $tagLabel = $lastTag
}
Write-Host "Baseline:  $tagLabel"

# ── Step 2: Get changed files since baseline ───────────────────────────────────
$ErrorActionPreference = "Continue"
$rawDiff = git diff "$lastTag..HEAD" --name-status 2>$null
$ErrorActionPreference = $oldEAP

if (-not $rawDiff) {
    Write-Host ""
    Write-Host "[OK] No file changes detected since $tagLabel." -ForegroundColor Green
    Write-Host ""
    exit 0
}

$newFiles      = @()
$modifiedFiles = @()

foreach ($line in ($rawDiff -split "`n")) {
    $line = $line.Trim()
    if (-not $line) { continue }
    $parts = $line -split "\s+", 2
    $status = $parts[0]
    $file   = if ($parts.Count -gt 1) { $parts[1] } else { "" }
    if (-not $file) { continue }

    # Fast pattern filter for common build / temp directories
    if ($file -match "^tmp/|^temp/|node_modules/|dist/|\.git/") { continue }

    # Check gitignore rules via git check-ignore
    $ErrorActionPreference = "Continue"
    git check-ignore -q "$file" 2>$null
    $isGitIgnored = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $oldEAP

    if ($isGitIgnored) { continue }

    if ($status -eq "A") {
        $newFiles += $file
    } elseif ($status -match "^[MR]") {
        $modifiedFiles += $file
    }
}

# ── Step 3: Show architecture doc index ───────────────────────────────────────
Write-Host ""
Write-Host "Architecture Docs (docs\architecture\):" -ForegroundColor White
$archDocs = Get-ChildItem "docs\architecture\*.md" -ErrorAction SilentlyContinue | Sort-Object Name
if (-not $archDocs) {
    Write-Host "  [WARN] No architecture docs found!" -ForegroundColor Yellow
} else {
    foreach ($doc in $archDocs) {
        $firstLine = (Get-Content $doc.FullName -First 1 -ErrorAction SilentlyContinue) -replace "^#+\s*", ""
        Write-Host "  $($doc.Name.PadRight(30)) $firstLine"
    }
}

# Build a single string of all arch doc content for keyword matching
$archContent = ""
if ($archDocs) {
    foreach ($doc in $archDocs) {
        $archContent += (Get-Content $doc.FullName -Raw -ErrorAction SilentlyContinue)
    }
}

# ── Step 4: Changed file summary ──────────────────────────────────────────────
$totalChanged = $newFiles.Count + $modifiedFiles.Count
Write-Host ""
Write-Host "Files changed since $tagLabel ($totalChanged total):" -ForegroundColor White

foreach ($f in $newFiles)      { Write-Host "  + NEW      $f" -ForegroundColor Green }
foreach ($f in $modifiedFiles) { Write-Host "  ~ MODIFIED $f" -ForegroundColor Yellow }

# ── Step 5: Coverage analysis ─────────────────────────────────────────────────
Write-Host ""
Write-Host "Coverage Analysis:" -ForegroundColor White
Write-Host ""

# Core architectural patterns — changes here warrant closer inspection for docs synchronization
$corePatterns = @(
    "App", "main", "supabase", "schema", "rls",
    "migration", "store", "context", "router",
    "api", "types", "hooks", "extension"
)

$gaps = @()

# Analyse NEW files (higher scrutiny — they may introduce new patterns)
foreach ($file in $newFiles) {
    if (-not ($file -match "^frontend/src/|^supabase/|^extension/")) { continue }
    $basename    = [System.IO.Path]::GetFileName($file)
    $nameNoExt   = [System.IO.Path]::GetFileNameWithoutExtension($basename)
    $inDocs      = $archContent -imatch [regex]::Escape($nameNoExt)

    if ($inDocs) {
        Write-Host "  [OK] NEW: $file" -ForegroundColor Green
        Write-Host "       -> Referenced in architecture docs." -ForegroundColor DarkGreen
    } else {
        Write-Host "  [!] NEW: $file" -ForegroundColor Red
        Write-Host "       -> Not found in architecture docs. Does it introduce a new pattern or component?" -ForegroundColor Red
        $gaps += $file
    }
}

# Analyse MODIFIED files (flag core architectural files)
foreach ($file in $modifiedFiles) {
    if (-not ($file -match "^frontend/src/|^supabase/|^extension/")) { continue }
    $basename = [System.IO.Path]::GetFileName($file)

    $isCore = $false
    foreach ($pattern in $corePatterns) {
        if ($basename -imatch $pattern) { $isCore = $true; break }
    }

    if ($isCore) {
        Write-Host "  [?] MODIFIED (core): $file" -ForegroundColor Yellow
        Write-Host "       -> Core file changed. Verify architecture docs reflect any pattern changes." -ForegroundColor Yellow
    }
}

# ── Step 6: Prompt ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray

if ($gaps.Count -gt 0) {
    Write-Host ""
    Write-Host "  $($gaps.Count) new file(s) are not yet referenced in the architecture docs." -ForegroundColor Red
    Write-Host "  Review docs\architecture\ and update as needed before proceeding." -ForegroundColor Red
}

while ($true) {
    Write-Host ""
    $response = Read-Host "Have the architecture docs been reviewed and updated as needed? [y/n]"

    if ($response -in @("y", "Y")) {
        Write-Host ""
        Write-Host "[OK] Architecture review complete." -ForegroundColor Green
        Write-Host ""
        exit 0
    }

    Write-Host ""
    Write-Host "Copying an update prompt to your clipboard..." -ForegroundColor Yellow
    
    $prompt = "I ran my architecture review script, and it found that the following files have been changed since the last release. Please review these files and update the markdown documentation in docs\architecture\ so my documentation stays perfectly in sync with the codebase. Provide me with a summary of the changes you made.`n`n"
    if ($newFiles.Count -gt 0) {
        $prompt += "New Files:`n"
        foreach ($f in $newFiles) { $prompt += "- $f`n" }
        $prompt += "`n"
    }
    if ($modifiedFiles.Count -gt 0) {
        $prompt += "Modified Files:`n"
        foreach ($f in $modifiedFiles) { $prompt += "- $f`n" }
    }
    
    Set-Clipboard -Value $prompt
    
    Write-Host "Prompt copied! Paste it into Antigravity to update the docs." -ForegroundColor Cyan
    Write-Host "Waiting... When Antigravity is finished, answer 'y' to the prompt." -ForegroundColor DarkGray
}
