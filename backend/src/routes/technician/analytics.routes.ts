import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import monitoringService from '../../services/monitoring.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTechnician } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(requireTechnician);

/**
 * GET /api/analytics
 * Get analytics for current user (technician dashboard)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await monitoringService.getUserStats(req.user.id);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get user analytics error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get analytics',
    });
  }
});

/**
 * GET /api/analytics/summary
 * Get analytics summary for current user (formatted for analytics page)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Get all stats using Promise.all for better performance
    const [
      campaigns,
      sessions,
      profiles,
      deployments,
    ] = await Promise.all([
      prisma.campaign.findMany({
        where: { userId: req.user.id },
        select: { status: true },
      }),
      prisma.session.findMany({
        where: { userId: req.user.id },
        select: { status: true },
      }),
      prisma.profile.findMany({
        where: { userId: req.user.id },
        select: { authStatus: true },
      }),
      prisma.deployment.findMany({
        where: { userId: req.user.id },
        select: { deploymentStatus: true },
      }),
    ]);

    // Calculate metrics
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED' || c.status === 'INACTIVE').length;

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;
    const activeSessions = sessions.filter(s => 
      ['INITIATED', 'EMAIL_ENTERED', 'PASSWORD_ENTERED', '2FA_REQUIRED'].includes(s.status)
    ).length;
    const expiredSessions = sessions.filter(s => s.status === 'EXPIRED').length;

    const totalProfiles = profiles.length;
    const authenticatedProfiles = profiles.filter(p => p.authStatus === 'AUTHENTICATED').length;

    const totalDeployments = deployments.length;

    // Calculate success rate (profiles / completed sessions)
    const successRate = completedSessions > 0 
      ? (totalProfiles / completedSessions) * 100 
      : 0;

    const summary = {
      totalCampaigns,
      activeCampaigns,
      pausedCampaigns,
      totalDeployments,
      totalSessions,
      completedSessions,
      activeSessions,
      expiredSessions,
      totalProfiles,
      authenticatedProfiles,
      totalCaptures: totalProfiles, // Same as profiles in this context
      successRate: Math.min(successRate, 100), // Cap at 100%
    };

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error: any) {
    logger.error('Get analytics summary error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get analytics summary',
    });
  }
});

export default router;
