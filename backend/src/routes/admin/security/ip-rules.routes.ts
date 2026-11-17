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
 * GET /api/admin/security/ip-rules
 * Get all IP rules
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rules = await prisma.ipRule.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      rules: rules.map(rule => ({
        id: rule.id,
        ip: rule.ip,
        action: rule.action,
        reason: rule.reason,
        expiresAt: rule.expiresAt?.toISOString() || null,
        addedBy: rule.addedBy || 'System',
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    logger.error('Get IP rules error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get IP rules',
    });
  }
});

/**
 * POST /api/admin/security/ip-rules
 * Create a new IP rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ip, action, reason, expiresAt } = req.body;
    const userId = (req as any).user?.email || 'Unknown';

    if (!ip || !action || !reason) {
      return res.status(400).json({
        success: false,
        error: 'IP, action, and reason are required',
      });
    }

    if (!['block', 'allow'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "block" or "allow"',
      });
    }

    // Validate IP format (basic check)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipPattern.test(ip.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format',
      });
    }

    const rule = await prisma.ipRule.create({
      data: {
        ip: ip.trim(),
        action,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        addedBy: userId,
      },
    });

    res.status(201).json({
      success: true,
      rule: {
        id: rule.id,
        ip: rule.ip,
        action: rule.action,
        reason: rule.reason,
        expiresAt: rule.expiresAt?.toISOString() || null,
        addedBy: rule.addedBy,
        createdAt: rule.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Create IP rule error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create IP rule',
    });
  }
});

/**
 * PATCH /api/admin/security/ip-rules/:id
 * Update an IP rule
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if rule exists
    const existing = await prisma.ipRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'IP rule not found',
      });
    }

    // If toggling action
    if (updates.action === undefined) {
      updates.action = existing.action === 'block' ? 'allow' : 'block';
    }

    // Validate action if provided
    if (updates.action && !['block', 'allow'].includes(updates.action)) {
      return res.status(400).json({
        success: false,
        error: 'Action must be "block" or "allow"',
      });
    }

    const rule = await prisma.ipRule.update({
      where: { id },
      data: {
        action: updates.action,
        reason: updates.reason,
        expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : undefined,
      },
    });

    res.status(200).json({
      success: true,
      rule: {
        id: rule.id,
        ip: rule.ip,
        action: rule.action,
        reason: rule.reason,
        expiresAt: rule.expiresAt?.toISOString() || null,
        addedBy: rule.addedBy,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Update IP rule error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update IP rule',
    });
  }
});

/**
 * DELETE /api/admin/security/ip-rules/:id
 * Delete an IP rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.ipRule.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'IP rule deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete IP rule error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete IP rule',
    });
  }
});

/**
 * POST /api/admin/security/ip-rules/bulk
 * Bulk create IP rules
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { ips, action, reason, expiresAt } = req.body;
    const userId = (req as any).user?.email || 'Unknown';

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'IPs array is required and must not be empty',
      });
    }

    if (!action || !['block', 'allow'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'Valid action (block/allow) is required',
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required',
      });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Validate IP format
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

    for (const ip of ips) {
      const ipTrimmed = ip.trim();
      
      if (!ipTrimmed) {
        skipped++;
        continue;
      }

      // Validate format
      if (!ipPattern.test(ipTrimmed)) {
        errors.push(`${ipTrimmed}: Invalid format`);
        skipped++;
        continue;
      }

      // Check if already exists
      const existing = await prisma.ipRule.findFirst({
        where: { ip: ipTrimmed },
      });

      if (existing) {
        skipped++;
        continue;
      }

      try {
        await prisma.ipRule.create({
          data: {
            ip: ipTrimmed,
            action,
            reason,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            addedBy: userId,
          },
        });
        created++;
      } catch (error: any) {
        errors.push(`${ipTrimmed}: ${error.message}`);
        skipped++;
      }
    }

    res.status(200).json({
      success: true,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${created} rules, skipped ${skipped}`,
    });
  } catch (error: any) {
    logger.error('Bulk create IP rules error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create IP rules',
    });
  }
});

export default router;
