#!/bin/bash
#
# FIONA Design - Production Deployment Script
#

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 FIONA Design - Deployment Starting..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get current directory (where script is located)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "📁 Working directory: $APP_DIR"
echo ""

# ============================================================================
# STEP 1: CREATE .ENV IF NOT EXISTS
# ============================================================================
echo "📋 Step 1: Checking environment configuration..."

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env <<'EOF'
# Server Configuration
PORT=8000
NODE_ENV=production
ENABLE_SSL=false
ENABLE_MOCK_MODE=false

# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret
JWT_SECRET=super_secret_jwt_key_$(date +%s)_random

# Admin Setup Key
SUPER_ADMIN_SETUP_KEY=super_admin_setup_key_$(date +%s)_random

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# SSL Configuration
ACME_EMAIL=admin@yourdomain.com
ACME_DIRECTORY_URL=https://acme-v02.api.letsencrypt.org/directory
EOF
    echo "✅ .env file created"
    echo "⚠️  Edit .env to add your Telegram tokens if needed"
else
    echo "✅ .env file exists"
fi
echo ""

# ============================================================================
# STEP 2: INSTALL DEPENDENCIES
# ============================================================================
echo "📦 Step 2: Installing dependencies..."

npm install --production

echo "✅ Dependencies installed"
echo ""

# ============================================================================
# STEP 3: SETUP DATABASE
# ============================================================================
echo "🗄️  Step 3: Setting up database..."

npx prisma generate
npx prisma db push --skip-generate --accept-data-loss

echo "✅ Database initialized"
echo ""

# ============================================================================
# STEP 4: INSTALL PM2 (if not installed)
# ============================================================================
echo "⚙️  Step 4: Checking PM2..."

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo "✅ PM2 ready"
echo ""

# ============================================================================
# STEP 5: START APPLICATION
# ============================================================================
echo "🚀 Step 5: Starting application..."

# Stop if already running
pm2 delete fiona-backend 2>/dev/null || true

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 list
pm2 save

# Setup startup
pm2 startup systemd 2>/dev/null | tail -n 1 | bash || true

echo "✅ Application started"
echo ""

# ============================================================================
# STEP 6: HEALTH CHECK
# ============================================================================
echo "🏥 Step 6: Health check..."

sleep 5

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Health check pending (backend may still be starting)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Useful commands:"
echo "  pm2 status              # Check status"
echo "  pm2 logs fiona-backend  # View logs"
echo "  pm2 restart fiona-backend # Restart"
echo ""
echo "🌐 Backend running on: http://localhost:8000"
echo ""
