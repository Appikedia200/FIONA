import { Router, Request, Response } from 'express';
import monitoringService from '../../services/monitoring.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTechnician } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(requireTechnician);

/**
 * GET /api/sessions
 * Get all sessions for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { campaignId, status, email } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await monitoringService.getAllSessions({
      userId: req.user.id,
      campaignId: campaignId as string,
      status: status as string,
      email: email as string,
      isAdmin,
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get sessions error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get sessions',
    });
  }
});

/**
 * GET /api/sessions/active
 * Get active sessions (real-time monitoring)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const isAdmin = req.user.role === 'ADMIN';
    const result = await monitoringService.getActiveSessions(
      req.user.id,
      isAdmin
    );

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get active sessions error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get active sessions',
    });
  }
});

/**
 * GET /api/sessions/:id
 * Get session by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await monitoringService.getSessionById(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get session by ID error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get session',
    });
  }
});

/**
 * GET /api/sessions/:id/credentials
 * Get credential fields for session
 */
router.get('/:id/credentials', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await monitoringService.getSessionCredentials(
      id,
      req.user.id,
      isAdmin
    );

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get session credentials error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get credentials',
    });
  }
});

export default router;
