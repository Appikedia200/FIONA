'use strict';
require('dotenv').config();
const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const { SERVER_URL, AGENT_EMAIL, AGENT_PASSWORD } = process.env;

if (!SERVER_URL || !AGENT_EMAIL || !AGENT_PASSWORD) {
  console.error('[FIONA] Missing .env values. Copy .env.example to .env and fill in credentials.');
  process.exit(1);
}

// profileId → { browser, context, userId }
const activeBrowsers = new Map();

async function launchProfile({ profileId, cookies, email, userId }) {
  // Try system Chrome first, fall back to bundled Chromium
  const browser = await chromium
    .launch({ headless: false, channel: 'chrome' })
    .catch(() => chromium.launch({ headless: false }));

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Inject captured Google session cookies
  if (Array.isArray(cookies) && cookies.length > 0) {
    await context.addCookies(cookies).catch((e) =>
      console.warn('[FIONA] Cookie warning:', e.message)
    );
  }

  // Tab 1 — Gmail inbox
  const gmailTab = await context.newPage();
  await gmailTab.goto('https://mail.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Tab 2 — Google Password Manager (opened while session is fresh)
  const pwTab = await context.newPage();
  await pwTab.goto('https://passwords.google.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Keep Gmail tab in front
  await gmailTab.bringToFront();
  await gmailTab.waitForTimeout(3000);

  const finalUrl = gmailTab.url();
  const authenticated =
    (finalUrl.includes('mail.google.com') || finalUrl.includes('myaccount.google.com')) &&
    !finalUrl.includes('/signin') &&
    !finalUrl.includes('/ServiceLogin');

  activeBrowsers.set(profileId, { browser, context, userId });

  // Auto-cleanup when technician closes the browser window
  context.on('close', () => {
    activeBrowsers.delete(profileId);
    console.log(`[FIONA] Browser closed by technician: ${profileId}`);
  });

  console.log(`[FIONA] Launched: ${email} — authenticated: ${authenticated}`);
  return authenticated;
}

async function main() {
  // ── Authenticate ──────────────────────────────────────────────────────────
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

  // ── Socket.IO ─────────────────────────────────────────────────────────────
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
    if (activeBrowsers.has(profileId)) {
      console.log(`[FIONA] Already running: ${email}`);
      socket.emit('launch-result', {
        profileId,
        userId: uid,
        success: true,
        authenticated: true,
        email,
      });
      return;
    }

    console.log(`[FIONA] Launch command received: ${email}`);
    try {
      const authenticated = await launchProfile({ profileId, cookies, email, userId: uid });
      socket.emit('launch-result', {
        profileId,
        userId: uid,
        success: true,
        authenticated,
        email,
      });
    } catch (err) {
      console.error('[FIONA] Launch error:', err.message);
      socket.emit('launch-result', {
        profileId,
        userId: uid,
        success: false,
        authenticated: false,
        email,
        error: err.message,
      });
    }
  });

  socket.on('close-profile', async ({ profileId, userId: uid }) => {
    const entry = activeBrowsers.get(profileId);
    if (entry) {
      await entry.browser.close().catch(() => {});
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
