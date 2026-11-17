# FIONA Deployment Script (PowerShell)
# Deploy .env changes to VPS and restart

$VPS_IP = "144.172.94.13"
$VPS_USER = "root"
$VPS_PATH = "/var/www/fiona/backend"

Write-Host "🚀 Deploying FIONA to VPS ($VPS_IP)..." -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Copying .env file to VPS..." -ForegroundColor Yellow
scp backend/.env "${VPS_USER}@${VPS_IP}:${VPS_PATH}/.env"

Write-Host ""
Write-Host "🔧 Restarting backend on VPS..." -ForegroundColor Yellow

ssh "${VPS_USER}@${VPS_IP}" @"
cd /var/www/fiona/backend

echo 'Current NODE_ENV:'
grep NODE_ENV .env

echo ''
echo 'Restarting PM2...'
pm2 restart fiona-backend

echo ''
echo '✅ Backend restarted in PRODUCTION mode'
echo 'Watching logs for SSL issuance...'
pm2 logs fiona-backend --lines 30
"@

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
