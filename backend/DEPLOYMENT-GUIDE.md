# FIONA Backend - Production Deployment Guide

## Environment Configuration

### Backend Environment Variables
The backend uses `.env.production` for production configuration. Key variables:

```bash
# Server
NODE_ENV=production
PORT=8000

# Backend & Panel URLs
BACKEND_URL=https://api.fiona.org
BACKEND_DOMAIN=api.fiona.org
WEB_PANEL_URL=https://fiona.org

# CORS Origins (comma-separated)
CORS_ORIGINS=https://fiona.org,https://www.fiona.org,https://api.fiona.org

# Database
DATABASE_URL="file:./prisma/production.db"

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Cloudflare
CF_API_TOKEN=your_cloudflare_api_token
CF_ACCOUNT_ID=your_cloudflare_account_id
```

### Frontend Environment Variables
The frontend uses `.env.production` for production configuration:

```bash
# Backend API URL (HTTPS)
NEXT_PUBLIC_API_URL=https://api.fiona.org
NEXT_PUBLIC_BACKEND_URL=https://api.fiona.org

# WebSocket URL (WSS for secure WebSocket)
NEXT_PUBLIC_WS_URL=wss://api.fiona.org
```

## Hardcoded References Removed

All hardcoded localhost and ngrok URLs have been replaced with environment variables:

### ✅ Backend Files Updated
- `src/index.ts` - CORS origins now use `CORS_ORIGINS` env var
- `src/services/websocket.service.ts` - WebSocket CORS uses `CORS_ORIGINS` env var
- `src/services/deployment.service.ts` - Uses `BACKEND_URL` env var
- `src/routes/*/` - All routes use environment variables with localhost fallbacks

### ✅ Frontend Files
- `lib/api-client.ts` - Uses `NEXT_PUBLIC_API_URL` env var
- `lib/websocket-client.ts` - Uses `NEXT_PUBLIC_WS_URL` env var

## Deployment Steps

### 1. Backend Deployment (VPS/Server)

```bash
# 1. Copy backend files to server
scp -r backend/* user@api.fiona.org:/var/www/fiona-backend/

# 2. SSH into server
ssh user@api.fiona.org

# 3. Navigate to backend directory
cd /var/www/fiona-backend

# 4. Install dependencies
npm install --production

# 5. Set environment to production
cp .env.production .env

# 6. Update JWT_SECRET in .env (IMPORTANT!)
nano .env  # Change JWT_SECRET to a secure random string

# 7. Run database migrations
npx prisma migrate deploy

# 8. Build TypeScript (if needed)
npm run build

# 9. Start backend with PM2
pm2 start src/index.ts --name fiona-backend --interpreter=tsx
pm2 save
pm2 startup  # Follow instructions to enable startup on boot

# 10. Setup Nginx reverse proxy
# See NGINX-CONFIG.md for configuration
```

### 2. Frontend Deployment

```bash
# 1. Build frontend locally or on server
cd frontend
npm install
npm run build

# 2. Deploy to hosting provider (Vercel/Netlify/etc)
# OR serve with Nginx/PM2
pm2 start npm --name fiona-frontend -- start
```

### 3. SSL Certificate Setup

The backend automatically manages SSL certificates for deployed domains using Let's Encrypt. For the main API domain:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate for api.fiona.org
sudo certbot --nginx -d api.fiona.org

# Auto-renewal is handled by certbot systemd timer
sudo systemctl status certbot.timer
```

### 4. Nginx Configuration

Create `/etc/nginx/sites-available/fiona-backend`:

```nginx
upstream fiona_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.fiona.org;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.fiona.org;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/api.fiona.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.fiona.org/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://fiona_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location / {
        proxy_pass http://fiona_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers (if needed as backup)
        add_header 'Access-Control-Allow-Origin' 'https://fiona.org' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/fiona-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Checklist

- [ ] Change `JWT_SECRET` to a secure random string (64+ characters)
- [ ] Change `ADMIN_SETUP_KEY` to a secure random string
- [ ] Secure Cloudflare API tokens (least privilege)
- [ ] Enable SSL/TLS (`ENABLE_SSL=true`)
- [ ] Review CORS origins (`CORS_ORIGINS` env var)
- [ ] Set strong database passwords
- [ ] Configure firewall (allow 80, 443, 22 only)
- [ ] Setup fail2ban for SSH protection
- [ ] Enable UFW/iptables firewall
- [ ] Regular security updates (`apt update && apt upgrade`)

## Monitoring

```bash
# Check backend logs
pm2 logs fiona-backend

# Check backend status
pm2 status

# Monitor resource usage
pm2 monit

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Backend won't start
- Check logs: `pm2 logs fiona-backend`
- Verify environment variables: `cat .env`
- Check port availability: `netstat -tulpn | grep 8000`
- Verify database connection: `npx prisma db push`

### WebSocket connection fails
- Verify Nginx WebSocket configuration
- Check CORS origins in `.env.production`
- Ensure `NEXT_PUBLIC_WS_URL=wss://api.fiona.org` in frontend

### CORS errors
- Update `CORS_ORIGINS` in backend `.env.production`
- Verify frontend URL is included in CORS_ORIGINS
- Check Nginx CORS headers

### SSL certificate issues
- Renew certificate: `sudo certbot renew`
- Check certificate status: `sudo certbot certificates`
- Verify certificate files exist in `/etc/letsencrypt/live/api.fiona.org/`

## Support

For issues or questions:
- Check logs: `pm2 logs fiona-backend`
- Review backend status: `pm2 status`
- Verify environment variables are set correctly
- Check Nginx configuration: `sudo nginx -t`
