#!/bin/bash
# Server-side fingerprint fix verification and repair script
# Run this on your Ubuntu server: bash SERVER-FIX-FINGERPRINT.sh

echo "======================================"
echo "FIONA Fingerprint Fix - Server Check"
echo "======================================"
echo ""

cd /var/www/fiona/backend || exit 1

echo "1. Checking google-auth-http.service.ts signature..."
echo "----------------------------------------"
grep -n "async startSession" src/services/browser/google-auth-http.service.ts || echo "❌ Method not found!"
echo ""

echo "2. Checking for BrowserFingerprint import..."
echo "----------------------------------------"
grep -n "BrowserFingerprint" src/services/browser/google-auth-http.service.ts | head -3 || echo "❌ Import not found!"
echo ""

echo "3. Checking browser-launch.config.ts for interface..."
echo "----------------------------------------"
grep -n "export interface BrowserFingerprint" src/services/browser/browser-launch.config.ts || echo "❌ Interface not found!"
echo ""

echo "4. Checking session.routes.ts call..."
echo "----------------------------------------"
grep -n "startSession(email, sessionId, fingerprint)" src/routes/public/session.routes.ts || echo "❌ Call not found!"
echo ""

echo "======================================"
echo "If any checks show ❌, your files are out of sync!"
echo ""
echo "FIX OPTIONS:"
echo "1. Run: git pull (if using git)"
echo "2. Re-upload files from local machine"
echo "3. Run the MANUAL FIX below"
echo "======================================"
