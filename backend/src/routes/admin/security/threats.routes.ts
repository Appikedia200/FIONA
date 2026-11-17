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
 * GET /api/admin/security/threats
 * Get detected threats from ThreatLog
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const threats = await prisma.threatLog.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      take: 50,
      select: {
        id: true,
        threatType: true,
        severity: true,
        ipAddress: true,
        details: true,
        action: true,
        timestamp: true,
      },
    });

    const formattedThreats = threats.map((t) => ({
      id: t.id,
      type: t.threatType,
      severity: t.severity.toLowerCase(),
      source: t.ipAddress,
      description: t.details || `${t.threatType} detected from ${t.ipAddress}`,
      timestamp: t.timestamp.toISOString(),
      resolved: t.action === 'BLOCKED' || t.action === 'MITIGATED',
    }));

    res.status(200).json({
      success: true,
      threats: formattedThreats,
    });
  } catch (error: any) {
    logger.error('Get threats error:', error.message);
    res.status(200).json({
      success: true,
      threats: [],
    });
  }
});

export default router;
