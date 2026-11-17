#!/bin/bash
# FIONA Connection Diagnostic Script
# Run on VPS to diagnose frontend-backend connection issues

echo "🔍 FIONA Connection Diagnostics"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get VPS IP
VPS_IP=$(curl -s ifconfig.me)
echo -e "${BLUE}VPS IP: ${VPS_IP}${NC}"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  BACKEND STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if backend is running
if su - fiona -c "pm2 status" 2>/dev/null | grep -q "fiona-backend"; then
  echo -e "${GREEN}✅ Backend process is running${NC}"
  su - fiona -c "pm2 status" | grep fiona-backend
else
  echo -e "${RED}❌ Backend is NOT running${NC}"
  echo "Start with: su - fiona -c 'cd /var/www/fiona/backend && pm2 start ecosystem.config.js'"
fi
echo ""

# Check if port 8000 is listening
if netstat -tlnp 2>/dev/null | grep -q ":8000" || ss -tlnp 2>/dev/null | grep -q ":8000"; then
  echo -e "${GREEN}✅ Port 8000 is listening${NC}"
  netstat -tlnp 2>/dev/null | grep ":8000" || ss -tlnp 2>/dev/null | grep ":8000"
else
  echo -e "${RED}❌ Port 8000 is NOT listening${NC}"
fi
echo ""

# Test backend health
echo "Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
  echo -e "${GREEN}✅ Backend responds to health check${NC}"
  echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
  echo -e "${RED}❌ Backend does not respond${NC}"
  echo "Response: $HEALTH_RESPONSE"
fi
echo ""

# Check recent backend logs
echo "Recent backend logs (last 10 lines):"
su - fiona -c "pm2 logs fiona-backend --nostream --lines 10" 2>/dev/null || echo "Cannot read logs"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  NGINX STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Nginx is running
if systemctl is-active --quiet nginx; then
  echo -e "${GREEN}✅ Nginx is running${NC}"
else
  echo -e "${RED}❌ Nginx is NOT running${NC}"
  systemctl status nginx --no-pager
fi
echo ""

# Check Nginx enabled sites
echo "Enabled Nginx sites:"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "No sites enabled"
echo ""

# Check if api.fioona.org config exists
if [ -f "/etc/nginx/sites-available/api.fioona.org" ]; then
  echo -e "${GREEN}✅ api.fioona.org config exists${NC}"
else
  echo -e "${RED}❌ api.fioona.org config MISSING${NC}"
  echo "This is likely the problem!"
fi
echo ""

if [ -f "/etc/nginx/sites-available/fioona.org" ]; then
  echo -e "${GREEN}✅ fioona.org config exists${NC}"
else
  echo -e "${YELLOW}⚠️  fioona.org config missing${NC}"
fi
echo ""

# Test Nginx config
echo "Nginx configuration test:"
if nginx -t 2>&1; then
  echo -e "${GREEN}✅ Nginx config is valid${NC}"
else
  echo -e "${RED}❌ Nginx config has errors${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  DNS RECORDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Checking DNS resolution..."
for domain in fioona.org www.fioona.org api.fioona.org; do
  IP=$(dig +short $domain 2>/dev/null | tail -n1)
  if [ -n "$IP" ]; then
    if [ "$IP" = "$VPS_IP" ]; then
      echo -e "${GREEN}✅ $domain → $IP${NC}"
    else
      echo -e "${YELLOW}⚠️  $domain → $IP (expected: $VPS_IP)${NC}"
    fi
  else
    echo -e "${RED}❌ $domain → NOT FOUND${NC}"
  fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  SSL CERTIFICATES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for domain in api.fioona.org fioona.org; do
  if [ -d "/etc/letsencrypt/live/$domain" ]; then
    echo -e "${GREEN}✅ SSL certificate exists for $domain${NC}"
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$domain/cert.pem" 2>/dev/null | cut -d= -f2)
    echo "   Expires: $CERT_EXPIRY"
  else
    echo -e "${RED}❌ No SSL certificate for $domain${NC}"
  fi
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  FIREWALL STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v ufw &> /dev/null; then
  echo "UFW Status:"
  ufw status | grep -E "(Status|80|443|22)" || echo "UFW not configured"
else
  echo "UFW not installed"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  CONNECTIVITY TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test localhost
echo "Testing http://localhost:8000/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Responds with HTTP $HTTP_CODE${NC}"
else
  echo -e "${RED}❌ Responds with HTTP $HTTP_CODE${NC}"
fi
echo ""

# Test api domain (if configured)
if [ -f "/etc/nginx/sites-enabled/api.fioona.org" ]; then
  echo "Testing https://api.fioona.org/health"
  API_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.fioona.org/health 2>/dev/null)
  if [ "$API_HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Responds with HTTP $API_HTTP_CODE${NC}"
  else
    echo -e "${RED}❌ Responds with HTTP $API_HTTP_CODE (or not accessible)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  api.fioona.org not configured, skipping test${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  BACKEND ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "/var/www/fiona/backend/.env" ]; then
  echo "Backend .env file (sensitive values hidden):"
  cat /var/www/fiona/backend/.env | grep -v "SECRET\|TOKEN\|PASSWORD" | grep -E "^[A-Z_]+" || echo "Cannot read .env"
else
  echo -e "${RED}❌ .env file not found${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ISSUES=0

# Check critical issues
if ! su - fiona -c "pm2 status" 2>/dev/null | grep -q "fiona-backend"; then
  echo -e "${RED}❌ Backend not running${NC}"
  ((ISSUES++))
fi

if ! [ -f "/etc/nginx/sites-enabled/api.fioona.org" ]; then
  echo -e "${RED}❌ api.fioona.org Nginx config missing${NC}"
  ((ISSUES++))
fi

API_IP=$(dig +short api.fioona.org 2>/dev/null | tail -n1)
if [ "$API_IP" != "$VPS_IP" ]; then
  echo -e "${RED}❌ DNS for api.fioona.org not pointing to this server${NC}"
  ((ISSUES++))
fi

if [ ! -d "/etc/letsencrypt/live/api.fioona.org" ]; then
  echo -e "${YELLOW}⚠️  No SSL certificate for api.fioona.org${NC}"
  ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ No critical issues detected!${NC}"
  echo ""
  echo "If frontend still can't connect, check:"
  echo "  1. Frontend .env.local has: NEXT_PUBLIC_API_URL=https://api.fioona.org"
  echo "  2. Frontend is rebuilt after changing .env"
  echo "  3. Browser console for specific errors"
else
  echo -e "${RED}Found $ISSUES issue(s) - run fix-api-connection.sh to resolve${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
