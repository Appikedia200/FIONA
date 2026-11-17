import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import geoip from 'geoip-lite';
import dns from 'dns';
import { getBotReason, isBotUserAgent, isKnownScanner } from '../data/bot-signatures';
import { logger } from '../utils/logger.util';

/**
 * Extract real IP from request (handles proxies)
 */
function getRealIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Get country from IP using geoip
 */
function getCountryFromIP(ip: string): string | null {
  try {
    const geo = geoip.lookup(ip);
    return geo?.country || null;
  } catch {
    return null;
  }
}

/**
 * Reverse DNS lookup (async, non-blocking)
 */
async function getHostname(ip: string): Promise<string | null> {
  return new Promise((resolve) => {
    dns.reverse(ip, (err, hostnames) => {
      if (err || !hostnames || hostnames.length === 0) {
        resolve(null);
      } else {
        resolve(hostnames[0]);
      }
    });
  });
}

/**
 * Log access to database (async, non-blocking)
 */
async function logAccessToDB(
  ip: string,
  path: string,
  method: string,
  statusCode: number,
  userAgent: string | undefined,
  blocked: boolean,
  botDetected: boolean,
  botReason: string | null,
  hostname: string | null,
  country: string | null
): Promise<void> {
  try {
    await prisma.accessLog.create({
      data: {
        ip,
        hostname,
        country,
        userAgent: userAgent?.substring(0, 500) || null,
        path: path.substring(0, 500),
        method,
        statusCode,
        blocked,
        botDetected,
        botReason,
      },
    });
  } catch (error: any) {
    logger.error('Failed to log access:', error.message);
  }
}

/**
 * Access logger middleware - logs all requests
 */
export function accessLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'];
  const path = req.path;
  const method = req.method;

  // Get country synchronously
  const country = getCountryFromIP(ip);

  // Detect bots
  const botReason = getBotReason(userAgent || '', ip);
  const botDetected = botReason !== null;

  // Capture the original res.send to get status code
  const originalSend = res.send;
  let statusCode = 200;

  res.send = function (data: any) {
    statusCode = res.statusCode;
    res.send = originalSend;
    return originalSend.call(this, data);
  };

  // Log asynchronously after response
  res.on('finish', async () => {
    // Get hostname asynchronously (don't wait for it)
    getHostname(ip).then((hostname) => {
      // Update if we got a hostname
      if (hostname) {
        prisma.accessLog
          .updateMany({
            where: {
              ip,
              hostname: null,
              timestamp: {
                gte: new Date(Date.now() - 60000), // Last minute
              },
            },
            data: { hostname },
          })
          .catch(() => {});
      }
    });

    // Log to database
    await logAccessToDB(
      ip,
      path,
      method,
      res.statusCode,
      userAgent,
      false, // Not blocked by this middleware
      botDetected,
      botReason,
      null, // Hostname will be updated async
      country
    );
  });

  next();
}

/**
 * Cache for IP rules (refreshed every 30 seconds)
 */
let ipRulesCache: { ip: string; action: string }[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL = 30000; // 30 seconds

async function refreshIPRulesCache() {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL) {
    return;
  }

  try {
    const [whitelist, blacklist] = await Promise.all([
      prisma.iPWhitelist.findMany({
        where: { active: true },
        select: { ipAddress: true },
      }),
      prisma.iPBlacklist.findMany({
        where: { active: true },
        select: { ipAddress: true },
      }),
    ]);

    ipRulesCache = [
      ...whitelist.map((w) => ({ ip: w.ipAddress, action: 'allow' })),
      ...blacklist.map((b) => ({ ip: b.ipAddress, action: 'block' })),
    ];

    lastCacheRefresh = now;
  } catch (error: any) {
    logger.error('Failed to refresh IP rules cache:', error.message);
  }
}

/**
 * Check if IP is blocked
 */
async function isIPBlocked(ip: string): Promise<boolean> {
  await refreshIPRulesCache();
  
  const rule = ipRulesCache.find((r) => r.ip === ip || ip.startsWith(r.ip));
  return rule?.action === 'block';
}

/**
 * Bot protection middleware - blocks known bots and scanners
 * Apply to all routes EXCEPT preview page
 */
export async function botProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip bot protection for preview pages and health check
  if (req.path.startsWith('/api/preview/') || req.path === '/health') {
    return next();
  }

  const ip = getRealIP(req);
  const userAgent = req.headers['user-agent'] || '';

  // 1. Check manual IP rules
  const isBlocked = await isIPBlocked(ip);
  if (isBlocked) {
    logger.warn(`Blocked IP by rule: ${ip}`);
    await logAccessToDB(
      ip,
      req.path,
      req.method,
      403,
      userAgent,
      true,
      false,
      null,
      null,
      getCountryFromIP(ip)
    );
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 2. Check bot user-agent
  if (isBotUserAgent(userAgent)) {
    logger.warn(`Blocked bot UA: ${ip} - ${userAgent.substring(0, 50)}`);
    await logAccessToDB(
      ip,
      req.path,
      req.method,
      403,
      userAgent,
      true,
      true,
      `UA:${userAgent.substring(0, 50)}`,
      null,
      getCountryFromIP(ip)
    );
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Check known scanner IPs
  if (isKnownScanner(ip)) {
    logger.warn(`Blocked scanner IP: ${ip}`);
    await logAccessToDB(
      ip,
      req.path,
      req.method,
      403,
      userAgent,
      true,
      true,
      'IP:known-scanner',
      null,
      getCountryFromIP(ip)
    );
    return res.status(403).end();
  }

  next();
}
