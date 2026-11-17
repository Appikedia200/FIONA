# Auth Flow Refinement - Completed

## ✅ Changes Made

### 1. **`frontend/lib/api-client.ts`** - Axios Interceptor Cleanup

**REMOVED:** Silent 401 redirect that was swallowing errors

**BEFORE:**
```typescript
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token')
        localStorage.removeItem('fiona_token')
        window.location.href = '/login'  // ❌ Silent redirect
      }
    }
    return Promise.reject(error)
  }
)
```

**AFTER:**
```typescript
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error(`[FIONA API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status}`, error.response?.data)
    return Promise.reject(error)  // ✅ Just log and reject
  }
)
```

---

### 2. **`frontend/lib/api-client.ts`** - SWR Fetcher Cleanup

**REMOVED:** 401 redirect from fetcher function

**BEFORE:**
```typescript
export const fetcher = async (url: string) => {
  const token = getToken()
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'  // ❌ Silent redirect
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `HTTP ${res.status}`)
  }
  return res.json()
}
```

**AFTER:**
```typescript
export const fetcher = async (url: string) => {
  const token = getToken()
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `HTTP ${res.status}`)  // ✅ Surface error
  }
  return res.json()
}
```

---

### 3. **`frontend/contexts/auth-context.tsx`** - Centralized 401 Handling

**CHANGED:** Only the auth context handles 401 during profile check

**Key Changes:**
- ✅ 401 redirect ONLY happens when profile check fails (expired session)
- ✅ Added `finally` block to ensure `setLoading(false)` always runs
- ✅ Added `router` dependency to useEffect
- ✅ Proper error type annotation (`err: any`)

**AFTER:**
```typescript
useEffect(() => {
  const checkAuth = async () => {
    const token = localStorage.getItem('token');

    if (token) {
      try {
        const response = await apiClient.getProfile();
        if (response.data && response.data.user) {
          setUser(response.data.user);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          wsClient.connect(response.data.user.id, response.data.user.role);
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          // ✅ ONLY place in codebase that redirects on 401
          localStorage.removeItem('token');
          localStorage.removeItem('fiona_token');
          router.replace('/login');
        }
        setUser(null);
      } finally {
        setLoading(false);  // ✅ Always completes
      }
    } else {
      setLoading(false);
    }
  };

  checkAuth();
}, [router]);  // ✅ Added router dependency
```

---

## ✅ Verification

### Checked for Other 401 Redirects:
- ✅ `window.location.href = '/login'` - **NONE FOUND** (except removed ones)
- ✅ `router.replace('/login')` - **ONLY in auth-context.tsx** (correct)
- ✅ `window.location = '/login'` - **NONE FOUND**
- ✅ `.status === 401` checks in page components - **NONE FOUND**

---

## 🎯 New Auth Flow Behavior

### When 401 Occurs:

#### **Scenario 1: Page Load / Initial Auth Check**
```
1. User visits http://localhost:3001/admin
2. auth-context.tsx runs profile check
3. If 401 → clears tokens + redirects to /login
4. User sees login page (expected)
```

#### **Scenario 2: API Call from Component Fails with 401**
```
1. User clicks "Load Sessions" button
2. Component calls apiClient.getSessions()
3. Backend returns 401 (token expired mid-session)
4. Axios interceptor logs: [FIONA API] GET /api/sessions → 401
5. Promise rejects with error
6. Component catches error in try/catch or SWR error state
7. Error message displays in UI: "Failed to load sessions: Unauthorized"
8. User sees error (can debug) instead of silent redirect
```

#### **Scenario 3: SWR Fetch Fails with 401**
```
1. Component uses useSWR('/api/admin/stats', fetcher)
2. Fetcher runs, backend returns 401
3. Fetcher throws Error('HTTP 401')
4. SWR sets error state
5. Component renders: {error && <div>Error: {error.message}</div>}
6. User sees "HTTP 401" in red text on screen
```

---

## 💡 Benefits

1. **Visible Errors:** All API failures now surface in UI instead of causing silent redirects
2. **Easier Debugging:** Console shows exact endpoint and status code that failed
3. **Single Source of Truth:** Only auth-context.tsx decides when to redirect on 401
4. **Better UX:** Users see error messages instead of mysterious redirects
5. **Proper Error Boundaries:** Components can handle errors appropriately (retry, fallback, etc.)

---

## 🧪 Testing

### Test Case 1: Expired Token During Session
1. Login as admin
2. Manually delete token from localStorage: `localStorage.removeItem('token')`
3. Click any button that fetches data
4. **Expected:** See error message in UI (not silent redirect)
5. **Console:** `[FIONA API] GET /api/... → 401`

### Test Case 2: Invalid Token on Page Load
1. Set invalid token: `localStorage.setItem('token', 'invalid')`
2. Visit http://localhost:3001/admin
3. **Expected:** Redirect to /login (auth check failed)
4. **Console:** Error logged by interceptor

### Test Case 3: No Token Present
1. Clear all storage: `localStorage.clear()`
2. Visit http://localhost:3001/admin
3. **Expected:** Immediate redirect to /login (no token = skip profile check)
4. **Loading spinner:** Shows briefly, then redirects

---

## 📋 Summary

| Location | 401 Handling | Behavior |
|----------|-------------|----------|
| `api-client.ts` (axios) | ❌ Removed | Just logs error |
| `api-client.ts` (fetcher) | ❌ Removed | Throws error |
| `auth-context.tsx` | ✅ **ONLY HERE** | Redirects if profile check fails |
| Page components | ❌ None | Display errors in UI |

**Result:** Clean, predictable auth flow with visible error messages.

---

**Last Updated:** October 29, 2026 09:30 UTC
