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
 * GET /api/admin/activity
 * Get recent activity feed for dashboard
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    // Get recent sessions as activity events
    const recentSessions = await prisma.session.findMany({
      take: limit,
      orderBy: {
        startedAt: 'desc',
      },
      select: {
        id: true,
        status: true,
        email: true,
        startedAt: true,
        lastActivityAt: true,
      },
    });

    // Transform sessions into activity events
    const activities = recentSessions.map((session) => {
      let type = 'session_start';
      let message = `${session.email} started session`;

      if (session.status === 'CAPTURED') {
        type = 'capture';
        message = `${session.email} successfully captured credentials`;
      } else if (session.status === 'FAILED') {
        type = 'failure';
        message = `Session failed for ${session.email}`;
      }

      return {
        id: session.id,
        type,
        message,
        timestamp: session.lastActivityAt || session.startedAt,
      };
    });

    res.status(200).json({
      success: true,
      activities,
    });
  } catch (error: any) {
    logger.error('Get activity error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get activity',
    });
  }
});

export default router;
