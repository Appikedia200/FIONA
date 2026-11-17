#!/bin/bash
# FIONA Backend - Schema Fix Deployment Script
# Run this on VPS: bash DEPLOY_AND_VERIFY.sh

set -e  # Exit on any error

echo "========================================="
echo "FIONA Schema Fix Deployment"
echo "========================================="
echo ""

# Navigate to backend
cd /var/www/fiona/backend

echo "Step 1: Applying schema changes with db push..."
npx prisma db push
echo "✓ Schema pushed to database"
echo ""

echo "Step 2: Regenerating Prisma client..."
npx prisma generate
echo "✓ Prisma client regenerated"
echo ""

echo "Step 3: Rebuilding TypeScript..."
npm run build
echo "✓ TypeScript compiled"
echo ""

echo "Step 4: Restarting backend service..."
pm2 restart fiona-backend
echo "✓ Service restarted"
echo ""

echo "Step 5: Waiting for service to stabilize..."
sleep 3
echo ""

echo "========================================="
echo "Verification"
echo "========================================="
echo ""

echo "Checking service status..."
pm2 describe fiona-backend | grep -E "status|uptime|restarts"
echo ""

echo "Recent logs (last 20 lines):"
pm2 logs fiona-backend --lines 20 --nostream
echo ""

echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Verify the frontend can:"
echo "  1. Load profiles with accountType field"
echo "  2. Display cookies in preview modal"
echo "  3. Use Gmail/GSuite filter tabs"
echo ""
echo "If you see any errors above, run:"
echo "  pm2 logs fiona-backend --lines 50"
