import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/bcrypt.util';
import { signToken, JWTPayload, generateApiKey } from '../utils/jwt.util';
import { logger } from '../utils/logger.util';
import { RegisterInput, LoginInput } from '../utils/validation.util';

export class AuthService {
  /**
   * Register new technician
   */
  async register(data: RegisterInput) {
    try {
      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create user (status: PENDING - admin must approve)
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: 'TECHNICIAN',
          status: 'PENDING', // Admin must approve
          fullName: data.fullName,
          company: data.company,
          phoneNumber: data.phoneNumber,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          fullName: true,
          company: true,
          createdAt: true,
        },
      });

      logger.success(`New technician registered: ${user.email}`);

      return {
        success: true,
        message: 'Registration successful. Please wait for admin approval.',
        user,
      };
    } catch (error: any) {
      logger.error('Registration error:', error.message);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginInput, ipAddress?: string) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check password
      const isValidPassword = await comparePassword(data.password, user.password);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Check user status
      if (user.status === 'PENDING') {
        throw new Error('Account pending approval');
      }

      if (user.status === 'SUSPENDED') {
        throw new Error('Account suspended');
      }

      if (user.status !== 'ACTIVE') {
        throw new Error('Account not active');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
          loginCount: { increment: 1 },
        },
      });

      // Generate JWT token
      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as 'ADMIN' | 'TECHNICIAN',
        status: user.status,
      };

      const token = signToken(payload);

      logger.success(`User logged in: ${user.email} (${user.role})`);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          fullName: user.fullName,
        },
      };
    } catch (error: any) {
      logger.error('Login error:', error.message);
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          fullName: true,
          company: true,
          phoneNumber: true,
          apiKey: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        user,
      };
    } catch (error: any) {
      logger.error('Get profile error:', error.message);
      throw error;
    }
  }

  /**
   * Generate API key for user
   */
  async generateUserApiKey(userId: string) {
    try {
      const apiKey = generateApiKey();

      await prisma.user.update({
        where: { id: userId },
        data: { apiKey },
      });

      logger.success(`API key generated for user ${userId}`);

      return {
        success: true,
        apiKey,
      };
    } catch (error: any) {
      logger.error('Generate API key error:', error.message);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await comparePassword(currentPassword, user.password);

      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      logger.success(`Password changed for user ${user.email}`);

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error: any) {
      logger.error('Change password error:', error.message);
      throw error;
    }
  }
}

export default new AuthService();
