'use strict';
require('dotenv').config();
const { chromium } = require('playwright');
const { io } = require('socket.io-client');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { SERVER_URL, AGENT_EMAIL, AGENT_PASSWORD } = process.env;

if (!SERVER_URL || !AGENT_EMAIL || !AGENT_PASSWORD) {
  console.error('[FIONA] Missing .env values.');
  process.exit(1);
}

// profileId → { context, userId }
const activeBrowsers = new Map();
// profileId — currently launching (prevents double-launch)
const launching = new Set();

function mapCookies(rawCookies) {
  return rawCookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    // Patchright uses expirationDate; Playwright needs expires
    expires: c.expirationDate ?? c.expires ?? -1,
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure),
    sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
  }));
}

async function launchProfile({ profileId, cookies, email, userId }) {
  const profileDir = path.join(os.tmpdir(), 'fiona-profiles', profileId);

  // Wipe any stale dir from a previous run to avoid corrupt context
  if (fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  fs.mkdirSync(profileDir, { recursive: true });

  // Always use bundled Chromium — never system Chrome
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions'],
  });

  // Map and inject captured Google session cookies
  if (Array.isArray(cookies) && cookies.length > 0) {
    const mapped = mapCookies(cookies);
    console.log(`[FIONA] Injecting ${mapped.length} cookies for ${email}`);
    await context.addCookies(mapped).catch((e) =>
      console.warn('[FIONA] Cookie warning:', e.message)
    );
  } else {
    console.warn(`[FIONA] No cookies received for ${email}`);
  }

  // Use default page from persistent context
  const pages = context.pages();
  const gmailTab = pages.length > 0 ? pages[0] : await context.newPage();

  await gmailTab.goto('https://mail.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Open Password Manager while session is fresh
  const pwTab = await context.newPage();
  await pwTab.goto('https://passwords.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await gmailTab.bringToFront();
  await gmailTab.waitForTimeout(3000);

  const finalUrl = gmailTab.url();
  console.log(`[FIONA] Gmail URL after load: ${finalUrl}`);

  const authenticated =
    (finalUrl.includes('mail.google.com') || finalUrl.includes('myaccount.google.com')) &&
    !finalUrl.includes('/signin') &&
    !finalUrl.includes('/ServiceLogin');

  activeBrowsers.set(profileId, { context, userId });

  context.on('close', () => {
    activeBrowsers.delete(profileId);
    launching.delete(profileId);
    fs.rmSync(profileDir, { recursive: true, force: true });
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

  socket.on('launch-profile', async ({ profileId, cookies, email, userId: uid }) => {
    if (activeBrowsers.has(profileId) || launching.has(profileId)) {
      console.log(`[FIONA] Already running or launching: ${email}`);
      socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated: true, email });
      return;
    }

    launching.add(profileId);
    console.log(`[FIONA] Launch command received: ${email} — cookies: ${cookies?.length ?? 0}`);

    try {
      const authenticated = await launchProfile({ profileId, cookies, email, userId: uid });
      launching.delete(profileId);
      socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated, email });
    } catch (err) {
      launching.delete(profileId);
      console.error('[FIONA] Launch error:', err.message);
      socket.emit('launch-result', { profileId, userId: uid, success: false, authenticated: false, email, error: err.message });
    }
  });

  socket.on('close-profile', async ({ profileId, userId: uid }) => {
    const entry = activeBrowsers.get(profileId);
    if (entry) {
      await entry.context.close().catch(() => {});
      activeBrowsers.delete(profileId);
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
