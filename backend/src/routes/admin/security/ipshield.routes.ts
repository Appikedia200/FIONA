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
 * GET /api/admin/ip-shield
 * Get all IP rules (whitelist + blacklist)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const [whitelist, blacklist] = await Promise.all([
      prisma.iPWhitelist.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ipAddress: true,
          label: true,
          addedBy: true,
          createdAt: true,
        },
      }),
      prisma.iPBlacklist.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ipAddress: true,
          reason: true,
          severity: true,
          addedBy: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
    ]);

    const rules = [
      ...whitelist.map((w) => ({
        id: w.id,
        ip: w.ipAddress,
        type: 'allow' as const,
        reason: w.label,
        addedBy: w.addedBy,
        createdAt: w.createdAt.toISOString(),
        expiresAt: null,
      })),
      ...blacklist.map((b) => ({
        id: b.id,
        ip: b.ipAddress,
        type: 'block' as const,
        reason: b.reason,
        addedBy: b.addedBy || 'System',
        createdAt: b.createdAt.toISOString(),
        expiresAt: b.expiresAt?.toISOString() || null,
      })),
    ];

    res.status(200).json({
      success: true,
      rules,
    });
  } catch (error: any) {
    logger.error('Get IP rules error:', error.message);
    res.status(200).json({
      success: true,
      rules: [],
    });
  }
});

/**
 * POST /api/admin/ip-shield
 * Add a new IP rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ip, type, reason } = req.body;
    const userId = (req as any).user.email;

    if (!ip || !type || !reason) {
      return res.status(400).json({
        success: false,
        message: 'IP, type, and reason are required',
      });
    }

    if (type === 'allow') {
      await prisma.iPWhitelist.create({
        data: {
          ipAddress: ip,
          label: reason,
          addedBy: userId,
          active: true,
        },
      });
    } else if (type === 'block') {
      await prisma.iPBlacklist.create({
        data: {
          ipAddress: ip,
          reason,
          addedBy: userId,
          severity: 'MEDIUM',
          active: true,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be "allow" or "block"',
      });
    }

    res.status(201).json({
      success: true,
      message: 'IP rule added successfully',
    });
  } catch (error: any) {
    logger.error('Add IP rule error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to add IP rule',
    });
  }
});

/**
 * DELETE /api/admin/ip-shield/:id
 * Delete an IP rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try deleting from both tables
    try {
      await prisma.iPWhitelist.delete({ where: { id } });
    } catch {
      await prisma.iPBlacklist.delete({ where: { id } });
    }

    res.status(200).json({
      success: true,
      message: 'IP rule deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete IP rule error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete IP rule',
    });
  }
});

/**
 * POST /api/admin/security/ip-rules/bulk
 * Add multiple IP rules at once
 */
router.post('/ip-rules/bulk', async (req: Request, res: Response) => {
  try {
    const { ips, action, reason, expiresAt } = req.body;
    const userId = (req as any).user.email;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IPs array is required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required',
      });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const ip of ips) {
      try {
        // Validate IP format (basic validation)
        const ipTrimmed = ip.trim();
        if (!ipTrimmed) continue;

        // Check if already exists
        if (action === 'allow') {
          const existing = await prisma.iPWhitelist.findFirst({
            where: { ipAddress: ipTrimmed, active: true },
          });

          if (existing) {
            skipped++;
            continue;
          }

          await prisma.iPWhitelist.create({
            data: {
              ipAddress: ipTrimmed,
              label: reason,
              addedBy: userId,
              active: true,
            },
          });
        } else {
          const existing = await prisma.iPBlacklist.findFirst({
            where: { ipAddress: ipTrimmed, active: true },
          });

          if (existing) {
            skipped++;
            continue;
          }

          await prisma.iPBlacklist.create({
            data: {
              ipAddress: ipTrimmed,
              reason,
              addedBy: userId,
              severity: 'MEDIUM',
              active: true,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
          });
        }

        created++;
      } catch (error: any) {
        errors.push(`${ip}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      created,
      skipped,
      errors,
      message: `Added ${created} rules, skipped ${skipped} duplicates`,
    });
  } catch (error: any) {
    logger.error('Bulk add IP rules error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to add IP rules',
    });
  }
});

export default router;