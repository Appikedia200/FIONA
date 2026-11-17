#!/bin/bash
# TURNSTILE ENDPOINT FIX SCRIPT
# Run this on VPS: bash fix-turnstile-endpoint.sh

echo "🔍 DIAGNOSTIC: Checking Turnstile endpoint..."
echo ""

# 1. Check if endpoint exists in source file
echo "1️⃣ Checking domains.ts file..."
ENDPOINT_COUNT=$(grep -c "assign-turnstile" /root/prxyauth-desktop-1.2.4/backend/src/routes/domains.ts)
FILE_LINES=$(wc -l < /root/prxyauth-desktop-1.2.4/backend/src/routes/domains.ts)

echo "   - Endpoint mentions found: $ENDPOINT_COUNT"
echo "   - Total lines in file: $FILE_LINES"

if [ $ENDPOINT_COUNT -lt 2 ]; then
    echo "   ❌ ERROR: Endpoint not found in domains.ts!"
    echo "   Please re-copy the file to VPS"
    exit 1
fi

if [ $FILE_LINES -lt 900 ]; then
    echo "   ❌ ERROR: File too small ($FILE_LINES lines, expected 954)"
    echo "   File was not properly copied!"
    exit 1
fi

echo "   ✅ Source file looks good"
echo ""

# 2. Check if backend is using compiled dist/
echo "2️⃣ Checking backend mode..."
cd /root/prxyauth-desktop-1.2.4/backend

if [ -d "dist" ]; then
    echo "   ⚠️  Backend uses compiled TypeScript (dist/ folder exists)"
    echo "   Need to rebuild..."
    echo ""
    echo "3️⃣ Rebuilding backend..."
    npm run build
    echo "   ✅ Build complete"
else
    echo "   ✅ Backend runs from source (no dist/ folder)"
fi

echo ""
echo "4️⃣ Hard restarting PM2..."
pm2 delete fiona-backend 2>/dev/null || true
sleep 2

# Start backend
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    # Fallback start command
    pm2 start src/index.ts --name fiona-backend --interpreter ts-node
fi

echo "   ✅ Backend restarted"
echo ""
echo "5️⃣ Waiting for backend to start..."
sleep 5

echo ""
echo "6️⃣ Testing endpoint..."
# Test if endpoint responds (expect 401 without auth, not 404)
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/domains/test-123/assign-turnstile)

echo "   Response code: $RESPONSE"

if [ "$RESPONSE" == "404" ]; then
    echo "   ❌ STILL 404 - Endpoint not registered!"
    echo ""
    echo "📋 Backend logs:"
    pm2 logs fiona-backend --nostream --lines 30
elif [ "$RESPONSE" == "401" ] || [ "$RESPONSE" == "403" ]; then
    echo "   ✅ SUCCESS! Endpoint exists (401/403 = needs auth, which is correct)"
elif [ "$RESPONSE" == "500" ]; then
    echo "   ⚠️  Endpoint exists but has error (500)"
    echo ""
    echo "📋 Backend logs:"
    pm2 logs fiona-backend --nostream --lines 20
else
    echo "   ✅ Endpoint registered (code: $RESPONSE)"
fi

echo ""
echo "7️⃣ Showing recent logs..."
pm2 logs fiona-backend --nostream --lines 20

echo ""
echo "🎯 DONE! If still 404, check logs above for errors"
