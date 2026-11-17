const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  // Auth response fields
  token?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== "undefined") {
      // Check for regular token first, then admin token
      this.token = localStorage.getItem("fiona_token") || localStorage.getItem("fiona_admin_token");
    }
  }

  getToken(): string | null {
    if (typeof window !== "undefined" && !this.token) {
      // Refresh token if it was cleared
      this.token = localStorage.getItem("fiona_token") || localStorage.getItem("fiona_admin_token");
    }
    return this.token;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("fiona_token", token);
      } else {
        localStorage.removeItem("fiona_token");
      }
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("fiona_token");
      localStorage.removeItem("fiona_user");
    }
  }

  private getAuthHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };
  }

  // PROFESSIONAL: Parse JSON with fallback for non-JSON responses
  private async parseResponse(response: Response): Promise<ApiResponse> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      // Server returned non-JSON (plain text error, HTML, etc)
      return {
        success: false,
        error: response.status === 423
          ? text
          : response.status === 429
          ? "Too many attempts. Please wait."
          : response.status >= 500
          ? "Server error. Please try again."
          : text || "An error occurred",
      };
    }
  }

  async login(email: string, password: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async register(email: string, password: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async verifyToken(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/verify`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getDomains(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async addDomain(data: { domain: string; subdomain?: string }): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/register`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async checkDomainStatus(domainId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}/status`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async deleteDomain(domainId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async generateCaptureLink(provider: string, domainId?: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/captures/generate`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ provider, domainId }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getCaptures(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/captures`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getSessions(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async refreshSession(sessionId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/refresh`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async deleteSession(sessionId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async verifySession(sessionId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/verify`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async openSession(sessionId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/open`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async exportCookies(sessionId: string, format: "json" | "netscape"): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/export?format=${format}`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async deleteCapture(captureId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/captures/${captureId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getProfiles(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/profiles`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getMetrics(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analytics/metrics`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getRecentActivity(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analytics/recent`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getProviders(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/providers`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  // Admin endpoints
  async getAdminStats(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/stats`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getCloudflareAccounts(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/cloudflare/accounts`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async addCloudflareAccount(data: any): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/cloudflare/accounts`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async deleteCloudflareAccount(accountId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/cloudflare/accounts/${accountId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getAllDomains(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/domains`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getAllUsers(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/users`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async createTechnician(data: { email: string; password: string; name: string }): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/users/create`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async deleteTechnician(userId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getAdminSessions(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/admin/sessions`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async verifyDomain(domainId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}/verify`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async refreshNameservers(domainId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}/nameservers`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  // IP Management endpoints
  async getIPThreats(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/threats`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getIPBlacklist(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/blacklist`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async getIPWhitelist(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/whitelist`, {
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async addToBlacklist(ipAddress: string, reason: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/blacklist`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ipAddress, reason }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async bulkAddToBlacklist(ips: string[]): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/blacklist/bulk`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ips }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async addToWhitelist(ipAddress: string, reason: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/whitelist`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ ipAddress, reason }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async removeFromBlacklist(ipAddress: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ip-management/blacklist/${encodeURIComponent(ipAddress)}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async updateDomainTurnstile(domainId: string, siteKey: string, secretKey: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}/turnstile`, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ turnstileSiteKey: siteKey, turnstileSecretKey: secretKey }),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }

  async autoAssignDomainTurnstile(domainId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/domains/${domainId}/assign-turnstile`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      return this.parseResponse(response);
    } catch (err) {
      return { success: false, error: "Network error" };
    }
  }
}

export const apiClient = new ApiClient();
