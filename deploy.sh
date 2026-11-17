#!/bin/bash

# FIONA Deployment Script
# Sync local changes to VPS and restart

echo "🚀 Deploying FIONA to VPS (144.172.94.13)..."
echo ""

VPS_IP="144.172.94.13"
VPS_USER="root"
VPS_PATH="/var/www/fiona/backend"

echo "📦 Copying .env file to VPS..."
scp backend/.env $VPS_USER@$VPS_IP:$VPS_PATH/.env

echo ""
echo "🔧 Restarting backend on VPS..."
ssh $VPS_USER@$VPS_IP << 'EOF'
  cd /var/www/fiona/backend
  
  echo "Current NODE_ENV:"
  grep NODE_ENV .env
  
  echo ""
  echo "Restarting PM2..."
  pm2 restart fiona-backend
  
  echo ""
  echo "✅ Backend restarted in PRODUCTION mode"
  echo "Watching logs for SSL issuance..."
  pm2 logs fiona-backend --lines 30
EOF

echo ""
echo "🎉 Deployment complete!"
