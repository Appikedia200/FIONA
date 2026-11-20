import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token') ?? localStorage.getItem('fiona_token') ?? null
}

const axiosInstance = axios.create({ baseURL: API_URL })

axiosInstance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axiosInstance.interceptors.response.use(
  (res) => res,
  (error) => {
    console.error(`[FIONA API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status}`, error.response?.data)
    return Promise.reject(error)
  }
)

export const fetcher = async (url: string) => {
  const token = getToken()
  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// API Client class wrapper
class ApiClient {
  private client = axiosInstance

  // Auth endpoints
  async register(data: { email: string; fullName: string; password: string }) {
    return this.client.post('/api/auth/register', data);
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post('/api/auth/login', data);
    if (response.data.success && response.data.token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }
    return response;
  }

  async logout() {
    const response = await this.client.post('/api/auth/logout');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('fiona_token');
      localStorage.removeItem('user');
    }
    return response;
  }

  async getProfile() {
    return this.client.get('/api/auth/profile');
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.client.post('/api/auth/change-password', data);
  }

  async generateApiKey() {
    return this.client.post('/api/auth/api-key');
  }

  // Campaign endpoints (Technician)
  async getCampaigns() {
    return this.client.get('/api/campaigns');
  }

  async getCampaign(id: string) {
    return this.client.get(`/api/campaigns/${id}`);
  }

  async createCampaign(data: {
    name: string;
    provider: string;
    description?: string;
    targetUrl?: string;
    domainId?: string;
    profileId?: string;
  }) {
    return this.client.post('/api/campaigns', data);
  }

  async updateCampaign(id: string, data: any) {
    return this.client.put(`/api/campaigns/${id}`, data);
  }

  async deleteCampaign(id: string) {
    return this.client.delete(`/api/campaigns/${id}`);
  }

  async toggleCampaignStatus(id: string, status: 'ACTIVE' | 'PAUSED') {
    return this.client.post(`/api/campaigns/${id}/toggle-status`, { status });
  }

  // Deployment endpoints (Technician)
  async getDeployments() {
    return this.client.get('/api/deployments');
  }

  async getDeployment(id: string) {
    return this.client.get(`/api/deployments/${id}`);
  }

  async deployDomain(data: {
    campaignId: string;
    domain: string;
    subdomain?: string;
    isCustomDomain: boolean;
  }) {
    return this.client.post('/api/deployments', data);
  }

  async deleteDeployment(id: string) {
    return this.client.delete(`/api/deployments/${id}`);
  }

  // Session endpoints (Technician)
  async getSessions(filters?: any) {
    return this.client.get('/api/sessions', { params: filters });
  }

  async getSession(id: string) {
    return this.client.get(`/api/sessions/${id}`);
  }

  async getSessionFields(id: string) {
    return this.client.get(`/api/sessions/${id}/fields`);
  }

  // Profile endpoints (Technician)
  async getProfiles(filters?: any) {
    return this.client.get('/api/profiles', { params: filters });
  }

  async getProfileById(id: string) {
    return this.client.get(`/api/profiles/${id}`);
  }

  async launchProfile(id: string) {
    return this.client.post(`/api/profiles/${id}/launch`);
  }

  async closeProfile(id: string) {
    return this.client.post(`/api/profiles/${id}/close`);
  }

  async getProfilePasswords(id: string) {
    return this.client.get(`/api/profiles/${id}/passwords`);
  }

  // Analytics endpoints (Technician)
  async getAnalyticsSummary() {
    return this.client.get('/api/analytics/summary');
  }

  async getCampaignAnalytics(campaignId: string) {
    return this.client.get(`/api/analytics/campaigns/${campaignId}`);
  }

  // Admin endpoints
  async getTechnicians(filters?: any) {
    return this.client.get('/api/admin/technicians', { params: filters });
  }

  async getTechnician(id: string) {
    return this.client.get(`/api/admin/technicians/${id}`);
  }

  async getPendingTechniciansCount() {
    return this.client.get('/api/admin/technicians/pending');
  }

  async approveTechnician(id: string) {
    return this.client.post(`/api/admin/technicians/${id}/approve`);
  }

  async suspendTechnician(id: string) {
    return this.client.post(`/api/admin/technicians/${id}/suspend`);
  }

  async reactivateTechnician(id: string) {
    return this.client.post(`/api/admin/technicians/${id}/reactivate`);
  }

  async deleteTechnician(id: string) {
    return this.client.delete(`/api/admin/technicians/${id}`);
  }

  async getAdminSessions(filters?: any) {
    return this.client.get('/api/admin/sessions', { params: filters });
  }

  async getAdminProfiles(filters?: any) {
    return this.client.get('/api/admin/profiles', { params: filters });
  }

  async getAdminAnalyticsSummary() {
    return this.client.get('/api/admin/analytics/summary');
  }

  async getAdminResourceStats() {
    return this.client.get('/api/admin/resources');
  }

  // Generic HTTP methods for custom endpoints
  async get(url: string, config?: any) {
    return this.client.get(url, config);
  }

  async post(url: string, data?: any, config?: any) {
    return this.client.post(url, data, config);
  }

  async put(url: string, data?: any, config?: any) {
    return this.client.put(url, data, config);
  }

  async patch(url: string, data?: any, config?: any) {
    return this.client.patch(url, data, config);
  }

  async delete(url: string, config?: any) {
    return this.client.delete(url, config);
  }

  // Expose axios instance for special cases
  getAxios() {
    return this.client;
  }
}

// Export single instance
const apiClient = new ApiClient();
export { apiClient };
export default apiClient;
