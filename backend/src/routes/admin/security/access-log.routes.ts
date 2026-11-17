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
 * GET /api/admin/security/access-log
 * Get access logs with pagination and filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '50',
      blocked,
      botDetected,
      ip,
      search,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (blocked === 'true') where.blocked = true;
    if (blocked === 'false') where.blocked = false;
    if (botDetected === 'true') where.botDetected = true;
    if (botDetected === 'false') where.botDetected = false;
    if (ip) where.ip = ip as string;
    if (search) {
      where.OR = [
        { ip: { contains: search as string } },
        { hostname: { contains: search as string } },
        { path: { contains: search as string } },
      ];
    }

    // Get logs
    const [logs, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.accessLog.count({ where }),
    ]);

    // Get stats
    const [uniqueIPsResult, blockedCount, botCount] = await Promise.all([
      prisma.accessLog.groupBy({
        by: ['ip'],
        where,
      }),
      prisma.accessLog.count({ where: { ...where, blocked: true } }),
      prisma.accessLog.count({ where: { ...where, botDetected: true } }),
    ]);

    const uniqueIPs = uniqueIPsResult.length;

    res.status(200).json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        ip: log.ip,
        hostname: log.hostname,
        country: log.country,
        userAgent: log.userAgent,
        path: log.path,
        method: log.method,
        statusCode: log.statusCode,
        blocked: log.blocked,
        botDetected: log.botDetected,
        botReason: log.botReason,
        timestamp: log.timestamp.toISOString(),
      })),
      total,
      uniqueIPs,
      blockedCount,
      botCount,
    });
  } catch (error: any) {
    logger.error('Get access log error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get access log',
    });
  }
});

export default router;
