import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger.util';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/settings
 * Get current user settings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        company: true,
        phoneNumber: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      user,
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
 * PATCH /api/settings/profile
 * Update user profile
 */
router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, email, company, phoneNumber } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: name,
        email,
        company,
        phoneNumber,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error: any) {
    logger.error('Update profile error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update profile',
    });
  }
});

/**
 * PATCH /api/settings/password
 * Change user password
 */
router.patch('/password', async (req: Request, res: Response) => {
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

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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

/**
 * GET /api/settings/api-keys
 * Get user's API keys (returns masked keys)
 */
router.get('/api-keys', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // For now, return the user's single API key
    // In production, you'd have a separate APIKey table
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        apiKey: true,
        apiKeyLastUsed: true,
      },
    });

    const keys = user?.apiKey ? [
      {
        id: 'main',
        name: 'Main API Key',
        key: user.apiKey.substring(0, 8) + '...' + user.apiKey.substring(user.apiKey.length - 4),
        lastUsed: user.apiKeyLastUsed?.toISOString(),
        createdAt: new Date().toISOString(),
      },
    ] : [];

    res.status(200).json({
      success: true,
      keys,
    });
  } catch (error: any) {
    logger.error('Get API keys error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get API keys',
    });
  }
});

/**
 * POST /api/settings/api-keys
 * Generate a new API key
 */
router.post('/api-keys', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { name, expiresIn } = req.body;

    // Generate new API key
    const apiKey = 'fiona_' + crypto.randomBytes(32).toString('hex');

    await prisma.user.update({
      where: { id: userId },
      data: { apiKey },
    });

    res.status(201).json({
      success: true,
      message: 'API key generated successfully',
      key: apiKey, // Show full key only once
    });
  } catch (error: any) {
    logger.error('Generate API key error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to generate API key',
    });
  }
});

/**
 * DELETE /api/settings/api-keys/:id
 * Revoke an API key
 */
router.delete('/api-keys/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { apiKey: null },
    });

    res.status(200).json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    logger.error('Revoke API key error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to revoke API key',
    });
  }
});

export default router;