import { Request, Response } from 'express';
import authService from '../../services/auth.service';
import { registerSchema, loginSchema } from '../../utils/validation.util';
import { logger } from '../../utils/logger.util';

export class AuthController {
  /**
   * POST /api/auth/register
   * Register new technician
   */
  async register(req: Request, res: Response) {
    try {
      // Validate input
      const validatedData = registerSchema.parse(req.body);

      // Register user
      const result = await authService.register(validatedData);

      res.status(201).json(result);
    } catch (error: any) {
      logger.error('Register controller error:', error.message);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Registration failed',
      });
    }
  }

  /**
   * POST /api/auth/login
   * Login user
   */
  async login(req: Request, res: Response) {
    try {
      // Validate input
      const validatedData = loginSchema.parse(req.body);

      // Get IP address
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

      // Login user
      const result = await authService.login(validatedData, ipAddress);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Login controller error:', error.message);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }

      res.status(401).json({
        success: false,
        error: error.message || 'Login failed',
      });
    }
  }

  /**
   * GET /api/auth/profile
   * Get current user profile
   */
  async getProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const result = await authService.getProfile(req.user.id);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Get profile controller error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to get profile',
      });
    }
  }

  /**
   * POST /api/auth/api-key
   * Generate new API key
   */
  async generateApiKey(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const result = await authService.generateUserApiKey(req.user.id);

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Generate API key controller error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to generate API key',
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  async changePassword(req: Request, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated',
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
        return;
      }

      const result = await authService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );

      res.status(200).json(result);
    } catch (error: any) {
      logger.error('Change password controller error:', error.message);

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to change password',
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user (client-side token deletion)
   */
  async logout(req: Request, res: Response) {
    try {
      // For JWT, logout is handled client-side by deleting the token
      // Here we just return success
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      logger.error('Logout controller error:', error.message);

      res.status(400).json({
        success: false,
        error: 'Logout failed',
      });
    }
  }
}

export default new AuthController();
