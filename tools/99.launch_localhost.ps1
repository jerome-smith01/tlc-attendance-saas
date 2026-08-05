# Set window title via host
$host.ui.RawUI.WindowTitle = "01. TLC Attendance Localhost"

Write-Host "Starting TLC Attendance SaaS local server..." -ForegroundColor Cyan

# Navigate to the frontend directory relative to this script
$frontendDir = Join-Path $PSScriptRoot "..\frontend"

if (Test-Path $frontendDir) {
    Set-Location $frontendDir
    Write-Host "Navigated to: $frontendDir" -ForegroundColor Gray
    
    # Check if node_modules exists, if not warn/suggest installing
    if (-not (Test-Path "node_modules")) {
        Write-Host "Warning: node_modules folder not found. Running 'npm install'..." -ForegroundColor Yellow
        npm install
    }
    
    Write-Host "Launching Vite development server..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host "Error: Frontend directory not found at $frontendDir" -ForegroundColor Red
}
