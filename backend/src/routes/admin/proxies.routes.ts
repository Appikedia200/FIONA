import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/rbac.middleware';
import { logger } from '../../utils/logger.util';
import axios from 'axios';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/proxies
 * Get all proxies from ProxyPool
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const proxies = await prisma.proxyPool.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        host: true,
        port: true,
        protocol: true,
        country: true,
        status: true,
        isHealthy: true,
        successRate: true,
        usageCount: true,
        createdAt: true,
        lastUsedAt: true,
        lastCheckedAt: true,
      },
    });

    const proxiesFormatted = proxies.map((proxy) => ({
      id: proxy.id,
      ipAddress: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol.toUpperCase(),
      country: proxy.country || 'Unknown',
      status: proxy.isHealthy ? 'live' : 'dead',
      uptime: proxy.successRate,
      activeSessions: proxy.usageCount,
      lastChecked: proxy.lastCheckedAt?.toISOString(),
    }));

    res.status(200).json({
      success: true,
      proxies: proxiesFormatted,
    });
  } catch (error: any) {
    logger.error('Get proxies error:', error.message);
    res.status(200).json({
      success: true,
      proxies: [],
    });
  }
});

/**
 * POST /api/admin/proxies
 * Add a new proxy to the pool
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { proxyUrl, host, port, protocol, country, username, password, url, location, label } = req.body;

    let parsedHost: string;
    let parsedPort: number;
    let parsedProtocol: string;
    let parsedUsername: string | undefined;
    let parsedPassword: string | undefined;

    // Accept either proxyUrl or individual fields
    if (proxyUrl || url) {
      // Parse from URL
      const urlToParse = proxyUrl || url;
      const parsedUrl = new URL(urlToParse);
      parsedHost = parsedUrl.hostname.replace(/\s*\(.*?\)\s*$/g, '').trim();
      parsedPort = parseInt(parsedUrl.port) || 8080;
      parsedProtocol = parsedUrl.protocol.replace(':', '');
      parsedUsername = parsedUrl.username || undefined;
      parsedPassword = parsedUrl.password || undefined;
    } else if (host && port && protocol) {
      // Use individual fields - strip parenthetical text from host
      parsedHost = host.toString().replace(/\s*\(.*?\)\s*$/g, '').trim();
      parsedPort = parseInt(port.toString());
      parsedProtocol = protocol.toLowerCase().replace(':', '');
      parsedUsername = username;
      parsedPassword = password;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either proxyUrl or host+port+protocol are required',
      });
    }

    const proxy = await prisma.proxyPool.create({
      data: {
        host: parsedHost,
        port: parsedPort,
        protocol: parsedProtocol,
        username: parsedUsername,
        password: parsedPassword,
        country: country || location || null,
        provider: label || null,
        status: 'ACTIVE',
        isHealthy: true,
        lastCheckedAt: new Date(),
      },
    });

    logger.success(`Added proxy: ${parsedHost}:${parsedPort}`);

    res.status(201).json({
      success: true,
      message: 'Proxy added successfully',
      proxy: {
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        country: proxy.country,
        status: proxy.status,
      },
    });
  } catch (error: any) {
    logger.error('Add proxy error:', error.message);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to add proxy',
    });
  }
});

/**
 * POST /api/admin/proxies/:id/check
 * Health check a specific proxy
 */
router.post('/:id/check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const proxy = await prisma.proxyPool.findUnique({
      where: { id },
    });

    if (!proxy) {
      return res.status(404).json({
        success: false,
        message: 'Proxy not found',
      });
    }

    // Build proxy URL
    let proxyUrl = `${proxy.protocol}://`;
    if (proxy.username && proxy.password) {
      proxyUrl += `${proxy.username}:${proxy.password}@`;
    }
    proxyUrl += `${proxy.host}:${proxy.port}`;

    // Test proxy with a simple HTTP request
    const startTime = Date.now();
    let isHealthy = false;
    let responseTime = 0;

    try {
      await axios.get('https://httpbin.org/ip', {
        proxy: {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port,
          auth: proxy.username && proxy.password ? {
            username: proxy.username,
            password: proxy.password,
          } : undefined,
        },
        timeout: 10000,
      });
      
      isHealthy = true;
      responseTime = Date.now() - startTime;
    } catch (error) {
      isHealthy = false;
    }

    // Update proxy health status
    const updatedProxy = await prisma.proxyPool.update({
      where: { id },
      data: {
        isHealthy,
        lastCheckedAt: new Date(),
        avgResponseTime: responseTime,
        successCount: isHealthy ? { increment: 1 } : undefined,
        failureCount: !isHealthy ? { increment: 1 } : undefined,
      },
    });

    // Recalculate success rate
    const totalChecks = updatedProxy.successCount + updatedProxy.failureCount;
    const successRate = totalChecks > 0 ? (updatedProxy.successCount / totalChecks) * 100 : 100;

    await prisma.proxyPool.update({
      where: { id },
      data: { successRate },
    });

    res.status(200).json({
      success: true,
      healthy: isHealthy,
      responseTime,
      message: isHealthy ? 'Proxy is healthy' : 'Proxy is unreachable',
    });
  } catch (error: any) {
    logger.error('Check proxy error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to check proxy',
    });
  }
});

/**
 * PATCH /api/admin/proxies/:id
 * Toggle proxy enabled status
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const proxy = await prisma.proxyPool.update({
      where: { id },
      data: {
        status: enabled ? 'ACTIVE' : 'INACTIVE',
      },
    });

    res.status(200).json({
      success: true,
      message: enabled ? 'Proxy enabled' : 'Proxy disabled',
      proxy,
    });
  } catch (error: any) {
    logger.error('Update proxy error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update proxy',
    });
  }
});

/**
 * DELETE /api/admin/proxies/:id
 * Remove a proxy from the pool
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.proxyPool.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Proxy deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete proxy error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete proxy',
    });
  }
});

export default router;
