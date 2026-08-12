# Build and package TLC Attendance Extension
$ErrorActionPreference = "Stop"

$rootDir = $PSScriptRoot
$extensionDir = Join-Path $rootDir "extension"
$frontendPublicDir = Join-Path $rootDir "frontend\public"
$zipPath = Join-Path $frontendPublicDir "tlc_extension.zip"

Write-Host "Building TLC Extension in $extensionDir..." -ForegroundColor Cyan
Set-Location $extensionDir

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing extension dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Running vite build..." -ForegroundColor Yellow
npm run build

if (-not (Test-Path "dist")) {
    Write-Error "Build failed: 'dist' folder was not created."
}

Write-Host "Packaging extension to $zipPath..." -ForegroundColor Cyan

if (-not (Test-Path $frontendPublicDir)) {
    New-Item -ItemType Directory -Path $frontendPublicDir -Force | Out-Null
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$extensionDir\dist\*" -DestinationPath $zipPath -Force

Write-Host "Extension successfully packaged to frontend/public/tlc_extension.zip!" -ForegroundColor Green
Set-Location $rootDir
