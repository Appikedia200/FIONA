import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';
import bcrypt from 'bcryptjs';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/settings
 * Get admin settings and system info + platform config
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const [user, platformSettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          role: true,
          fullName: true,
        },
      }),
      prisma.platformSettings.findUnique({
        where: { id: 'singleton' },
      }),
    ]);

    res.status(200).json({
      success: true,
      profile: {
        fullName: user?.fullName || '',
        email: user?.email || '',
        role: user?.role || 'ADMIN',
      },
      platformConfig: {
        maxConcurrentSessions: 8, // From RESOURCE_LIMITS
        maxLaunchedProfiles: 5,
        sessionIdleTimeout: 8,
        profileIdleTimeout: 30,
        registrationOpen: platformSettings?.allowRegistration || true,
      },
      systemInfo: {
        version: '1.2.4',
        environment: process.env.NODE_ENV || 'production',
        backend: 'Node.js + Express',
        frontend: 'Next.js 16',
        database: 'SQLite (Prisma)',
      },
    });
  } catch (error: any) {
    logger.error('Get settings error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get settings',
    });
  }
});

/**
 * PATCH /api/admin/settings
 * Update platform configuration
 */
router.patch('/', async (req: Request, res: Response) => {
  try {
    const {
      maxConcurrentSessions,
      maxLaunchedProfiles,
      sessionIdleTimeout,
      profileIdleTimeout,
      registrationOpen,
    } = req.body;

    // Update platform settings
    await prisma.platformSettings.upsert({
      where: { id: 'singleton' },
      update: {
        allowRegistration: registrationOpen,
        // Note: Resource limits are in code, not DB
        // In production, you'd store these in DB or env vars
      },
      create: {
        id: 'singleton',
        allowRegistration: registrationOpen || true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Platform settings updated',
    });
  } catch (error: any) {
    logger.error('Update settings error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update settings',
    });
  }
});

/**
 * POST /api/admin/change-password
 * Change admin password
 */
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    logger.error('Change password error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to change password',
    });
  }
});

export default router;
