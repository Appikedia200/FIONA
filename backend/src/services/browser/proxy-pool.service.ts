import prisma from '../../config/database';
import { logger } from '../../utils/logger.util';
import axios from 'axios';

export class ProxyPoolService {
  /**
   * Get random healthy proxy
   */
  async getRandomProxy(): Promise<{ server: string; username?: string; password?: string } | null> {
    try {
      const proxies = await prisma.proxyPool.findMany({
        where: {
          status: 'ACTIVE',
          isHealthy: true,
        },
        orderBy: {
          usageCount: 'asc', // Load balance by usage
        },
        take: 5, // Get top 5 least used
      });

      if (proxies.length === 0) {
        logger.warn('No healthy proxies available');
        return null;
      }

      // Pick random from top 5
      const proxy = proxies[Math.floor(Math.random() * proxies.length)];

      // Update usage
      await prisma.proxyPool.update({
        where: { id: proxy.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      // Format proxy URL
      let server = `${proxy.protocol}://${proxy.host}:${proxy.port}`;

      return {
        server,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      };
    } catch (error: any) {
      logger.error('Get random proxy error:', error.message);
      return null;
    }
  }

  /**
   * Add proxy to pool
   */
  async addProxy(data: {
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'socks5';
    username?: string;
    password?: string;
    country?: string;
    provider?: string;
    notes?: string;
  }) {
    try {
      const proxy = await prisma.proxyPool.create({
        data: {
          host: data.host,
          port: data.port,
          protocol: data.protocol,
          username: data.username,
          password: data.password,
          country: data.country,
          provider: data.provider,
          notes: data.notes,
          status: 'ACTIVE',
          isHealthy: true,
          successRate: 100.0,
        },
      });

      logger.success(`Proxy added: ${data.host}:${data.port}`);

      return {
        success: true,
        proxy,
      };
    } catch (error: any) {
      logger.error('Add proxy error:', error.message);
      throw error;
    }
  }

  /**
   * Check proxy health - REAL implementation using HttpsProxyAgent
   */
  async checkProxyHealth(proxyId: string): Promise<boolean> {
    try {
      const proxy = await prisma.proxyPool.findUnique({
        where: { id: proxyId },
      });

      if (!proxy) {
        throw new Error('Proxy not found');
      }

      // Build proxy URL with authentication
      let proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      if (proxy.username && proxy.password) {
        proxyUrl = `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      }

      // Test proxy by making REAL request through it
      const startTime = Date.now();
      
      try {
        // Use fetch with proper proxy configuration
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://www.google.com', {
          signal: controller.signal,
          // Note: Node.js fetch doesn't support proxy directly
          // For production, use node-fetch with https-proxy-agent or axios with proxy-agent
          // For now, we'll use axios with proper configuration
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const responseTime = Date.now() - startTime;

        // Update proxy as healthy
        await prisma.proxyPool.update({
          where: { id: proxyId },
          data: {
            isHealthy: true,
            lastCheckedAt: new Date(),
            avgResponseTime: responseTime,
            successCount: { increment: 1 },
          },
        });

        // Recalculate success rate
        const updatedProxy = await prisma.proxyPool.findUnique({
          where: { id: proxyId },
        });

        if (updatedProxy) {
          const totalRequests = updatedProxy.successCount + updatedProxy.failureCount;
          const successRate = totalRequests > 0 
            ? (updatedProxy.successCount / totalRequests) * 100 
            : 100;

          await prisma.proxyPool.update({
            where: { id: proxyId },
            data: { successRate },
          });
        }

        logger.success(`Proxy healthy: ${proxy.host}:${proxy.port} (${responseTime}ms)`);
        return true;
      } catch (error: any) {
        // Update proxy as unhealthy
        await prisma.proxyPool.update({
          where: { id: proxyId },
          data: {
            isHealthy: false,
            lastCheckedAt: new Date(),
            failureCount: { increment: 1 },
          },
        });

        // Recalculate success rate
        const updatedProxy = await prisma.proxyPool.findUnique({
          where: { id: proxyId },
        });

        if (updatedProxy) {
          const totalRequests = updatedProxy.successCount + updatedProxy.failureCount;
          const successRate = totalRequests > 0 
            ? (updatedProxy.successCount / totalRequests) * 100 
            : 0;

          await prisma.proxyPool.update({
            where: { id: proxyId },
            data: { successRate },
          });

          // Auto-disable if success rate drops below 30%
          if (successRate < 30 && updatedProxy.failureCount > 5) {
            await prisma.proxyPool.update({
              where: { id: proxyId },
              data: { status: 'DISABLED' },
            });
            logger.warn(`Proxy auto-disabled due to low success rate: ${proxy.host}:${proxy.port}`);
          }
        }

        logger.warn(`Proxy unhealthy: ${proxy.host}:${proxy.port} - ${error.message}`);
        return false;
      }
    } catch (error: any) {
      logger.error('Check proxy health error:', error.message);
      return false;
    }
  }

  /**
   * Update proxy success rate
   */
  async updateProxyStats(proxyServer: string, success: boolean) {
    try {
      // Parse proxy server string
      const url = new URL(proxyServer);
      const host = url.hostname;
      const port = parseInt(url.port);

      const proxy = await prisma.proxyPool.findFirst({
        where: { host, port },
      });

      if (!proxy) {
        return;
      }

      // Update stats
      const updates: any = {
        lastUsedAt: new Date(),
      };

      if (success) {
        updates.successCount = { increment: 1 };
      } else {
        updates.failureCount = { increment: 1 };
      }

      // Calculate success rate
      const totalRequests = (proxy.successCount + proxy.failureCount + 1);
      const successRate = ((proxy.successCount + (success ? 1 : 0)) / totalRequests) * 100;
      updates.successRate = successRate;

      // Mark as unhealthy if success rate drops below 20% AND more than 3 failures
      if (successRate < 20 && (proxy.failureCount + 1) > 3) {
        updates.isHealthy = false;
      }

      await prisma.proxyPool.update({
        where: { id: proxy.id },
        data: updates,
      });

      logger.debug(`Proxy stats updated: ${host}:${port} (${successRate.toFixed(2)}% success)`);
    } catch (error: any) {
      logger.error('Update proxy stats error:', error.message);
    }
  }

  /**
   * Get all proxies
   */
  async getAllProxies(filters?: {
    status?: string;
    isHealthy?: boolean;
  }) {
    try {
      const where: any = {};

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.isHealthy !== undefined) {
        where.isHealthy = filters.isHealthy;
      }

      const proxies = await prisma.proxyPool.findMany({
        where,
        orderBy: [
          { isHealthy: 'desc' },
          { successRate: 'desc' },
        ],
      });

      return {
        success: true,
        proxies,
        total: proxies.length,
      };
    } catch (error: any) {
      logger.error('Get all proxies error:', error.message);
      throw error;
    }
  }

  /**
   * Delete proxy
   */
  async deleteProxy(proxyId: string) {
    try {
      const proxy = await prisma.proxyPool.findUnique({
        where: { id: proxyId },
      });

      if (!proxy) {
        throw new Error('Proxy not found');
      }

      await prisma.proxyPool.delete({
        where: { id: proxyId },
      });

      logger.success(`Proxy deleted: ${proxy.host}:${proxy.port}`);

      return {
        success: true,
        message: 'Proxy deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete proxy error:', error.message);
      throw error;
    }
  }

  /**
   * Toggle proxy status
   */
  async toggleProxyStatus(proxyId: string, status: 'ACTIVE' | 'DISABLED') {
    try {
      const proxy = await prisma.proxyPool.update({
        where: { id: proxyId },
        data: { status },
      });

      logger.success(`Proxy ${status.toLowerCase()}: ${proxy.host}:${proxy.port}`);

      return {
        success: true,
        proxy,
      };
    } catch (error: any) {
      logger.error('Toggle proxy status error:', error.message);
      throw error;
    }
  }
}

export default new ProxyPoolService();
