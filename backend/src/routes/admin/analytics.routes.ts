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
 * GET /api/admin/analytics/summary
 * Get quick summary stats for admin dashboard
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const [
      totalTechnicians,
      activeTechnicians,
      pendingApprovals,
      totalSessions,
      activeSessions,
      totalProfiles,
      activeCampaigns,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'TECHNICIAN' } }),
      prisma.user.count({ where: { role: 'TECHNICIAN', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'TECHNICIAN', status: 'PENDING' } }),
      prisma.session.count(),
      prisma.session.count({ where: { status: { in: ['ACTIVE', 'PENDING'] } } }),
      prisma.profile.count(),
      prisma.campaign.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalCaptures = await prisma.profile.count({ where: { authStatus: 'AUTHENTICATED' } });

    res.status(200).json({
      success: true,
      summary: {
        totalTechnicians,
        activeTechnicians,
        pendingApprovals,
        totalSessions,
        activeSessions,
        totalProfiles,
        totalCaptures,
        activeCampaigns,
      },
    });
  } catch (error: any) {
    logger.error('Get analytics summary error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get analytics summary',
    });
  }
});

/**
 * GET /api/admin/analytics?range=7d|30d|90d
 * Get platform-wide analytics with real aggregations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { range = '7d' } = req.query;

    // Calculate cutoff date based on range
    const now = new Date();
    const cutoffDate = new Date();
    switch (range) {
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '7d':
      default:
        cutoffDate.setDate(now.getDate() - 7);
        break;
    }

    // Fetch captures by day
    const profiles = await prisma.profile.findMany({
      where: {
        createdAt: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
      },
    });

    const capturesByDay: { date: string; count: number }[] = [];
    const dayMap = new Map<string, number>();

    profiles.forEach((p) => {
      const dateKey = p.createdAt.toISOString().split('T')[0];
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + 1);
    });

    dayMap.forEach((count, date) => {
      capturesByDay.push({ date, count });
    });

    // Fetch top domains
    const domains = await prisma.domain.findMany({
      select: {
        name: true,
        status: true,
      },
    });

    const topDomains = domains.slice(0, 5).map((d) => ({
      domain: d.name,
      captures: 0, // Can be enhanced later with deployment-domain mapping
    }));

    // Fetch top campaigns
    const campaigns = await prisma.campaign.findMany({
      include: {
        _count: {
          select: {
            Profile: true,
          },
        },
      },
      orderBy: {
        Profile: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    const topCampaigns = campaigns.map((c) => ({
      name: c.name,
      captures: c._count.Profile,
    }));

    // Fetch sessions by status
    const allSessions = await prisma.session.findMany({
      select: {
        status: true,
      },
    });

    const statusMap = new Map<string, number>();
    allSessions.forEach((s) => {
      statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1);
    });

    const sessionsByStatus: { status: string; count: number }[] = [];
    statusMap.forEach((count, status) => {
      sessionsByStatus.push({ status, count });
    });

    // Fetch geo breakdown from AccessLog
    const accessLogs = await prisma.accessLog.findMany({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
      select: {
        country: true,
      },
    });

    const countryMap = new Map<string, number>();
    accessLogs.forEach((log) => {
      const country = log.country || 'Unknown';
      countryMap.set(country, (countryMap.get(country) || 0) + 1);
    });

    const geoBreakdown: { country: string; requests: number }[] = [];
    countryMap.forEach((requests, country) => {
      geoBreakdown.push({ country, requests });
    });
    geoBreakdown.sort((a, b) => b.requests - a.requests);
    const topGeo = geoBreakdown.slice(0, 5);

    // Fetch requests by hour
    const allAccessLogs = await prisma.accessLog.findMany({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
      select: {
        timestamp: true,
      },
    });

    const hourMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, 0);
    }

    allAccessLogs.forEach((log) => {
      const hour = log.timestamp.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const requestsByHour: { hour: number; requests: number }[] = [];
    hourMap.forEach((requests, hour) => {
      requestsByHour.push({ hour, requests });
    });

    // Fetch bot and blocked counts
    const botCount = await prisma.accessLog.count({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
        botDetected: true,
      },
    });

    const blockedCount = await prisma.accessLog.count({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
        blocked: true,
      },
    });

    const totalRequests = await prisma.accessLog.count({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
    });

    const uniqueIPs = await prisma.accessLog.findMany({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
      select: {
        ip: true,
      },
      distinct: ['ip'],
    });

    res.status(200).json({
      success: true,
      range,
      capturesByDay,
      topDomains,
      topCampaigns,
      sessionsByStatus,
      geoBreakdown: topGeo,
      requestsByHour,
      botBlocked: botCount,
      uniqueIPs: uniqueIPs.length,
      totalRequests,
    });
  } catch (error: any) {
    logger.error('Get platform analytics error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get platform analytics',
    });
  }
});

export default router;
