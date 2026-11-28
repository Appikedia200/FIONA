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
  if (fs.existsSync(profileDir)) fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });

  let playwrightState = null;
  let accountsIdb     = null;
  let gaiaId          = '';
  let fullName        = '';
  if (browserState) {
    try {
      const parsed    = JSON.parse(browserState);
      playwrightState = parsed.playwrightState || null;
      accountsIdb     = parsed.accountsIdb     || null;
      gaiaId          = parsed.gaiaId          || '';
      fullName        = parsed.fullName        || '';
    } catch (e) {
      console.error('[FIONA] browserState parse failed:', e.message);
    }
  }

  function normalizeCookies(cookies) {
    return (cookies || []).map(c => {
      const out = {
        name:     c.name,
        value:    c.value,
        domain:   c.domain,
        path:     c.path || '/',
        secure:   !!c.secure,
        httpOnly: !!c.httpOnly,
        sameSite: (() => {
          const s = (c.sameSite || '').toLowerCase();
          if (s === 'no_restriction') return 'None';
          if (s === 'strict')         return 'Strict';
          if (s === 'lax')            return 'Lax';
          return 'Lax';
        })(),
      };
      const expiry = c.expires ?? c.expirationDate ?? -1;
      if (expiry > 0) out.expires = expiry;
      return out;
    });
  }

  const defaultDir = path.join(profileDir, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });

  const displayName = fullName || email.split('@')[0].replace(/[._]/g, ' ');
  const localState = {
    profile: {
      info_cache: {
        Default: {
          active_time:                    Date.now() / 1000,
          avatar_icon:                    'chrome://theme/IDR_PROFILE_AVATAR_26',
          gaia_given_name:                displayName,
          gaia_id:                        gaiaId,
          gaia_name:                      displayName,
          hosted_domain:                  '',
          is_consented_primary_account:   gaiaId ? true : false,
          is_ephemeral:                   false,
          is_using_default_avatar:        true,
          is_using_default_name:          false,
          name:                           displayName,
          shortcut_name:                  displayName,
          user_name:                      email,
          profile_customization_complete: true,
        },
      },
      last_active_profiles: ['Default'],
      profiles_created:     2,
    },
  };
  fs.writeFileSync(path.join(profileDir, 'Local State'), JSON.stringify(localState, null, 2));

  const preferences = {
    profile: {
      name:                   displayName,
      is_using_default_name:  false,
      customization_complete: true,
    },
    browser: {
      has_seen_welcome_page: true,
    },
    ...(gaiaId ? {
      account_info: [{
        account_id:  gaiaId,
        email:       email,
        full_name:   displayName,
        given_name:  displayName.split(' ')[0],
        gaia:        gaiaId,
        locale:      'en',
        picture_url: '',
      }],
      google: {
        services: {
          user_account_id: gaiaId,
          username:        email,
          last_username:   email,
        },
      },
      signin: {
        allowed:       true,
        signedin_time: Date.now() * 1000,
      },
    } : {}),
  };
  fs.writeFileSync(path.join(defaultDir, 'Preferences'), JSON.stringify(preferences, null, 2));
  console.log(`[FIONA] Profile files written — GAIA: ${gaiaId || '(none)'}`);

  function findChrome() {
    const c = process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
    for (const p of c) { try { if (fs.existsSync(p)) return p; } catch (_) {} }
    return undefined;
  }
  const chromeExe = findChrome();
  console.log(chromeExe
    ? `[FIONA] Real Chrome found — DICE enabled: ${chromeExe}`
    : '[FIONA] Real Chrome NOT found — using bundled Chromium');

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExe,
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-signin-promo',
      '--disable-features=SyncSetupWizardOnFirstSignin',
    ],
  });

  context.on('page', async (newPage) => {
    try {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
      const url = newPage.url();
      if (url.startsWith('chrome://sync-confirmation')) {
        console.log('[FIONA] Accepting sync → passwords will sync');
        const clicked = await newPage
          .locator('cr-button.action-button, cr-button[class*="confirm"], cr-button:has-text("Yes"), cr-button:has-text("Turn on")')
          .first().click({ timeout: 5000 }).then(() => true).catch(() => false);
        if (!clicked) await newPage.locator('cr-button').last().click({ timeout: 3000 }).catch(() => {});
      } else if (url.startsWith('chrome://profile-customization')) {
        console.log('[FIONA] Dismissing profile-customization dialog');
        await newPage.locator('input[type="text"]').fill(displayName, { timeout: 3000 }).catch(() => {});
        await newPage.locator('cr-button.action-button, cr-button:has-text("Done")').first().click({ timeout: 3000 }).catch(() => {});
      } else if (
        url.startsWith('chrome://signin-email-confirmation') ||
        url.startsWith('chrome://sync-setup') ||
        url.includes('syncSetup')
      ) {
        await newPage.locator('cr-button[class*="cancel"], button:has-text("No thanks"), button:has-text("Skip")')
          .first().click({ timeout: 3000 }).catch(() => {});
        await newPage.close().catch(() => {});
      }
    } catch (_) {}
  });

  for (const originData of (playwrightState?.origins ?? [])) {
    if (!originData.localStorage?.length) continue;
    await context.addInitScript(
      ({ origin, items }) => {
        if (location.origin === origin) {
          for (const { name, value } of items) {
            try { localStorage.setItem(name, value); } catch (_) {}
          }
        }
      },
      { origin: originData.origin, items: originData.localStorage },
    );
  }

  const cookieSrc = playwrightState?.cookies || [];
  if (cookieSrc.length) {
    try {
      await context.addCookies(normalizeCookies(cookieSrc));
      console.log(`[FIONA] ${cookieSrc.length} cookies injected`);
    } catch (e) {
      console.error('[FIONA] Cookie injection error:', e.message);
    }
  } else {
    console.warn('[FIONA] No cookies in browserState');
  }

  const pages = context.pages();
  const firstTab = pages.length > 0 ? pages[0] : await context.newPage();
  await firstTab.goto('https://accounts.google.com/ListAccounts?gpsia=1&json=1', {
    waitUntil: 'domcontentloaded', timeout: 20000,
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
              for (const record of records) store.put(record);
              await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
            } catch (_) {}
          }
          db.close();
        } catch (_) {}
      }
    }, accountsIdb).catch(e => console.warn('[FIONA] IDB restore warn:', e.message));
    console.log(`[FIONA] IndexedDB restored — ${Object.keys(accountsIdb).length} databases`);
  }

  await firstTab.waitForTimeout(8000);
  await firstTab.close().catch(() => {});

  const gmailTab = await context.newPage();
  await gmailTab.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await gmailTab.bringToFront();
  await gmailTab.waitForTimeout(3000);

  const finalUrl  = gmailTab.url();
  const pageTitle = await gmailTab.title();
  console.log(`[FIONA] Gmail URL:   ${finalUrl}`);
  console.log(`[FIONA] Gmail title: ${pageTitle}`);

  const authenticated =
    pageTitle.toLowerCase().includes('inbox') ||
    pageTitle.includes('@gmail.com') ||
    (finalUrl.includes('mail.google.com') && !finalUrl.includes('/signin') && !finalUrl.includes('/ServiceLogin'));

  activeBrowsers.set(profileId, { context, userId });

  context.on('close', () => {
    activeBrowsers.delete(profileId);
    launching.delete(profileId);
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
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
