import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/campaign-profiles
 * Get all campaign profiles with credential counts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const profiles = await prisma.campaignProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        campaigns: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
    });

    // Count captured credentials for each profile type
    const profilesWithCounts = await Promise.all(
      profiles.map(async (profile) => {
        // Get campaigns using this profile
        const campaignIds = profile.campaigns.map((c) => c.id);
        
        // Count credentials captured from those campaigns
        const credentialCount = await prisma.profile.count({
          where: {
            campaignId: { in: campaignIds },
          },
        });

        return {
          id: profile.id,
          name: profile.name,
          type: profile.type,
          targetDomainPattern: profile.targetDomainPattern,
          campaignCount: profile._count.campaigns,
          credentialCount,
          createdBy: profile.createdBy,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        };
      })
    );

    res.status(200).json({
      success: true,
      profiles: profilesWithCounts,
    });
  } catch (error: any) {
    logger.error('Get campaign profiles error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get campaign profiles',
    });
  }
});

/**
 * POST /api/admin/campaign-profiles
 * Create new campaign profile
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { name, type, targetDomainPattern } = req.body;

    if (!name || !type) {
      res.status(400).json({
        success: false,
        error: 'Name and type are required',
      });
      return;
    }

    if (!['GMAIL', 'GSUITE'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Type must be GMAIL or GSUITE',
      });
      return;
    }

    const profile = await prisma.campaignProfile.create({
      data: {
        name,
        type,
        targetDomainPattern: targetDomainPattern || null,
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    logger.info(`Campaign profile created: ${profile.id} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        targetDomainPattern: profile.targetDomainPattern,
        createdBy: profile.createdBy,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Create campaign profile error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create campaign profile',
    });
  }
});

/**
 * PUT /api/admin/campaign-profiles/:id
 * Update campaign profile
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, targetDomainPattern } = req.body;

    if (type && !['GMAIL', 'GSUITE'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Type must be GMAIL or GSUITE',
      });
      return;
    }

    const profile = await prisma.campaignProfile.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(targetDomainPattern !== undefined && { targetDomainPattern }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    logger.info(`Campaign profile updated: ${id}`);

    res.status(200).json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        targetDomainPattern: profile.targetDomainPattern,
        createdBy: profile.createdBy,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Update campaign profile error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update campaign profile',
    });
  }
});

/**
 * DELETE /api/admin/campaign-profiles/:id
 * Delete campaign profile
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if any campaigns are using this profile
    const campaignsUsingProfile = await prisma.campaign.count({
      where: { profileId: id },
    });

    if (campaignsUsingProfile > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete profile: ${campaignsUsingProfile} campaign(s) are using it`,
      });
      return;
    }

    await prisma.campaignProfile.delete({
      where: { id },
    });

    logger.info(`Campaign profile deleted: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Campaign profile deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete campaign profile error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete campaign profile',
    });
  }
});

export default router;
