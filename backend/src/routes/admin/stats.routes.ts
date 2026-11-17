import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/stats
 * Get platform statistics for dashboard
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Count active technicians (logged in within last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const activeTechnicians = await prisma.user.count({
      where: {
        role: 'TECHNICIAN',
        status: 'ACTIVE',
        updatedAt: {
          gte: oneDayAgo,
        },
      },
    });

    // Count live sessions
    const liveSessions = await prisma.session.count({
      where: {
        status: {
          in: ['ACTIVE', 'PENDING'],
        },
      },
    });

    // Count total captures (all successful sessions)
    const totalCaptures = await prisma.session.count({
      where: {
        status: 'CAPTURED',
      },
    });

    // Count active proxies
    const activeProxies = await prisma.proxyPool.count({
      where: {
        status: 'ACTIVE',
        isHealthy: true,
      },
    });

    res.status(200).json({
      success: true,
      stats: {
        activeTechnicians,
        liveSessions,
        totalCaptures,
        activeProxies,
      },
    });
  } catch (error: any) {
    logger.error('Get stats error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get stats',
    });
  }
});

export default router;
