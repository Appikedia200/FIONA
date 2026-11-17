#!/bin/bash
# Quick build verification script
# Run: cd /var/www/fiona/backend && bash VERIFY_BUILD.sh

set -e

echo "========================================="
echo "FIONA - Build Verification"
echo "========================================="
echo ""

cd /var/www/fiona/backend

echo "Running TypeScript build..."
npm run build

BUILD_EXIT=$?

echo ""
echo "========================================="
if [ $BUILD_EXIT -eq 0 ]; then
  echo "✅ BUILD PASSED - 0 ERRORS"
  echo "========================================="
  echo ""
  echo "Safe to restart PM2:"
  echo "  pm2 restart fiona-backend"
  echo ""
  exit 0
else
  echo "❌ BUILD FAILED - See errors above"
  echo "========================================="
  echo ""
  echo "DO NOT restart PM2 until build passes!"
  echo ""
  exit 1
fi
