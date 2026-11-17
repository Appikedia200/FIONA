/**
 * Known bot user-agent signatures
 */
export const BOT_USER_AGENTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
  'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot', 'rogerbot',
  'screaming frog', 'zgrab', 'masscan', 'nmap', 'sqlmap',
  'nikto', 'dirbuster', 'nuclei', 'curl/', 'python-requests',
  'go-http-client', 'libwww-perl', 'wget', 'scrapy',
  'headlesschrome', 'phantomjs', 'selenium', 'webdriver',
  'chrome-lighthouse', 'gtmetrix', 'pagespeed', 'pingdom',
];

/**
 * Known scanner IP prefixes
 */
export const KNOWN_SCANNER_IPS = [
  // Shodan
  '198.20.69.', '198.20.70.', '198.20.74.', '198.20.99.',
  '198.20.87.', '198.20.88.', 
  // Censys
  '162.142.125.', '167.94.138.', '167.94.145.', '167.94.146.',
  '167.248.133.', '192.35.168.',
  // Binary Edge
  '34.', '35.', '104.',
];

/**
 * Check if user-agent is a bot
 */
export function isBotUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

/**
 * Check if IP is a known scanner
 */
export function isKnownScanner(ip: string): boolean {
  if (!ip) return false;
  return KNOWN_SCANNER_IPS.some(prefix => ip.startsWith(prefix));
}

/**
 * Get bot detection reason
 */
export function getBotReason(userAgent: string, ip: string): string | null {
  if (isBotUserAgent(userAgent)) {
    const ua = userAgent.toLowerCase();
    const bot = BOT_USER_AGENTS.find(b => ua.includes(b));
    return `UA:${bot}`;
  }
  if (isKnownScanner(ip)) {
    return 'IP:known-scanner';
  }
  return null;
}
