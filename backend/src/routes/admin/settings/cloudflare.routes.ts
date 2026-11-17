import { Router, Request, Response } from 'express';
import prisma from '../../../config/database';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { requireAdmin } from '../../../middleware/rbac.middleware';
import { logger } from '../../../utils/logger.util';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/settings/cloudflare
 * Get Cloudflare integration settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        cloudflareApiToken: true,
        cloudflareAccountId: true,
        cloudflareZoneId: true,
        cloudflarePagesProject: true,
        cloudflareWorkersKvNamespace: true,
      },
    });

    // Mask the API token for security
    const maskedToken = settings?.cloudflareApiToken
      ? `${settings.cloudflareApiToken.substring(0, 8)}${'*'.repeat(20)}`
      : null;

    res.status(200).json({
      success: true,
      settings: {
        apiToken: maskedToken,
        accountId: settings?.cloudflareAccountId || '',
        zoneId: settings?.cloudflareZoneId || '',
        pagesProject: settings?.cloudflarePagesProject || '',
        workersKvNamespace: settings?.cloudflareWorkersKvNamespace || '',
        isConfigured: !!(settings?.cloudflareApiToken && settings?.cloudflareAccountId),
      },
    });
  } catch (error: any) {
    logger.error('Get Cloudflare settings error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get Cloudflare settings',
    });
  }
});

/**
 * POST /api/admin/settings/cloudflare
 * Save Cloudflare integration settings
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { apiToken, accountId, zoneId, pagesProject, workersKvNamespace } = req.body;

    if (!apiToken || !accountId) {
      res.status(400).json({
        success: false,
        error: 'API Token and Account ID are required',
      });
      return;
    }

    // Ensure platform settings record exists
    await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        cloudflareApiToken: apiToken,
        cloudflareAccountId: accountId,
        cloudflareZoneId: zoneId || null,
        cloudflarePagesProject: pagesProject || null,
        cloudflareWorkersKvNamespace: workersKvNamespace || null,
      },
      update: {
        cloudflareApiToken: apiToken,
        cloudflareAccountId: accountId,
        cloudflareZoneId: zoneId || null,
        cloudflarePagesProject: pagesProject || null,
        cloudflareWorkersKvNamespace: workersKvNamespace || null,
      },
    });

    logger.success('Cloudflare settings saved successfully');

    res.status(200).json({
      success: true,
      message: 'Cloudflare settings saved successfully',
    });
  } catch (error: any) {
    logger.error('Save Cloudflare settings error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to save Cloudflare settings',
    });
  }
});

/**
 * POST /api/admin/settings/cloudflare/test
 * Test Cloudflare API connection
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        cloudflareApiToken: true,
        cloudflareAccountId: true,
      },
    });

    if (!settings?.cloudflareApiToken || !settings?.cloudflareAccountId) {
      res.status(400).json({
        success: false,
        error: 'Cloudflare credentials not configured',
      });
      return;
    }

    // Test API token validity by making a request to Cloudflare API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${settings.cloudflareAccountId}/verify`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(error.errors?.[0]?.message || 'API request failed');
    }

    const data: any = await response.json();

    if (data.success) {
      logger.success('Cloudflare API test successful');
      res.status(200).json({
        success: true,
        message: 'Connected successfully',
        accountId: settings.cloudflareAccountId,
      });
    } else {
      throw new Error('API returned success: false');
    }
  } catch (error: any) {
    logger.error('Cloudflare API test error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to connect to Cloudflare API',
    });
  }
});

export default router;
