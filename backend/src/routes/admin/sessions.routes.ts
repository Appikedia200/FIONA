import { Router, Request, Response } from 'express';
import monitoringService from '../../services/monitoring.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';
import resourceManager from '../../services/resource-manager.service';
import prisma from '../../config/database';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/sessions
 * Get all sessions (admin global view)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { campaignId, status, email, limit } = req.query;

    const result = await monitoringService.getAllSessions({
      campaignId: campaignId as string,
      status: status as string,
      email: email as string,
      isAdmin: true,
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get all sessions (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get sessions',
    });
  }
});

/**
 * GET /api/admin/sessions/active
 * Get all active sessions (admin real-time monitoring)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const result = await monitoringService.getActiveSessions(undefined, true);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get active sessions (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get active sessions',
    });
  }
});

/**
 * GET /api/admin/sessions/:id
 * Get session by ID (admin)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await monitoringService.getSessionById(id, undefined, true);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get session by ID (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get session',
    });
  }
});

/**
 * GET /api/admin/sessions/:id/credentials
 * Get credential fields for session (admin)
 */
router.get('/:id/credentials', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await monitoringService.getSessionCredentials(id, undefined, true);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get session credentials (admin) error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get credentials',
    });
  }
});

/**
 * DELETE /api/admin/sessions/:id
 * Delete a single session by ID
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    // Close in-memory browser if running
    try {
      const ctx = resourceManager.getSession(id);
      if (ctx) {
        await ctx.browser.close().catch(() => {});
        resourceManager.destroySession(id);
      }
    } catch {}
    await prisma.session.delete({ where: { id } });
    logger.info(`Session deleted: ${id}`);
    res.status(200).json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    logger.error('Delete session error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete session' });
  }
});

/**
 * DELETE /api/admin/sessions
 * Bulk delete sessions by IDs
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids array required' });
    }
    // Close any running browsers
    for (const id of ids) {
      try {
        const ctx = resourceManager.getSession(id);
        if (ctx) {
          await ctx.browser.close().catch(() => {});
          resourceManager.destroySession(id);
        }
      } catch {}
    }
    const result = await prisma.session.deleteMany({ where: { id: { in: ids } } });
    logger.info(`Bulk deleted ${result.count} sessions`);
    res.status(200).json({ success: true, deleted: result.count });
  } catch (error: any) {
    logger.error('Bulk delete sessions error:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete sessions' });
  }
});

export default router;
