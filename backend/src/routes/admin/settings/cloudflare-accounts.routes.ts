import { Router, Request, Response } from 'express';
import prisma from '../../../config/database';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { requireAdmin } from '../../../middleware/rbac.middleware';
import { logger } from '../../../utils/logger.util';
import crypto from 'crypto';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

// Encryption key from environment
const ENCRYPTION_KEY = process.env.FIONA_SECRET || 'default-secret-key-change-me';

// Simple AES-256-CBC encryption
function encrypt(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return '••••••••';
  return token.substring(0, 8) + '••••••••••••••••••••';
}

/**
 * GET /api/admin/settings/cloudflare/accounts
 * Get all Cloudflare accounts
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.cloudflareAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { Domain: true },
        },
      },
    });

    const formattedAccounts = accounts.map((acc) => ({
      id: acc.id,
      name: acc.name,
      apiToken: '••••••••', // Always mask the token
      accountId: acc.accountId,
      email: acc.email,
      status: acc.status,
      zonesCount: acc._count.Domain,
      lastUsedAt: acc.lastUsedAt?.toISOString() || null,
      lastError: acc.lastError,
      createdAt: acc.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      accounts: formattedAccounts,
    });
  } catch (error: any) {
    logger.error('Get CF accounts error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get Cloudflare accounts',
    });
  }
});

/**
 * POST /api/admin/settings/cloudflare/accounts
 * Create new Cloudflare account
 */
router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const { name, apiToken, accountId, email } = req.body;

    if (!name || !apiToken || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'Name, API token, and Account ID are required',
      });
    }

    // Test credentials against Cloudflare API
    const testResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!testResponse.ok) {
      const cfError: any = await testResponse.json();
      return res.status(400).json({
        success: false,
        error: cfError.errors?.[0]?.message || 'Invalid Cloudflare credentials',
      });
    }

    const cfData: any = await testResponse.json();
    
    if (!cfData.success) {
      return res.status(400).json({
        success: false,
        error: 'Cloudflare API returned success: false',
      });
    }

    // Encrypt API token before saving
    const encryptedToken = encrypt(apiToken);

    // Create account
    const account = await prisma.cloudflareAccount.create({
      data: {
        name,
        apiToken: encryptedToken,
        accountId,
        email: email || null,
        status: 'active',
      },
    });

    logger.success(`Created Cloudflare account: ${name}`);

    res.status(201).json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        apiToken: '••••••••', // Mask the token
        accountId: account.accountId,
        email: account.email,
        status: account.status,
        zonesCount: 0,
        createdAt: account.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Create CF account error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create Cloudflare account',
    });
  }
});

/**
 * PATCH /api/admin/settings/cloudflare/accounts/:id
 * Update Cloudflare account
 */
router.patch('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, apiToken, accountId, email, status } = req.body;

    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (accountId) updateData.accountId = accountId;
    if (email !== undefined) updateData.email = email || null;
    if (status) updateData.status = status;

    // If new API token provided and it's not masked
    if (apiToken && apiToken !== '••••••••' && !apiToken.includes('•')) {
      // Test new credentials
      const testAccountId = accountId || (await prisma.cloudflareAccount.findUnique({ where: { id }, select: { accountId: true } }))?.accountId;
      
      if (testAccountId) {
        const testResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${testAccountId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!testResponse.ok) {
          const cfError: any = await testResponse.json();
          return res.status(400).json({
            success: false,
            error: cfError.errors?.[0]?.message || 'Invalid Cloudflare credentials',
          });
        }
      }

      updateData.apiToken = encrypt(apiToken);
    }

    const account = await prisma.cloudflareAccount.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { Domain: true },
        },
      },
    });

    logger.success(`Updated Cloudflare account: ${account.name}`);

    res.status(200).json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        apiToken: '••••••••', // Mask the token
        accountId: account.accountId,
        email: account.email,
        status: account.status,
        zonesCount: account._count.Domain,
        lastUsedAt: account.lastUsedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    logger.error('Update CF account error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update Cloudflare account',
    });
  }
});

