# FIONA Design - Prepare Backend for VPS Upload
# This script creates a clean zip file ready for upload

Write-Host "🚀 FIONA Design - Preparing Backend for VPS Upload" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

$BackendPath = "$PSScriptRoot\backend"
$OutputZip = "$PSScriptRoot\fiona-backend.zip"

# Check if backend folder exists
if (-not (Test-Path $BackendPath)) {
    Write-Host "❌ Error: backend folder not found at: $BackendPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Cleaning up old files..." -ForegroundColor Yellow

# Remove old zip if exists
if (Test-Path $OutputZip) {
    Remove-Item $OutputZip -Force
    Write-Host "   ✅ Removed old zip file" -ForegroundColor Green
}

# Remove node_modules from backend (will be installed on VPS)
$NodeModules = Join-Path $BackendPath "node_modules"
if (Test-Path $NodeModules) {
    Write-Host "   ⏳ Removing node_modules (will be installed on VPS)..." -ForegroundColor Yellow
    Remove-Item $NodeModules -Recurse -Force
    Write-Host "   ✅ node_modules removed" -ForegroundColor Green
}

# Remove database file if exists (will be created on VPS)
$DbFile = Join-Path $BackendPath "prisma\dev.db"
if (Test-Path $DbFile) {
    Remove-Item $DbFile -Force
    Write-Host "   ✅ Removed dev.db (will be created on VPS)" -ForegroundColor Green
}

# Remove .env file (will be created on VPS)
$EnvFile = Join-Path $BackendPath ".env"
if (Test-Path $EnvFile) {
    Remove-Item $EnvFile -Force
    Write-Host "   ✅ Removed .env (will be created on VPS)" -ForegroundColor Green
}

Write-Host ""
Write-Host "📦 Creating zip file..." -ForegroundColor Yellow

# Create zip file
try {
    # Get all items in backend folder
    $items = Get-ChildItem -Path $BackendPath -Recurse
    
    # Create zip
    Compress-Archive -Path "$BackendPath\*" -DestinationPath $OutputZip -Force
    
    # Get zip file size
    $zipSize = (Get-Item $OutputZip).Length / 1MB
    
    Write-Host "   ✅ Zip file created successfully!" -ForegroundColor Green
    Write-Host "   📊 Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "❌ Error creating zip file: $_" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Upload zip to VPS:" -ForegroundColor Yellow
Write-Host "   scp `"$OutputZip`" fiona@YOUR_VPS_IP:/var/www/fiona/" -ForegroundColor White
Write-Host ""
Write-Host "2. SSH into VPS:" -ForegroundColor Yellow
Write-Host "   ssh fiona@YOUR_VPS_IP" -ForegroundColor White
Write-Host ""
Write-Host "3. Extract zip on VPS:" -ForegroundColor Yellow
Write-Host "   cd /var/www/fiona" -ForegroundColor White
Write-Host "   unzip fiona-backend.zip" -ForegroundColor White
Write-Host "   rm fiona-backend.zip" -ForegroundColor White
Write-Host ""
Write-Host "4. Run deployment script:" -ForegroundColor Yellow
Write-Host "   chmod +x deploy.sh" -ForegroundColor White
Write-Host "   ./deploy.sh" -ForegroundColor White
Write-Host ""
Write-Host "✅ Zip file ready at:" -ForegroundColor Green
Write-Host "   $OutputZip" -ForegroundColor White
Write-Host ""
Write-Host "🔥 Ready to deploy!" -ForegroundColor Green
