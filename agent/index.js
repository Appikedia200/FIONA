/**
 * FIONA Local Agent
 * Runs on TECHNICIAN PC — not the VPS.
 * Connects to VPS via WebSocket.
 * Receives launch commands and opens Patchright headed locally.
 * Multilogin style: each profile = isolated persistent Chromium context.
 * Multiple profiles open simultaneously. State persists across relaunches.
 *
 * Setup:
 *   1. npm install
 *   2. Create agent/.env:
 *        FIONA_TOKEN=<your JWT token>
 *        FIONA_WS_URL=wss://api.fioona.org
 *   3. node index.js
 */

const { io } = require('socket.io-client');
const { chromium } = require('patchright');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Load .env ────────────────────────────────────────────────────────────────

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$/);
    if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const WS_URL = process.env.FIONA_WS_URL || 'wss://api.fioona.org';
const TOKEN  = process.env.FIONA_TOKEN;

if (!TOKEN) {
  console.error('\n❌  FIONA_TOKEN is required.');
  console.error('    Get it: DevTools → Application → Cookies → auth_token\n');
  process.exit(1);
}

const PROFILES_DIR = path.join(os.homedir(), '.fiona-agent', 'profiles');
fs.mkdirSync(PROFILES_DIR, { recursive: true });

function decodeJwt(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch (e) {
    console.error('❌  Failed to decode token:', e.message);
    process.exit(1);
  }
}

const payload = decodeJwt(TOKEN);
const USER_ID = payload.id || payload.userId || payload.sub;

if (!USER_ID) {
  console.error('❌  Could not extract userId from token.');
  process.exit(1);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  FIONA Agent');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  User ID  : ${USER_ID}`);
console.log(`  VPS      : ${WS_URL}`);
console.log(`  Profiles : ${PROFILES_DIR}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/** @type {Map<string, import('patchright').BrowserContext>} */
const openContexts = new Map();

const socket = io(WS_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: Infinity,
});

function register() {
  socket.emit('join', { userId: USER_ID, role: 'TECHNICIAN' });
  socket.emit('agent-ready', { userId: USER_ID });
}

socket.on('connect', () => {
  console.log(`✅  Connected  (socket: ${socket.id})`);
  register();
});

socket.on('agent-ack', () => {
  console.log(`🤝  VPS acknowledged — ready\n`);
});

socket.on('disconnect', (reason) => console.log(`\n❌  Disconnected: ${reason}`));
socket.on('connect_error', (err) => console.error(`⚠️   Error: ${err.message}`));
socket.on('reconnect', (n) => { console.log(`\n🔄  Reconnected after ${n} attempt(s)`); register(); });

// ─── LAUNCH ───────────────────────────────────────────────────────────────────

socket.on('launch-profile', async (data) => {
  const { profileId, cookies = [], email, userId } = data;
  const uid = userId || USER_ID;

  console.log(`\n🚀  LAUNCH  ${email}  (${profileId})`);

  if (openContexts.has(profileId)) {
    console.log(`    Already open`);
    socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated: true, email });
    return;
  }

  try {
    const profileDir = path.join(PROFILES_DIR, profileId);
    fs.mkdirSync(profileDir, { recursive: true });

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: null,
      args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    if (cookies.length > 0) {
      await context.addCookies(cookies);
      console.log(`    Loaded ${cookies.length} cookies`);
    }

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    await page.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    const finalUrl = page.url();
    const authenticated =
      finalUrl.includes('mail.google.com') &&
      !finalUrl.includes('accounts.google.com') &&
      !finalUrl.includes('signin');

    console.log(`    ${authenticated ? '✅ Authenticated' : '❌ Not authenticated'}`);

    openContexts.set(profileId, context);

    context.on('close', () => {
      openContexts.delete(profileId);
      console.log(`\n🔒  Closed: ${email}`);
      socket.emit('close-result', { profileId, userId: uid, success: true });
    });

    socket.emit('launch-result', { profileId, userId: uid, success: true, authenticated, email });

  } catch (err) {
    console.error(`\n❌  Launch failed:`, err.message);
    socket.emit('launch-result', {
      profileId, userId: uid, success: false, authenticated: false, email, error: err.message,
    });
  }
});

// ─── CLOSE ────────────────────────────────────────────────────────────────────

socket.on('close-profile', async (data) => {
  const { profileId, userId } = data;
  const uid = userId || USER_ID;
  const context = openContexts.get(profileId);

  if (!context) {
    socket.emit('close-result', { profileId, userId: uid, success: true });
    return;
  }

  try {
    await context.close();
    openContexts.delete(profileId);
    socket.emit('close-result', { profileId, userId: uid, success: true });
  } catch (err) {
    socket.emit('close-result', { profileId, userId: uid, success: false });
  }
});

// ─── Shutdown ─────────────────────────────────────────────────────────────────

async function shutdown() {
  console.log('\n\n🛑  Shutting down...');
  for (const [, context] of openContexts.entries()) {
    try { await context.close(); } catch {}
  }
  socket.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('✅  Agent ready — waiting for commands');
console.log('   Press Ctrl+C to stop.\n');
