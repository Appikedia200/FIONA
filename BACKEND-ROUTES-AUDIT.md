# Backend Routes Status - Frontend Implementation Audit

## ❌ COMPLETELY UNUSED ROUTES (Backend exists, no frontend page)

### 1. `/api/admin/resources` - Resource Manager
**Backend File:** `backend/src/routes/admin/resources.routes.ts`

**Available Endpoints:**
- `GET /api/admin/resources` - Get VPS resource stats (CPU, RAM, disk, sessions)
- `GET /api/admin/resources/sessions` - Get all active sessions from memory registry
- `GET /api/admin/resources/profiles` - Get all launched profiles from memory registry
- `POST /api/admin/resources/sessions/:id/close` - Force close a session
- `POST /api/admin/resources/profiles/:id/close` - Force close a profile

**Frontend Status:** ❌ No page exists. No API calls found.

**Recommended Frontend Page:** `/admin/resources/page.tsx` - Real-time resource monitoring dashboard

---

### 2. `/api/admin/activity` - Activity Feed
**Backend File:** `backend/src/routes/admin/activity.routes.ts`

**Available Endpoints:**
- `GET /api/admin/activity?limit=20` - Get recent activity feed (sessions, captures, failures)

**Frontend Status:** ❌ No page exists. No API calls found.

**Recommended Frontend Usage:** Dashboard widget showing recent activity events

---

### 3. `/api/capture` - Public Credential Capture
**Backend File:** `backend/src/routes/public/capture.routes.ts`

**Frontend Status:** ❌ Not called from frontend (this is called by phishing pages, not the admin panel)

**Note:** This is intentionally not wired to the admin panel - it's used by external phishing templates

---

### 4. `/api/google/session` - Public Session Management
**Backend File:** `backend/src/routes/public/session.routes.ts`

**Frontend Status:** ❌ Not called from frontend (used by phishing pages)

**Note:** This is intentionally not wired to the admin panel - it's used by external phishing templates

---

## ⚠️ PARTIALLY IMPLEMENTED (Used but with hardcoded URLs)

### 5. `/api/admin/workers` - Background Workers Status
**Backend File:** `backend/src/routes/admin/workers.routes.ts`

**Available Endpoints:**
- `GET /api/admin/workers` - Get background worker status (cleanup, websocket, resource manager)

**Frontend Page:** ✅ `frontend/app/admin/infrastructure/workers/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/admin/workers', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient.get('/api/admin/workers')`

---

### 6. `/api/technician/stats` - Technician Dashboard Stats
**Backend File:** `backend/src/routes/technician/stats.routes.ts`

**Available Endpoints:**
- `GET /api/technician/stats` - Get technician-specific statistics

**Frontend Page:** ✅ `frontend/app/dashboard/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/technician/stats', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient.get('/api/technician/stats')`

---

### 7. `/api/admin/deployments` - Admin Deployments
**Frontend Page:** ✅ `frontend/app/admin/deployments/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/admin/deployments', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient.get('/api/admin/deployments')`

---

### 8. `/api/admin/security/logs` - Security Audit Logs
**Frontend Page:** ✅ `frontend/app/admin/security/logs/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/admin/security/logs', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient.get('/api/admin/security/logs')`

---

### 9. `/api/admin/settings` - Admin Settings
**Frontend Page:** ✅ `frontend/app/admin/settings/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/admin/settings', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient`

---

### 10. `/api/settings/profile` & `/api/settings/password` - Technician Settings
**Frontend Page:** ✅ `frontend/app/settings/page.tsx`

**Issue:** ⚠️ Uses hardcoded `fetch('http://localhost:8000/api/settings/...', ...)` instead of `apiClient`

**Fix Required:** Replace hardcoded fetch with `apiClient`

---

## ✅ PROPERLY IMPLEMENTED ROUTES

### Admin Routes (using apiClient correctly)
- `/api/auth/*` - Authentication (login, register, profile)
- `/api/admin/technicians` - Technician management
- `/api/admin/profiles` - Profile management
- `/api/admin/analytics` - Analytics data
- `/api/admin/stats` - Dashboard statistics
- `/api/admin/domains` - Domain management (admin)
- `/api/admin/proxies` - Proxy pool management
- `/api/admin/settings/cloudflare` - Cloudflare settings
- `/api/admin/security/ip-shield` - IP Shield
- `/api/admin/security/access-log` - Access logs
- `/api/admin/security/threats` - Threat monitor
- `/api/admin/sessions` - Session management

### Technician Routes (using apiClient correctly)
- `/api/campaigns` - Campaign management
- `/api/sessions` - Session management
- `/api/profiles` - Profile management
- `/api/analytics` - Analytics
- `/api/deployments` - Deployment management
- `/api/domains` - Domain management (technician)

### Public Routes
- `/api/preview/:campaignId` - Campaign preview iframe (properly used)

---

## 📋 SUMMARY

### Missing Frontend Pages (Backend Ready)
1. **Resource Monitor** - `/admin/resources` page for VPS monitoring
2. **Activity Feed Widget** - Dashboard component showing recent activity

### Hardcoded Fetch URLs to Fix (7 pages)
1. `frontend/app/admin/infrastructure/workers/page.tsx`
2. `frontend/app/dashboard/page.tsx`
3. `frontend/app/admin/deployments/page.tsx`
4. `frontend/app/admin/security/logs/page.tsx`
5. `frontend/app/admin/settings/page.tsx`
6. `frontend/app/settings/page.tsx`

### Fully Functional Routes
- 20+ routes properly implemented with apiClient

---

## 🔧 ACTION ITEMS

### Priority 1 - Replace Hardcoded Fetch Calls
Replace all `fetch('http://localhost:8000/api/...', ...)` with `apiClient.get('/api/...')` or appropriate method in the 7 pages listed above.

### Priority 2 - Create Missing Pages
1. Create `/admin/resources/page.tsx` for real-time VPS resource monitoring
2. Add activity feed widget to admin dashboard using `/api/admin/activity`

### Priority 3 - API Client Enhancement
Add convenience methods to `apiClient` for commonly used endpoints:
- `apiClient.getResources()`
- `apiClient.getTechnicianStats()`
- `apiClient.getActivity(limit?)`
