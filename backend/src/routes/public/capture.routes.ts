import { Router, Request, Response } from 'express';
import campaignService from '../../services/campaign.service';
import { logger } from '../../utils/logger.util';

const router = Router();

/**
 * POST /api/capture/:captureId/hit
 * Log capture page hit (called by Cloudflare Worker)
 */
router.post('/:captureId/hit', async (req: Request, res: Response) => {
  try {
    const { captureId } = req.params;
    const { ip, userAgent, country } = req.body;

    // Get campaign
    const result = await campaignService.getCampaignByCaptureId(captureId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    // Increment view count
    await campaignService.incrementViewCount(captureId);

    // Log the hit
    logger.info(`Capture hit: ${captureId} from ${ip || 'unknown'} (${country || 'unknown'})`);

    res.status(200).json({
      success: true,
      campaign: {
        id: result.campaign.id,
        captureId: result.campaign.captureId,
        provider: result.campaign.provider,
      },
    });
  } catch (error: any) {
    logger.error('Capture hit error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to log hit',
    });
  }
});

export default router;
