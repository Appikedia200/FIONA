import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { logger } from '../../utils/logger.util';
import axios from 'axios';

const router = Router();

/**
 * GET /api/domain/config?hostname=example.com
 * Unauthenticated - called by Worker at request time to fetch Turnstile config
 * Returns { turnstileSiteKey } for the domain
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const hostname = req.query.hostname as string;

    if (!hostname) {
      return res.status(400).json({
        success: false,
        error: 'hostname query parameter required',
      });
    }

    // Look up domain or subdomain
    // First check if it's a root domain
    let domain = await prisma.domain.findFirst({
      where: { name: hostname },
      select: {
        turnstileSitekey: true,
      },
    });

    // If not found, check if it's a subdomain (extract root)
    if (!domain) {
      const parts = hostname.split('.');
      if (parts.length > 2) {
        // It's a subdomain - get root domain (last two parts)
        const rootDomain = parts.slice(-2).join('.');
        domain = await prisma.domain.findFirst({
          where: { name: rootDomain },
          select: {
            turnstileSitekey: true,
          },
        });
      }
    }

    // Return empty string if domain not found - worker can still render page
    return res.status(200).json({
      success: true,
      turnstileSiteKey: domain?.turnstileSitekey || '',
    });
  } catch (error: any) {
    logger.error('Get domain config error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/turnstile/verify
 * Unauthenticated - called by Worker after user completes Turnstile challenge
 * Verifies token with Cloudflare using domain's turnstileSecretKey from DB
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token, ip, hostname } = req.body;

    // Look up domain to get turnstileSecretKey
    let domain = null;

    if (hostname) {
      // Try exact match first
      domain = await prisma.domain.findFirst({
        where: { name: hostname },
        select: {
          turnstileSecretKey: true,
        },
      });

      // If not found, try extracting root domain from subdomain
      if (!domain) {
        const parts = hostname.split('.');
        if (parts.length > 2) {
          const rootDomain = parts.slice(-2).join('.');
          domain = await prisma.domain.findFirst({
            where: { name: rootDomain },
            select: {
              turnstileSecretKey: true,
            },
          });
        }
      }
    }

    // Fallback to global secret from env if domain not found
    const secret = domain?.turnstileSecretKey || process.env.TURNSTILE_SECRET_KEY;

    // If no secret configured and no token provided, bypass verification
    if (!secret && (!token || token === '')) {
      return res.status(200).json({
        success: true,
        errors: [],
      });
    }

    // If secret exists but no token, reject
    if (!token || token === '') {
      return res.status(400).json({
        success: false,
        errors: ['token is required'],
      });
    }

    // If no secret but token provided, reject
    if (!secret) {
      return res.status(400).json({
        success: false,
        errors: ['Turnstile secret not configured'],
      });
    }

    // Call Cloudflare siteverify API
    const verifyResponse = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        secret,
        response: token,
        remoteip: ip,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = verifyResponse.data;

    return res.status(200).json({
      success: result.success || false,
      errors: result['error-codes'] || [],
    });
  } catch (error: any) {
    logger.error('Turnstile verify error:', error.message);
    return res.status(500).json({
      success: false,
      errors: ['Verification failed'],
    });
  }
});

export default router;
