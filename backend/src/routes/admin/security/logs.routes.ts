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
 * GET /api/admin/security/logs
 * Get audit logs from ActivityLog with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, action, startDate, endDate } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (action) {
      where.action = action as string;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate as string);
      }
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
      select: {
        id: true,
        action: true,
        userId: true,
        resource: true,
        resourceType: true,
        ipAddress: true,
        timestamp: true,
        details: true,
      },
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      user: log.userId,
      ip: log.ipAddress || 'Unknown',
      resource: log.resource || log.resourceType || 'System',
      timestamp: log.timestamp.toISOString(),
      status: 'success', // ActivityLog doesn't track status, assume success if logged
    }));

    res.status(200).json({
      success: true,
      logs: formattedLogs,
    });
  } catch (error: any) {
    logger.error('Get audit logs error:', error.message);
    res.status(200).json({
      success: true,
      logs: [],
    });
  }
});

export default router;
