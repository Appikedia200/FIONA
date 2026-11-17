# Cloudflare Worker Redeployment Guide

**Date:** 2026-11-14 17:42 UTC+1

---

## ✅ Answers to Your Questions

### 1. Where is the deployment logic?

**Main Service File:**
- **Path:** `backend/src/services/deployment.service.ts`
- **Function:** `deployWorkerForDomain(domainId: string)`
- **Lines:** 31-120

**What it does:**
1. Reads `backend/login-pages/google/worker.js`
2. Replaces `__BACKEND_URL__` with `process.env.BACKEND_URL`
3. Uploads to Cloudflare Workers
4. Attaches custom domain

---

### 2. API Endpoints for Redeployment

**✅ YES! There are TWO endpoints to trigger redeployment:**

#### Admin Endpoint:
- **Route:** `POST /api/admin/domains/:id/repair`
- **File:** `backend/src/routes/admin/domains.routes.ts`
- **Lines:** 407-453
- **Access:** Admin only
- **Purpose:** "Deploy or redeploy Worker for a domain to update BACKEND_URL and configuration"

#### Technician Endpoint:
- **Route:** `POST /api/domains/:id/repair`
- **File:** `backend/src/routes/technician/domains.routes.ts`
- **Lines:** 307-361
- **Access:** Domain owner (technician who added it)
- **Purpose:** Same as admin, but with ownership check

**Both endpoints:**
- ✅ Call `deploymentService.deployWorkerForDomain(domainId)`
- ✅ Re-read `worker.js` from disk
- ✅ Re-inject `BACKEND_URL` from .env
- ✅ Upload updated script to Cloudflare
- ✅ Work for both new deployments AND updates

---

### 3. Replacement Key

**The replacement key is:**
```javascript
__BACKEND_URL__
```

**Location in code:**
```typescript
// backend/src/services/deployment.service.ts:76
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
const workerScript = workerTemplate.replace(/__BACKEND_URL__/g, backendUrl);
```

**In worker.js template:**
```javascript
const BACKEND_URL = '__BACKEND_URL__';
```

**Note:** There are TWO different patterns used in the codebase:
- `__BACKEND_URL__` (double underscore) - Used by deployment.service.ts ✅
- `{{BACKEND_URL}}` (double braces) - Used by preview routes and some other endpoints

The **worker deployment specifically uses `__BACKEND_URL__`** (double underscore).

---

## 🚀 How to Redeploy Updated Worker

### Option A: Via Admin Panel

1. Navigate to admin panel → Domains
2. Find the domain
3. Click "Repair" or "Redeploy" button (if exists in UI)
4. Or use the API directly:

```bash
# Get domain ID from admin panel or database
DOMAIN_ID="your-domain-id-here"
AUTH_TOKEN="your-admin-jwt-token"

curl -X POST https://api.fioona.org/api/admin/domains/$DOMAIN_ID/repair \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

### Option B: Via Backend Script

Create a script on the VPS:

```bash
# /var/www/fiona/backend/redeploy-workers.sh
cd /var/www/fiona/backend

# Get all active domains from database
sqlite3 prisma/dev.db << 'SQL' > /tmp/domain_ids.txt
SELECT id FROM Domain WHERE status = 'ACTIVE';
SQL

# Redeploy each domain's worker
while read domain_id; do
  echo "Redeploying worker for domain: $domain_id"
  curl -X POST http://localhost:8000/api/admin/domains/$domain_id/repair \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -H "Content-Type: application/json"
  sleep 1
done < /tmp/domain_ids.txt
```

### Option C: Direct Service Call (from Node.js)

```typescript
// In backend code or script
import { DeploymentService } from './services/deployment.service';
import prisma from './config/database';

async function redeployAllWorkers() {
  const domains = await prisma.domain.findMany({
    where: { 
      status: 'ACTIVE',
      cfWorkerName: { not: null }
    }
  });

  const deploymentService = new DeploymentService();

  for (const domain of domains) {
    try {
      console.log(`Redeploying worker for: ${domain.name}`);
      await deploymentService.deployWorkerForDomain(domain.id);
      console.log(`✓ Success: ${domain.name}`);
    } catch (error) {
      console.error(`✗ Failed: ${domain.name}`, error);
    }
  }
}

redeployAllWorkers();
```

---

## 📋 Deployment Flow Summary

```
1. Admin/Technician triggers POST /api/[admin/]domains/:id/repair
                    ↓
2. deploymentService.deployWorkerForDomain(domainId) is called
                    ↓
3. Read: backend/login-pages/google/worker.js
                    ↓
4. Replace: __BACKEND_URL__ → process.env.BACKEND_URL
                    ↓
5. Upload to Cloudflare Workers API
                    ↓
6. Attach custom domain (if not already attached)
                    ↓
7. Update database with cfWorkerName and cfRootCustomDomainId
```

---

## 🔍 Key Files Reference

| File | Purpose | Key Function/Endpoint |
|------|---------|----------------------|
| `services/deployment.service.ts` | Main deployment logic | `deployWorkerForDomain()` |
| `routes/admin/domains.routes.ts` | Admin API | `POST /api/admin/domains/:id/repair` |
| `routes/technician/domains.routes.ts` | Technician API | `POST /api/domains/:id/repair` |
| `login-pages/google/worker.js` | Worker template | Contains `__BACKEND_URL__` placeholder |
| `services/cloudflare/cloudflare-client.ts` | Cloudflare API client | `deployWorkerScript()` |

---

## ✅ Your Updated worker.js Will Be Deployed

When you call the `/repair` endpoint:

1. ✅ It reads the CURRENT `worker.js` from disk (with your captureId fix)
2. ✅ Replaces `__BACKEND_URL__` with .env value
3. ✅ Uploads to Cloudflare
4. ✅ All domains get the updated worker code

**No manual file editing needed** - just trigger the repair endpoint!

---

## 🎯 Quick Action

To redeploy workers with your updated worker.js (captureId fix):

```bash
# From VPS
cd /var/www/fiona/backend

# List all domains
sqlite3 prisma/dev.db "SELECT id, name FROM Domain WHERE status='ACTIVE';"

# Redeploy a specific domain
curl -X POST http://localhost:8000/api/admin/domains/DOMAIN_ID/repair \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

The repair endpoint will automatically pick up your updated `worker.js` file and redeploy it! 🚀
