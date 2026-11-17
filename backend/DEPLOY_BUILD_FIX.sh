#!/bin/bash
# FIONA - Final Build Fix Deployment
# Run on VPS: cd /var/www/fiona/backend && bash DEPLOY_BUILD_FIX.sh

set -e  # Exit on any error

echo "========================================="
echo "FIONA - Build Fix Deployment"
echo "========================================="
echo ""

cd /var/www/fiona/backend

echo "Step 1: Pushing schema to database..."
npx prisma db push
if [ $? -eq 0 ]; then
  echo "✓ Schema pushed successfully"
else
  echo "✗ Schema push failed!"
  exit 1
fi
echo ""

echo "Step 2: Regenerating Prisma client..."
npx prisma generate
if [ $? -eq 0 ]; then
  echo "✓ Prisma client generated"
else
  echo "✗ Prisma generate failed!"
  exit 1
fi
echo ""

echo "Step 3: Building TypeScript..."
npm run build
BUILD_EXIT=$?
echo ""
if [ $BUILD_EXIT -eq 0 ]; then
  echo "✓ Build passed with 0 errors"
else
  echo "✗ Build FAILED with errors!"
  echo "DO NOT RESTART PM2 - Fix build errors first"
  exit 1
fi
echo ""

echo "Step 4: Restarting backend service..."
pm2 restart fiona-backend
echo "✓ Service restarted"
echo ""

echo "Waiting for service to stabilize..."
sleep 3
echo ""

echo "========================================="
echo "Deployment Status"
echo "========================================="
pm2 describe fiona-backend | grep -E "status|uptime"
echo ""

echo "Recent logs:"
pm2 logs fiona-backend --lines 20 --nostream
echo ""

echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo ""
echo "Verify device prompt flow:"
echo "  1. Enter email"
echo "  2. Enter password"
echo "  3. Device prompt shows 2-digit number"
echo "  4. Approve on phone"
echo "  5. Frontend should stop polling and show success"
echo ""
echo "Check full logs: pm2 logs fiona-backend"
