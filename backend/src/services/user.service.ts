import prisma from '../config/database';
import { logger } from '../utils/logger.util';

export class UserService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(filters?: {
    role?: string;
    status?: string;
    search?: string;
  }) {
    try {
      const where: any = {};

      if (filters?.role) {
        where.role = filters.role;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.search) {
        where.OR = [
          { email: { contains: filters.search } },
          { fullName: { contains: filters.search } },
          { company: { contains: filters.search } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          fullName: true,
          company: true,
          phoneNumber: true,
          lastLoginAt: true,
          loginCount: true,
          approvedAt: true,
          approvedBy: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        users,
        total: users.length,
      };
    } catch (error: any) {
      logger.error('Get all users error:', error.message);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
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
          lastLoginIp: true,
          loginCount: true,
          approvedAt: true,
          approvedBy: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              Campaign: true,
              Deployment: true,
            },
          },
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
      logger.error('Get user by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Approve technician (admin only)
   */
  async approveUser(userId: string, approvedBy: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'PENDING') {
        throw new Error('User is not pending approval');
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          approvedAt: new Date(),
          approvedBy,
        },
      });

      logger.success(`User approved: ${user.email} by ${approvedBy}`);

      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error: any) {
      logger.error('Approve user error:', error.message);
      throw error;
    }
  }

  /**
   * Suspend user (admin only)
   */
  async suspendUser(userId: string, reason?: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.role === 'ADMIN') {
        throw new Error('Cannot suspend admin user');
      }

      await prisma.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED' },
      });

      logger.warn(`User suspended: ${user.email}. Reason: ${reason || 'N/A'}`);

      return {
        success: true,
        message: 'User suspended successfully',
      };
    } catch (error: any) {
      logger.error('Suspend user error:', error.message);
      throw error;
    }
  }

  /**
   * Reactivate user (admin only)
   */
  async reactivateUser(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });

      logger.success(`User reactivated: ${user.email}`);

      return {
        success: true,
        message: 'User reactivated successfully',
      };
    } catch (error: any) {
      logger.error('Reactivate user error:', error.message);
      throw error;
    }
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.role === 'ADMIN') {
        throw new Error('Cannot delete admin user');
      }

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id: userId },
      });

      logger.warn(`User deleted: ${user.email}`);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete user error:', error.message);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: {
    fullName?: string;
    company?: string;
    phoneNumber?: string;
  }) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          email: true,
          fullName: true,
          company: true,
          phoneNumber: true,
          updatedAt: true,
        },
      });

      logger.success(`Profile updated for user ${user.email}`);

      return {
        success: true,
        user,
      };
    } catch (error: any) {
      logger.error('Update profile error:', error.message);
      throw error;
    }
  }

  /**
   * Get pending users count (admin dashboard)
   */
  async getPendingUsersCount() {
    try {
      const count = await prisma.user.count({
        where: { status: 'PENDING' },
      });

      return {
        success: true,
        count,
      };
    } catch (error: any) {
      logger.error('Get pending users count error:', error.message);
      throw error;
    }
  }
}

export default new UserService();
