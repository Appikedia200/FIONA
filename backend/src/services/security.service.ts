import prisma from '../config/database';
import { logger } from '../utils/logger.util';

export class SecurityService {
  /**
   * Check if IP is whitelisted
   */
  async isIpWhitelisted(ipAddress: string, campaignId?: string): Promise<boolean> {
    try {
      const where: any = {
        ipAddress,
        active: true,
      };

      if (campaignId) {
        where.OR = [
          { campaignId },
          { campaignId: null }, // Global whitelist
        ];
      } else {
        where.campaignId = null; // Only global whitelist
      }

      const whitelist = await prisma.iPWhitelist.findFirst({ where });
      return !!whitelist;
    } catch (error) {
      logger.error('Check IP whitelist error:', error);
      return false;
    }
  }

  /**
   * Check if IP is blacklisted
   */
  async isIpBlacklisted(ipAddress: string): Promise<boolean> {
    try {
      const blacklist = await prisma.iPBlacklist.findFirst({
        where: {
          ipAddress,
          active: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      return !!blacklist;
    } catch (error) {
      logger.error('Check IP blacklist error:', error);
      return false;
    }
  }

  /**
   * Add IP to whitelist
   */
  async addToWhitelist(data: {
    ipAddress: string;
    label: string;
    campaignId?: string;
    addedBy: string;
    cidr?: string;
  }) {
    try {
      const whitelist = await prisma.iPWhitelist.create({
        data: {
          ipAddress: data.ipAddress,
          cidr: data.cidr,
          label: data.label,
          campaignId: data.campaignId,
          addedBy: data.addedBy,
          active: true,
        },
      });

      logger.success(`IP added to whitelist: ${data.ipAddress} by ${data.addedBy}`);

      return {
        success: true,
        whitelist,
      };
    } catch (error: any) {
      logger.error('Add to whitelist error:', error.message);
      throw error;
    }
  }

  /**
   * Add IP to blacklist
   */
  async addToBlacklist(data: {
    ipAddress: string;
    reason: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    addedBy?: string;
    cidr?: string;
    autoBlocked?: boolean;
    expiresAt?: Date;
  }) {
    try {
      const blacklist = await prisma.iPBlacklist.create({
        data: {
          ipAddress: data.ipAddress,
          cidr: data.cidr,
          reason: data.reason,
          severity: data.severity || 'MEDIUM',
          autoBlocked: data.autoBlocked || false,
          addedBy: data.addedBy,
          active: true,
          expiresAt: data.expiresAt,
        },
      });

      logger.warn(`IP added to blacklist: ${data.ipAddress} - ${data.reason}`);

      return {
        success: true,
        blacklist,
      };
    } catch (error: any) {
      logger.error('Add to blacklist error:', error.message);
      throw error;
    }
  }

  /**
   * Remove IP from whitelist
   */
  async removeFromWhitelist(id: string) {
    try {
      await prisma.iPWhitelist.delete({
        where: { id },
      });

      logger.success(`IP removed from whitelist: ${id}`);

      return {
        success: true,
        message: 'IP removed from whitelist',
      };
    } catch (error: any) {
      logger.error('Remove from whitelist error:', error.message);
      throw error;
    }
  }

  /**
   * Remove IP from blacklist
   */
  async removeFromBlacklist(id: string) {
    try {
      await prisma.iPBlacklist.delete({
        where: { id },
      });

      logger.success(`IP removed from blacklist: ${id}`);

      return {
        success: true,
        message: 'IP removed from blacklist',
      };
    } catch (error: any) {
      logger.error('Remove from blacklist error:', error.message);
      throw error;
    }
  }

  /**
   * Get all whitelisted IPs
   */
  async getWhitelist(campaignId?: string) {
    try {
      const where: any = { active: true };

      if (campaignId) {
        where.OR = [
          { campaignId },
          { campaignId: null },
        ];
      }

      const whitelist = await prisma.iPWhitelist.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        whitelist,
        total: whitelist.length,
      };
    } catch (error: any) {
      logger.error('Get whitelist error:', error.message);
      throw error;
    }
  }

  /**
   * Get all blacklisted IPs
   */
  async getBlacklist() {
    try {
      const blacklist = await prisma.iPBlacklist.findMany({
        where: {
          active: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        blacklist,
        total: blacklist.length,
      };
    } catch (error: any) {
      logger.error('Get blacklist error:', error.message);
      throw error;
    }
  }

  /**
   * Log threat
   */
  async logThreat(data: {
    ipAddress: string;
    campaignId: string;
    threatType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details?: string;
    userAgent?: string;
    action: string;
  }) {
    try {
      const threat = await prisma.threatLog.create({
        data,
      });

      logger.warn(`Threat logged: ${data.threatType} from ${data.ipAddress} (${data.severity})`);

      // Auto-block high/critical threats
      if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
        await this.addToBlacklist({
          ipAddress: data.ipAddress,
          reason: `Auto-blocked: ${data.threatType}`,
          severity: data.severity,
          autoBlocked: true,
        });
      }

      return {
        success: true,
        threat,
      };
    } catch (error: any) {
      logger.error('Log threat error:', error.message);
      throw error;
    }
  }

  /**
   * Get threat logs
   */
  async getThreatLogs(filters?: {
    campaignId?: string;
    severity?: string;
    limit?: number;
  }) {
    try {
      const where: any = {};

      if (filters?.campaignId) {
        where.campaignId = filters.campaignId;
      }

      if (filters?.severity) {
        where.severity = filters.severity;
      }

      const threats = await prisma.threatLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters?.limit || 100,
      });

      return {
        success: true,
        threats,
        total: threats.length,
      };
    } catch (error: any) {
      logger.error('Get threat logs error:', error.message);
      throw error;
    }
  }

  /**
   * Check IP and enforce security
   */
  async checkIpSecurity(ipAddress: string, campaignId: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    try {
      // Check blacklist first
      const isBlacklisted = await this.isIpBlacklisted(ipAddress);
      if (isBlacklisted) {
        await this.logThreat({
          ipAddress,
          campaignId,
          threatType: 'BLACKLISTED_IP',
          severity: 'HIGH',
          action: 'BLOCKED',
          details: 'IP is on blacklist',
        });

        return {
          allowed: false,
          reason: 'IP is blacklisted',
        };
      }

      // Check if campaign has IP Shield enabled
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (campaign?.ipShieldEnabled) {
        const isWhitelisted = await this.isIpWhitelisted(ipAddress, campaignId);
        
        if (!isWhitelisted) {
          await this.logThreat({
            ipAddress,
            campaignId,
            threatType: 'NOT_WHITELISTED',
            severity: 'MEDIUM',
            action: 'BLOCKED',
            details: 'IP not on whitelist',
          });

          return {
            allowed: false,
            reason: 'IP not whitelisted',
          };
        }
      }

      return {
        allowed: true,
      };
    } catch (error: any) {
      logger.error('Check IP security error:', error.message);
      return {
        allowed: false,
        reason: 'Security check failed',
      };
    }
  }
}

export default new SecurityService();
