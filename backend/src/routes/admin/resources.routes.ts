import { Router, Request, Response } from 'express';
import resourceManager from '../../services/resource-manager.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/resources
 * Get VPS resource statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const stats = resourceManager.getResourceStats();
    
    res.status(200).json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    logger.error('Get resource stats error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get resource stats',
    });
  }
});

/**
 * GET /api/admin/resources/sessions
 * Get all active sessions (from memory registry)
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = resourceManager.getAllActiveSessions();
    
    res.status(200).json({
      success: true,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        stage: s.stage,
        campaignId: s.campaignId,
        captureId: s.captureId,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        isActive: s.isActive,
        proxyUsed: s.proxyUsed,
      })),
      total: sessions.length,
    });
  } catch (error: any) {
    logger.error('Get active sessions from registry error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get active sessions',
    });
  }
});

/**
 * GET /api/admin/resources/profiles
 * Get all launched profiles (from memory registry)
 */
router.get('/profiles', async (req: Request, res: Response) => {
  try {
    const profiles = resourceManager.getAllLaunchedProfiles();
    
    res.status(200).json({
      success: true,
      profiles: profiles.map(p => ({
        profileId: p.profileId,
        userId: p.userId,
        launchedAt: p.launchedAt,
        lastInteraction: p.lastInteraction,
        isActive: p.isActive,
        activityWarned: p.activityWarned,
      })),
      total: profiles.length,
    });
  } catch (error: any) {
    logger.error('Get launched profiles from registry error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get launched profiles',
    });
  }
});

/**
 * POST /api/admin/resources/sessions/:id/close
 * Force close a session (emergency)
 */
router.post('/sessions/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await resourceManager.closeSession(id);
    
    logger.warn(`Session force-closed by admin: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Session closed successfully',
    });
  } catch (error: any) {
    logger.error('Force close session error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to close session',
    });
  }
});

/**
 * POST /api/admin/resources/profiles/:id/close
 * Force close a launched profile (emergency)
 */
router.post('/profiles/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    await resourceManager.closeLaunchedProfile(id);
    
    logger.warn(`Profile force-closed by admin: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Profile closed successfully',
    });
  } catch (error: any) {
    logger.error('Force close profile error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to close profile',
    });
  }
});

export default router;
