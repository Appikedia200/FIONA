import { Router, Request, Response } from 'express';
import deploymentService from '../../services/deployment.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireTechnician } from '../../middleware/rbac.middleware';
import { createDeploymentSchema } from '../../utils/validation.util';
import { logger } from '../../utils/logger.util';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(requireTechnician);

/**
 * GET /api/deployments
 * Get all deployments for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        deployments: [],
        total: 0,
      });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const result = await deploymentService.getUserDeployments(req.user.id, isAdmin);

    // Always return success with empty array if no deployments
    if (!result.success || !result.deployments) {
      return res.status(200).json({
        success: true,
        deployments: [],
        total: 0,
      });
    }

    res.status(200).json({
      success: true,
      deployments: result.deployments,
      total: result.deployments.length,
    });
  } catch (error: any) {
    logger.error('Get deployments error:', error.message);
    // Always return 200 with empty array on error to prevent UI crashes
    res.status(200).json({
      success: true,
      deployments: [],
      total: 0,
    });
  }
});

/**
 * POST /api/deployments
 * Deploy a new domain
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    // Validate input
    const validatedData = createDeploymentSchema.parse(req.body);

    // Deploy domain
    const result = await deploymentService.deployDomain({
      userId: req.user.id,
      campaignId: validatedData.campaignId,
      domain: validatedData.domain,
      subdomain: validatedData.subdomain,
      isCustomDomain: validatedData.isCustomDomain,
    });

    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Deploy domain error:', error.message);

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
      error: error.message || 'Failed to deploy domain',
    });
  }
});

/**
 * GET /api/deployments/:id
 * Get deployment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await deploymentService.getDeploymentById(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Get deployment by ID error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get deployment',
    });
  }
});

/**
 * GET /api/deployments/:id/status
 * Poll deployment progress (for live UI updates)
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await deploymentService.getDeploymentById(id, req.user.id, isAdmin);

    if (!result.success) {
      res.status(404).json(result);
      return;
    }

    const deployment = result.deployment;

    // Return simplified status for polling
    res.status(200).json({
      success: true,
      status: deployment.deploymentStatus,
      step: deployment.deploymentStatus === 'DEPLOYING' 
        ? 'Deploying to Cloudflare...' 
        : deployment.deploymentStatus === 'DEPLOYED'
        ? 'Live'
        : deployment.deploymentStatus === 'FAILED'
        ? 'Deployment failed'
        : 'Pending',
      domain: deployment.domain,
      sslStatus: deployment.sslStatus,
      dnsStatus: deployment.dnsStatus,
      deploymentStatus: deployment.deploymentStatus,
    });
  } catch (error: any) {
    logger.error('Get deployment status error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to get deployment status',
    });
  }
});

/**
 * DELETE /api/deployments/:id
 * Delete deployment
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    const result = await deploymentService.deleteDeployment(id, req.user.id, isAdmin);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Delete deployment error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete deployment',
    });
  }
});

export default router;
