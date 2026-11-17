import { Router, Request, Response } from 'express';
import userService from '../../services/user.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/technicians
 * Get all users (with filters)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { role, status, search } = req.query;

    const result = await userService.getAllUsers({
      role: role as string,
      status: status as string,
      search: search as string,
    });

    // If no users, return empty array with success
    if (!result.success || !result.users || result.users.length === 0) {
      return res.status(200).json({
        success: true,
        technicians: [],
        total: 0,
      });
    }

    // Enhance with session counts if available
    const prisma = (await import('../../config/database')).default;
    
    const enhancedUsers = await Promise.all(
      result.users.map(async (user: any) => {
        const sessionsCount = await prisma.session.count({
          where: {
            userId: user.id,
            status: {
              in: ['ACTIVE', 'PENDING'],
            },
          },
        });

        return {
          ...user,
          sessionsCount,
          lastActive: user.updatedAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      technicians: enhancedUsers,
      total: enhancedUsers.length,
    });
  } catch (error: any) {
    logger.error('Get all users error:', error.message);
    // Always return 200 with empty array on error to prevent UI crashes
    res.status(200).json({
      success: true,
      technicians: [],
      total: 0,
    });
  }
});

/**
 * GET /api/admin/technicians/pending
 * Get pending users count
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const result = await userService.getPendingUsersCount();
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get pending users count error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get pending users count',
    });
  }
});

/**
 * GET /api/admin/technicians/:id
 * Get user by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await userService.getUserById(id);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get user by ID error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get user',
    });
  }
});

/**
 * POST /api/admin/technicians/:id/approve
 * Approve technician
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const result = await userService.approveUser(id, req.user.email);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Approve user error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve user',
    });
  }
});

/**
 * POST /api/admin/technicians/:id/suspend
 * Suspend user
 */
router.post('/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await userService.suspendUser(id, reason);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Suspend user error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to suspend user',
    });
  }
});

/**
 * POST /api/admin/technicians/:id/reactivate
 * Reactivate user
 */
router.post('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await userService.reactivateUser(id);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Reactivate user error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reactivate user',
    });
  }
});

/**
 * DELETE /api/admin/technicians/:id
 * Delete user
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await userService.deleteUser(id);
    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Delete user error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete user',
    });
  }
});

export default router;
