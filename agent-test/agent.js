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
  let playwrightState = null;
  let gaiaId          = '';
  let fullName        = '';
  if (browserState) {
    try {
      const parsed    = JSON.parse(browserState);
      playwrightState = parsed.playwrightState || null;
      gaiaId          = parsed.gaiaId          || '';
      fullName        = parsed.fullName        || '';
    } catch (e) {
      console.error('[FIONA] browserState parse failed:', e.message);
    }
  }

  // ── Cookie normalizer: Chrome Extension format → Playwright format ────────
  // Cookies stored in DB are Chrome Extension format (expirationDate, storeId,
  // sameSite: 'no_restriction'|'lax'|'strict'|'unspecified').
  // Playwright addCookies() needs: expires (not expirationDate), no extra fields,
  // sameSite as 'None'|'Lax'|'Strict'.
  // CRITICAL: 'unspecified' must map to 'Lax' (browser default), NOT 'None'.
  // SameSite=None requires Secure=true — cookies like SID, HSID, SIDCC, APISID
  // have secure:false, mapping them to None causes Playwright to reject silently.
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
          return 'Lax'; // 'unspecified' and anything else → Lax (browser default)
        })(),
      };
      const expiry = c.expires ?? c.expirationDate ?? -1;
      if (expiry > 0) out.expires = expiry;
      return out;
    });
  }

  // ── Write Local State ─────────────────────────────────────────────────────
  const defaultDir = path.join(profileDir, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });

  const localState = {
    profile: {
      info_cache: {
        Default: {
          active_time:                  Date.now() / 1000,
          avatar_icon:                  'chrome://theme/IDR_PROFILE_AVATAR_26',
          gaia_given_name:              fullName || email,
          gaia_id:                      gaiaId,
          gaia_name:                    fullName || email,
          hosted_domain:                '',
          is_consented_primary_account: false,
          is_ephemeral:                 false,
          is_using_default_avatar:      true,
          is_using_default_name:        false,
          name:                         email,
          shortcut_name:                email,
          user_name:                    email,
        },
      },
      last_active_profiles: ['Default'],
      profiles_created:     1,
    },
  };
  fs.writeFileSync(path.join(profileDir, 'Local State'), JSON.stringify(localState, null, 2));

  // ── Write Default/Preferences ─────────────────────────────────────────────
  // Correct pref key names from Chromium source signin_pref_names.cc:
  //   kGoogleServicesUserAccountId → "google.services.user_account_id"
  //   kGoogleServicesUsername      → "google.services.username"
  //   kGoogleServicesLastUsername  → "google.services.last_username"
  //   kSignedInTime                → "signin.signedin_time"  (microseconds)
  //   kSigninAllowed               → "signin.allowed"
  // These tell Chrome which account to link the DICE token to when it fires.
  if (gaiaId) {
    const preferences = {
      account_info: [{
        account_id:  gaiaId,
        email:       email,
        full_name:   fullName || email,
        given_name:  (fullName || email).split(' ')[0],
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
        signedin_time: Date.now() * 1000, // microseconds since epoch
      },
    };
    fs.writeFileSync(
      path.join(defaultDir, 'Preferences'),
      JSON.stringify(preferences, null, 2)
    );
    console.log(`[FIONA] Preferences written — GAIA: ${gaiaId}`);
  } else {
    console.warn('[FIONA] No GAIA ID — Preferences skipped, Chrome will not browser-sign-in');
  }

  // ── Locate real Google Chrome ─────────────────────────────────────────────
  // CRITICAL: Patchright bundles "Chrome for Testing" — a Chromium build that has
  // NO Google OAuth client credentials. DICE (cookie→OAuth2 token exchange) is
  // disabled at runtime in builds without HasOAuthClientConfigured() (confirmed:
  // account_consistency_mode_manager.cc). Without DICE, Default/Web Data is never
  // populated, Chrome never shows as browser-signed-in, passwords never appear in
  // Chrome's native password manager.
  // Real Google Chrome (the binary on the technician's PC) has the OAuth credentials
  // compiled in → DICE fires on accounts.google.com navigation → token stored →
  // browser signed in. Use it when available; fall back to Patchright's bundled
  // browser when Chrome is not installed.
  function findChrome() {
    const candidates = process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
        ];

    for (const c of candidates) {
      try { if (fs.existsSync(c)) return c; } catch (_) {}
    }
    return undefined;
  }

  const chromeExe = findChrome();
  if (chromeExe) {
    console.log(`[FIONA] Real Google Chrome found — DICE enabled: ${chromeExe}`);
  } else {
    console.warn('[FIONA] Real Chrome not found — DICE will NOT fire, browser sign-in will not work');
  }

  // ── Launch browser ────────────────────────────────────────────────────────
  // --disable-sync NOT included — it blocks DICE.
  // --disable-signin-promo and SyncSetupWizardOnFirstSignin suppress the
  // "Turn on sync?" dialog without blocking the DICE token exchange itself.
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExe,   // Real Chrome = DICE works. undefined = bundled (DICE off).
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

  // Auto-dismiss any sync setup dialog Chrome opens after DICE completes
  context.on('page', async (newPage) => {
    try {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
      const url = newPage.url();

      if (url.startsWith('chrome://sync-confirmation')) {
        // MUST accept — this is what downloads passwords from Google's servers.
        // Profile dir is ephemeral (tmpdir) so nothing harmful gets uploaded.
        console.log('[FIONA] Accepting sync confirmation → passwords will sync');
        const confirmed = await newPage
          .locator([
            'cr-button.action-button',
            'cr-button[class*="confirm"]',
            'cr-button:has-text("Yes, I\'m in")',
            'cr-button:has-text("Turn on")',
            'cr-button:has-text("OK")',
          ].join(', '))
          .first()
          .click({ timeout: 5000 })
          .then(() => true)
          .catch(() => false);

        if (!confirmed) {
          // Fallback: last cr-button is usually the primary action
          await newPage.locator('cr-button').last().click({ timeout: 3000 }).catch(() => {});
        }
        // Do NOT close the tab — let Chrome complete the sync flow on its own
      } else if (
        url.startsWith('chrome://signin-email-confirmation') ||
        url.startsWith('chrome://sync-setup') ||
        url.includes('syncSetup')
      ) {
        // Other sign-in dialogs (not the sync consent) can be dismissed
        console.log(`[FIONA] Dismissing dialog: ${url}`);
        await newPage
          .locator('cr-button[class*="cancel"], button:has-text("No thanks"), button:has-text("Skip")')
          .first()
          .click({ timeout: 3000 })
          .catch(() => {});
        await newPage.close().catch(() => {});
      }
    } catch (_) {}
  });

  // ── Seed localStorage per origin BEFORE any navigation (DP bypass) ────────
  // addInitScript() runs before any page JavaScript executes.
  // Google's device-trust tokens in localStorage are present when their
  // scripts run → Google sees a known device → no DP challenge.
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

  // ── Inject cookies ────────────────────────────────────────────────────────
  if (playwrightState?.cookies?.length) {
    try {
      const normalized = normalizeCookies(playwrightState.cookies);
      await context.addCookies(normalized);
      console.log(`[FIONA] ${normalized.length} cookies injected`);
    } catch (e) {
      console.error('[FIONA] Cookie injection error:', e.message);
    }
  } else {
    console.warn('[FIONA] No cookies in browserState');
  }

  // ── Trigger DICE via accounts.google.com ──────────────────────────────────
  // With real Chrome + valid GAIA cookies (SID, SSID, etc.) + Preferences set:
  // Chrome sends DICE request header → Google responds with authorization_code
  // in X-Chrome-Manage-Accounts → Chrome exchanges code for OAuth2 refresh token
  // via GaiaAuthFetcher → token stored in Default/Web Data → browser signed in.
  // The 6-second wait covers the async background token exchange.
  // Navigate to accounts.google.com to trigger the DICE background token exchange.
  // We use ListAccounts (JSON endpoint) so no sign-in UI appears.
  // After 8 s the exchange is done; close this tab so the user only sees Gmail.
  const pages = context.pages();
  const diceTab = pages.length > 0 ? pages[0] : await context.newPage();
  await diceTab.goto('https://accounts.google.com/ListAccounts?gpsia=1&json=1', {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  }).catch(() => {});
  await diceTab.waitForTimeout(8000); // DICE + sync confirmation fires within this window
  await diceTab.close().catch(() => {}); // Clean up — user only sees Gmail tab

  // ── Open Gmail ────────────────────────────────────────────────────────────
  const gmailTab = await context.newPage();
  await gmailTab.goto('https://mail.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await gmailTab.bringToFront();

  // ── Open passwords.google.com ─────────────────────────────────────────────
  // Web-based Google Password Manager — works with session cookies alone.
  // Chrome's native chrome://password-manager populates once DICE completes.
  const pwTab = await context.newPage();
  await pwTab.goto('https://passwords.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await pwTab.bringToFront();
  await pwTab.waitForTimeout(2000);

  const finalUrl  = gmailTab.url();
  const pageTitle = await gmailTab.title();
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
