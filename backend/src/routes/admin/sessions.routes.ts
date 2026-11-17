import { Router, Request, Response } from 'express';
import monitoringService from '../../services/monitoring.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

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

    // If result has sessions, ensure they have all required fields
    if (result.success && result.sessions) {
      let sessions = result.sessions.map((session: any) => ({
        id: session.id,
        technicianEmail: session.technicianEmail || session.userEmail || session.email,
        target: session.targetUrl || session.target || session.targetPlatform || 'Unknown',
        stage: session.currentStage || session.stage || 'email',
        status: session.status || 'ACTIVE',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt || session.createdAt,
      }));

      // Apply limit if provided
      if (limit) {
        sessions = sessions.slice(0, parseInt(limit as string));
      }

      return res.status(200).json({
        success: true,
        sessions,
      });
    }

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

export default router;