/**
 * DELETE /api/admin/settings/cloudflare/accounts/:id
 * PERMANENTLY DELETE Cloudflare account with zone cleanup
 */
router.delete('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if account exists
    const account = await prisma.cloudflareAccount.findUnique({
      where: { id },
      include: {
        Domain: true,
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Cloudflare account not found',
      });
    }

    // Delete all Cloudflare zones for linked domains
    if (account.Domain && account.Domain.length > 0) {
      const apiToken = decrypt(account.apiToken);

      for (const domain of account.Domain) {
        if (domain.cloudflareZoneId) {
          try {
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
              logger.success(`CF zone deleted: ${domain.cloudflareZoneId} for ${domain.name}`);
            } else {
              const cfData: any = await cfResponse.json();
              logger.warn(`CF zone delete failed: ${cfData.errors?.[0]?.message || 'Unknown error'}`);
            }
          } catch (cfError: any) {
            logger.warn(`CF zone cleanup error for ${domain.name}: ${cfError.message}`);
          }
        }

        // Reset domain to pending_cf status
        await prisma.domain.update({
          where: { id: domain.id },
          data: {
            cloudflareAccountId: null,
            cloudflareZoneId: null,
            nameservers: null,
            turnstileSitekey: null,
            status: 'pending_cf',
            dnsStatus: 'pending',
            sslStatus: 'pending',
            updatedAt: new Date(),
          },
        });
      }
    }

    // PERMANENT DELETE from database
    await prisma.cloudflareAccount.delete({
      where: { id },
    });

    logger.info(`Deleted Cloudflare account: ${account.name} with ${account.Domain.length} zone(s) cleaned up`);

    res.status(200).json({
      success: true,
      message: 'Cloudflare account permanently deleted',
    });
  } catch (error: any) {
    logger.error('Delete CF account error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete Cloudflare account',
    });
  }
});

/**
 * POST /api/admin/settings/cloudflare/accounts/:id/test
 * Test Cloudflare account credentials
 */
router.post('/accounts/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.cloudflareAccount.findUnique({
      where: { id },
      select: { apiToken: true, accountId: true },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
      });
    }

    // Decrypt token
    const apiToken = decrypt(account.apiToken);

    // Test against Cloudflare API
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account.accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const cfError: any = await response.json();
      const errorMsg = cfError.errors?.[0]?.message || 'API request failed';
      
      // Update last error
      await prisma.cloudflareAccount.update({
        where: { id },
        data: { lastError: errorMsg, status: 'error' },
      });

      return res.status(400).json({
        success: false,
        valid: false,
        error: errorMsg,
      });
    }

    const data: any = await response.json();

    if (!data.success) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Cloudflare API returned success: false',
      });
    }

    // Update account status
    await prisma.cloudflareAccount.update({
      where: { id },
      data: { 
        status: 'active', 
        lastError: null,
      },
    });

    res.status(200).json({
      success: true,
      valid: true,
      accountName: data.result?.name || 'Unknown',
      accountId: data.result?.id || account.accountId,
    });
  } catch (error: any) {
    logger.error('Test CF account error:', error.message);
    res.status(500).json({
      success: false,
      valid: false,
      error: error.message || 'Failed to test Cloudflare account',
    });
  }
});

/**
 * GET /api/admin/settings/cloudflare/turnstile-widgets
 * Get all Turnstile widgets from domains
 */
router.get('/turnstile-widgets', async (req: Request, res: Response) => {
  try {
    const domains = await prisma.domain.findMany({
      where: {
        turnstileSitekey: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        turnstileSitekey: true,
        createdAt: true,
        CloudflareAccount: {
          select: {
            name: true,
            accountId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const widgets = domains.map((domain) => ({
      id: domain.id,
      domain: domain.name,
      siteKey: domain.turnstileSitekey,
      cloudflareAccount: domain.CloudflareAccount?.name || 'Unknown',
      cloudflareAccountId: domain.CloudflareAccount?.accountId || null,
      createdAt: domain.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      widgets,
      total: widgets.length,
    });
  } catch (error: any) {
    logger.error('Get Turnstile widgets error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Turnstile widgets',
    });
  }
});

export default router;
