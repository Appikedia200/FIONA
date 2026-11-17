import { Router, Request, Response } from 'express';
import monitoringService from '../../services/monitoring.service';
import profileManagerService from '../../services/browser/profile-manager.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTechnician } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(requireTechnician);

/**
 * GET /api/profiles
 * Get all profiles for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { campaignId, authStatus, isLaunched, email } = req.query;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await monitoringService.getAllProfiles({
      userId: req.user.id,
      campaignId: campaignId as string,
      authStatus: authStatus as string,
      isLaunched: isLaunched === 'true',
      email: email as string,
      isAdmin,
    });

    // Format profiles to explicitly include required fields
    const formattedProfiles = result.profiles.map((profile: any) => ({
      id: profile.id,
      email: profile.email,
      password: profile.password,
      provider: profile.provider,
      accountType: profile.accountType,
      authStatus: profile.authStatus,
      twoFactorEnabled: profile.twoFactorEnabled || false,
      isLaunched: profile.isLaunched,
      createdAt: profile.createdAt,
      lastLaunchedAt: profile.lastLaunched,
      userAgent: profile.userAgent,
      campaign: profile.campaign,
      cookies: profile.cookies ? JSON.parse(profile.cookies) : [],
    }));

    res.status(200).json({
      success: result.success,
      profiles: formattedProfiles,
      total: result.total,
    });
  } catch (error: any) {
    logger.error('Get profiles error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get profiles',
    });
  }
});

/**
 * GET /api/profiles/:id
 * Get profile by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await monitoringService.getProfileById(id, req.user.id, isAdmin);
    
    // Format response to include parsed cookies, password, and accountType
    if (result.success && result.profile) {
      const formatted = {
        ...result.profile,
        cookies: result.profile.cookies ? JSON.parse(result.profile.cookies as string) : [],
        password: result.profile.password || null,
        accountType: result.profile.accountType || 'GMAIL',
      };
      res.status(200).json({ success: true, profile: formatted });
    } else {
      res.status(200).json(result);
    }
  } catch (error: any) {
    logger.error('Get profile by ID error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get profile',
    });
  }
});

/**
 * POST /api/profiles/:id/launch
 * Launch browser profile
 */
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const result = await profileManagerService.launchProfile(id, req.user.id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('Launch profile error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to launch profile',
    });
  }
});

/**
 * POST /api/profiles/:id/close
 * Close launched profile
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const result = await profileManagerService.closeProfile(id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('Close profile error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to close profile',
    });
  }
});

/**
 * GET /api/profiles/:id/passwords
 * Access saved passwords
 */
router.get('/:id/passwords', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const result = await profileManagerService.accessPasswords(id);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('Get passwords error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get passwords',
    });
  }
});

export default router;
