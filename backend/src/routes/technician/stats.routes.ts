import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTechnician } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(requireTechnician);

/**
 * GET /api/technician/stats
 * Get dashboard stats for current technician
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const userId = req.user.id;

    // Get all campaigns for this technician
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: { id: true }
    });

    const campaignIds = campaigns.map(c => c.id);

    // Count active sessions (from technician's campaigns)
    const activeSessions = await prisma.session.count({
      where: {
        campaignId: { in: campaignIds },
        status: { in: ['ACTIVE', 'PASSWORD_ENTERED', 'TWO_FA_REQUIRED'] }
      }
    });

    // Count total captures (authenticated profiles from campaigns)
    const totalCaptures = await prisma.profile.count({
      where: {
        campaignId: { in: campaignIds },
        status: 'AUTHENTICATED'
      }
    });

    // Count active deployments
    const activeDeployments = await prisma.deployment.count({
      where: {
        campaignId: { in: campaignIds },
        deploymentStatus: 'DEPLOYED'
      }
    });

    // Count authenticated profiles ready to launch
    const profilesReady = await prisma.profile.count({
      where: {
        campaignId: { in: campaignIds },
        status: 'AUTHENTICATED'
      }
    });

    res.status(200).json({
      success: true,
      stats: {
        activeSessions,
        totalCaptures,
        activeDeployments,
        profilesReady
      }
    });
  } catch (error: any) {
    logger.error('Get technician stats error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get stats',
    });
  }
});

export default router;
