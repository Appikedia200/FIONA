import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.util';

export class CloudflareClient {
  private client: AxiosInstance;
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;

    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Get account details
   */
  async getAccount() {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare get account error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to get account');
    }
  }

  /**
   * List zones
   */
  async listZones() {
    try {
      const response = await this.client.get('/zones', {
        params: {
          account: { id: this.accountId },
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare list zones error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to list zones');
    }
  }

  /**
   * Create zone
   */
  async createZone(domain: string) {
    try {
      const response = await this.client.post('/zones', {
        name: domain,
        account: { id: this.accountId },
        jump_start: true, // Auto-scan existing DNS records
      });
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare create zone error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to create zone');
    }
  }

  /**
   * Get zone
   */
  async getZone(zoneId: string) {
    try {
      const response = await this.client.get(`/zones/${zoneId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare get zone error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to get zone');
    }
  }

  /**
   * Delete zone
   */
  async deleteZone(zoneId: string) {
    try {
      const response = await this.client.delete(`/zones/${zoneId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare delete zone error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to delete zone');
    }
  }

  /**
   * List DNS records
   */
  async listDnsRecords(zoneId: string) {
    try {
      const response = await this.client.get(`/zones/${zoneId}/dns_records`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare list DNS records error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to list DNS records');
    }
  }

  /**
   * Create DNS record
   */
  async createDnsRecord(zoneId: string, record: {
    type: string;
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  }) {
    try {
      const response = await this.client.post(`/zones/${zoneId}/dns_records`, {
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 1, // 1 = Auto
        proxied: record.proxied !== undefined ? record.proxied : true,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare create DNS record error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to create DNS record');
    }
  }

  /**
   * Update DNS record
   */
  async updateDnsRecord(zoneId: string, recordId: string, record: {
    type?: string;
    name?: string;
    content?: string;
    ttl?: number;
    proxied?: boolean;
  }) {
    try {
      const response = await this.client.patch(
        `/zones/${zoneId}/dns_records/${recordId}`,
        record
      );
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare update DNS record error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to update DNS record');
    }
  }

  /**
   * Delete DNS record
   */
  async deleteDnsRecord(zoneId: string, recordId: string) {
    try {
      const response = await this.client.delete(`/zones/${zoneId}/dns_records/${recordId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare delete DNS record error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to delete DNS record');
    }
  }

  /**
   * List workers
   */
  async listWorkers() {
    try {
      const response = await this.client.get(`/accounts/${this.accountId}/workers/scripts`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare list workers error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to list workers');
    }
  }

  /**
   * Deploy worker
   */
  async deployWorker(scriptName: string, scriptContent: string) {
    try {
      const response = await this.client.put(
        `/accounts/${this.accountId}/workers/scripts/${scriptName}`,
        scriptContent,
        {
          headers: {
            'Content-Type': 'application/javascript',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare deploy worker error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to deploy worker');
    }
  }

  /**
   * Deploy worker script
   * @param accountId Cloudflare account ID
   * @param scriptContent Worker script content (BACKEND_URL already replaced)
   * @param workerName Optional - if provided, updates existing worker; if not, CF assigns UUID
   * @returns { workerName: string } - CF-assigned or provided worker name
   */
  async deployWorkerScript(
    accountId: string,
    scriptContent: string,
    workerName?: string
  ): Promise<{ workerName: string }> {
    try {
      const crypto = await import('crypto');
      const name = workerName || crypto.randomUUID();

      // Dynamically import form-data
      const FormData = (await import('form-data')).default;
      const form = new FormData();

      // Metadata part - no env bindings (Worker fetches config from backend)
      const metadata = {
        main_module: 'worker.js',
        bindings: [],
        compatibility_date: '2024-09-23',
      };

      form.append('metadata', JSON.stringify(metadata), {
        contentType: 'application/json',
      });

      // Worker script part
      form.append('worker.js', scriptContent, {
        contentType: 'application/javascript+module',
        filename: 'worker.js',
      });

      // Upload using multipart/form-data
      const response = await this.client.put(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${name}`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            ...form.getHeaders(),
          },
        }
      );

      logger.success(`Worker deployed: ${name}`);
      return { workerName: name };
    } catch (error: any) {
      logger.error('Cloudflare deploy worker script error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to deploy worker script');
    }
  }

  /**
   * Attach a domain as a Custom Domain to a worker
   * @returns { id: string } - Custom Domain ID (save as cfCustomDomainId)
   */
  async attachWorkerDomain(params: {
    accountId: string;
    workerName: string;
    hostname: string;
    zoneId: string;
    zoneName: string;
  }): Promise<{ id: string }> {
    try {
      const response = await this.client.put(
        `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/workers/domains`,
        {
          service: params.workerName,
          environment: 'production',
          hostname: params.hostname,
          zone_id: params.zoneId,
          zone_name: params.zoneName,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to attach custom domain');
      }

      logger.success(`Custom Domain attached: ${params.hostname} → ${params.workerName}`);
      return { id: response.data.result.id };
    } catch (error: any) {
      logger.error('Cloudflare attach worker domain error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to attach worker domain');
    }
  }

  /**
   * Detach a Custom Domain from a worker
   */
  async detachWorkerDomain(params: {
    accountId: string;
    domainId: string;
  }): Promise<void> {
    try {
      const response = await this.client.delete(
        `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/workers/domains/${params.domainId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to detach custom domain');
      }

      logger.success(`Custom Domain detached: ${params.domainId}`);
    } catch (error: any) {
      logger.error('Cloudflare detach worker domain error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to detach worker domain');
    }
  }

  /**
   * Create Turnstile widget
   * @returns { sitekey, secret } - Turnstile keys
   */
  async createTurnstileWidget(params: {
    accountId: string;
    name: string;
    domains: string[];
    mode?: 'managed' | 'non-interactive' | 'invisible';
  }): Promise<{ sitekey: string; secret: string }> {
    try {
      const response = await this.client.post(
        `https://api.cloudflare.com/client/v4/accounts/${params.accountId}/challenges/widgets`,
        {
          name: params.name,
          domains: params.domains,
          mode: params.mode || 'managed',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to create Turnstile widget');
      }

      logger.success(`Turnstile widget created: ${params.name}`);
      return {
        sitekey: response.data.result.sitekey,
        secret: response.data.result.secret,
      };
    } catch (error: any) {
      logger.error('Cloudflare create Turnstile widget error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to create Turnstile widget');
    }
  }

  /**
   * Delete worker
   */
  async deleteWorker(scriptName: string) {
    try {
      const response = await this.client.delete(
        `/accounts/${this.accountId}/workers/scripts/${scriptName}`
      );
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare delete worker error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to delete worker');
    }
  }

  /**
   * Create worker route
   */
  async createWorkerRoute(zoneId: string, pattern: string, scriptName: string) {
    try {
      const response = await this.client.post(`/zones/${zoneId}/workers/routes`, {
        pattern,
        script: scriptName,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare create worker route error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to create worker route');
    }
  }

  /**
   * List worker routes
   */
  async listWorkerRoutes(zoneId: string) {
    try {
      const response = await this.client.get(`/zones/${zoneId}/workers/routes`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare list worker routes error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to list worker routes');
    }
  }

  /**
   * Delete worker route
   */
  async deleteWorkerRoute(zoneId: string, routeId: string) {
    try {
      const response = await this.client.delete(`/zones/${zoneId}/workers/routes/${routeId}`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare delete worker route error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to delete worker route');
    }
  }

  /**
   * Get SSL verification status
   */
  async getSslStatus(zoneId: string) {
    try {
      const response = await this.client.get(`/zones/${zoneId}/ssl/verification`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare get SSL status error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to get SSL status');
    }
  }

  /**
   * Get zone settings
   */
  async getZoneSettings(zoneId: string) {
    try {
      const response = await this.client.get(`/zones/${zoneId}/settings`);
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare get zone settings error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to get zone settings');
    }
  }

  /**
   * Update SSL mode
   */
  async updateSslMode(zoneId: string, mode: 'off' | 'flexible' | 'full' | 'strict') {
    try {
      const response = await this.client.patch(`/zones/${zoneId}/settings/ssl`, {
        value: mode,
      });
      return response.data;
    } catch (error: any) {
      logger.error('Cloudflare update SSL mode error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.message || 'Failed to update SSL mode');
    }
  }
}

/**
 * Create Cloudflare client from account
 */
export const createCloudflareClient = (apiToken: string, accountId: string): CloudflareClient => {
  return new CloudflareClient(apiToken, accountId);
};
