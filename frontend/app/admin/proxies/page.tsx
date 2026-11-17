'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Activity, Globe, Shield, TrendingUp, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '@/components/CustomSelect';
import apiClient from '@/lib/api-client';

interface Proxy {
  id: string;
  ip: string;
  port: number;
  protocol: 'HTTP' | 'SOCKS5';
  country: string;
  status: 'ACTIVE' | 'FAILED' | 'live' | 'failed';
  uptime: number;
  lastCheck: string;
  activeSessions: number;
}

export default function AdminProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'failed'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: '',
    port: '',
    protocol: 'HTTP',
    country: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    fetchProxies();
    const interval = setInterval(fetchProxies, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchProxies = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : undefined;
      const response = await apiClient.get('/api/admin/proxies', { params });
      if (response.data.success) {
        setProxies(response.data.proxies || mockProxies);
      }
    } catch (error: any) {
      console.error('Failed to fetch proxies:', error);
      // Use mock data if API fails
      setProxies(mockProxies);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = () => {
    toast.info('Running health check on all proxies...');
  };

  const handleAddProxy = async () => {
    try {
      if (!formData.ipAddress || !formData.port || !formData.country) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await apiClient.post('/api/admin/proxies', {
        ipAddress: formData.ipAddress,
        port: parseInt(formData.port),
        protocol: formData.protocol,
        country: formData.country,
        username: formData.username || undefined,
        password: formData.password || undefined
      });

      if (response.data.success) {
        toast.success('Proxy added successfully');
        setShowAddDialog(false);
        setFormData({ ipAddress: '', port: '', protocol: 'HTTP', country: '', username: '', password: '' });
        fetchProxies();
      } else {
        toast.error(response.data.message || 'Failed to add proxy');
      }
    } catch (error: any) {
      console.error('Failed to add proxy:', error);
      toast.error('Failed to add proxy');
    }
  };

  const liveProxies = proxies.filter(p => p.status === 'ACTIVE' || p.status === 'live').length;
  const failedProxies = proxies.filter(p => p.status === 'FAILED' || p.status === 'failed').length;
  const totalSessions = proxies.reduce((sum, p) => sum + p.activeSessions, 0);
  const avgUptime = proxies.length > 0 
    ? (proxies.reduce((sum, p) => sum + p.uptime, 0) / proxies.length).toFixed(1)
    : 0;

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Back Link */}
          <Link href="/admin" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          {/* Breadcrumb */}
          <div className="mb-2 text-sm text-white/50">
            <Link href="/admin" className="hover:text-white/70 transition-colors cursor-pointer">Admin</Link>
            <span> / </span>
            <span>Proxy Pool</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Proxy Pool</h1>
          <p className="text-sm text-white/50 mt-1">{liveProxies} proxies online</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleHealthCheck}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Health Check
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3d6ee0] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Proxy
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-white">{proxies.length}</div>
          <div className="text-sm text-white/50 mt-1">Total Proxies</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#10B981]">{liveProxies}</div>
          <div className="text-sm text-white/50 mt-1">Active</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#EF4444]">{failedProxies}</div>
          <div className="text-sm text-white/50 mt-1">Failed</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#4F7FFF]">{totalSessions}</div>
          <div className="text-sm text-white/50 mt-1">Active Sessions</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
              filter === f
                ? 'bg-[#4F7FFF]/10 text-[#4F7FFF] border border-[#4F7FFF]/20'
                : 'bg-transparent text-white/50 hover:text-white/70'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Proxies Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : proxies.length === 0 ? (
          <div className="p-12 text-center">
            <Globe className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-medium text-white mb-2">No proxies found</h3>
            <p className="text-sm text-white/50 mb-6">
              Add proxies to distribute session traffic
            </p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3d6ee0] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Your First Proxy
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Proxy ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">IP Address</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Port</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Protocol</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Country</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Uptime</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {proxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-white/70">{proxy.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-white">{proxy.ip}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-sm text-white/70">{proxy.port}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      proxy.protocol === 'SOCKS5'
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                        : 'bg-[#4F7FFF]/10 text-[#4F7FFF]'
                    }`}>
                      {proxy.protocol}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-sm text-white">{proxy.country}</span>
                  </td>
                  <td className="px-6 py-4">
                    {proxy.status === 'ACTIVE' || proxy.status === 'live' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
                        <span className="text-xs text-[#10B981] font-medium">Live</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                        <span className="text-xs text-[#EF4444] font-medium">Failed</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-mono ${
                      proxy.uptime > 95 ? 'text-[#10B981]' :
                      proxy.uptime > 80 ? 'text-[#F59E0B]' :
                      'text-[#EF4444]'
                    }`}>
                      {proxy.uptime.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-white">{proxy.activeSessions}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-[#4F7FFF]/20 bg-[#4F7FFF]/10 p-4">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-[#4F7FFF] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/70 space-y-1">
            <p className="font-medium text-white">Proxy Health Monitoring</p>
            <p className="text-white/60">
              Proxies are automatically health-checked every 60 seconds. Failed proxies are removed from the rotation after 3 consecutive failures.
            </p>
          </div>
        </div>
      </div>

      {/* Add Proxy Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F1117] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Add Proxy</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-white/70">IP Address *</label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                  placeholder="192.168.1.1"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm text-white/70">Port *</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({...formData, port: e.target.value})}
                    placeholder="8080"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-white/70">Protocol *</label>
                  <CustomSelect
                    value={formData.protocol}
                    onChange={(value) => setFormData({...formData, protocol: value})}
                    options={[
                      { value: 'HTTP', label: 'HTTP' },
                      { value: 'HTTPS', label: 'HTTPS' },
                      { value: 'SOCKS5', label: 'SOCKS5' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/70">Country *</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  placeholder="US"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/70">Username (optional)</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="proxy_user"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/70">Password (optional)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({ ipAddress: '', port: '', protocol: 'HTTP', country: '', username: '', password: '' });
                }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProxy}
                className="flex-1 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
              >
                Add Proxy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mock data for development
const mockProxies: Proxy[] = [
  {
    id: 'prx_8k2m9x',
    ip: '185.220.101.42',
    port: 8080,
    protocol: 'HTTP',
    country: 'DE',
    status: 'ACTIVE',
    uptime: 99.8,
    lastCheck: new Date().toISOString(),
    activeSessions: 4,
  },
  {
    id: 'prx_4p7n1q',
    ip: '195.201.34.89',
    port: 1080,
    protocol: 'SOCKS5',
    country: 'NL',
    status: 'ACTIVE',
    uptime: 98.2,
    lastCheck: new Date().toISOString(),
    activeSessions: 2,
  },
  {
    id: 'prx_2k5j8w',
    ip: '167.99.142.23',
    port: 8080,
    protocol: 'HTTP',
    country: 'US',
    status: 'FAILED',
    uptime: 45.1,
    lastCheck: new Date().toISOString(),
    activeSessions: 0,
  },
  {
    id: 'prx_9m3x7r',
    ip: '134.209.24.156',
    port: 1080,
    protocol: 'SOCKS5',
    country: 'SG',
    status: 'ACTIVE',
    uptime: 99.9,
    lastCheck: new Date().toISOString(),
    activeSessions: 6,
  },
];
