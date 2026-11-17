'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Network, Plus, CheckCircle, XCircle, Globe, ArrowLeft, Trash2, Edit2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '@/components/CustomSelect';
import apiClient from '@/lib/api-client';

interface Proxy {
  id: string;
  ipAddress: string;
  port: number;
  protocol: string;
  country: string;
  status: string;
  uptime: number;
  activeSessions: number;
}

interface TestResult {
  testing: boolean;
  healthy?: boolean;
  responseTime?: number;
  message?: string;
}

export default function InfrastructureProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState<{ id: string; host: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
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
    const interval = setInterval(fetchProxies, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProxies = async () => {
    try {
      const response = await apiClient.get('/api/admin/proxies');
      if (response.data.success) {
        setProxies(response.data.proxies || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch proxies:', error);
      toast.error('Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  const handleTestProxy = async (proxyId: string) => {
    setTestResults(prev => ({ ...prev, [proxyId]: { testing: true } }));
    
    try {
      const response = await apiClient.post(`/api/admin/proxies/${proxyId}/check`);
      
      if (response.data.success) {
        setTestResults(prev => ({
          ...prev,
          [proxyId]: {
            testing: false,
            healthy: response.data.healthy,
            responseTime: response.data.responseTime,
            message: response.data.message
          }
        }));
        
        if (response.data.healthy) {
          toast.success(`Proxy is healthy (${response.data.responseTime}ms)`);
        } else {
          toast.error('Proxy is unreachable');
        }
        
        // Refresh proxy list to update health status
        fetchProxies();
      } else {
        setTestResults(prev => ({
          ...prev,
          [proxyId]: {
            testing: false,
            healthy: false,
            message: response.data.message || 'Test failed'
          }
        }));
        toast.error(response.data.message || 'Failed to test proxy');
      }
    } catch (error: any) {
      console.error('Failed to test proxy:', error);
      setTestResults(prev => ({
        ...prev,
        [proxyId]: {
          testing: false,
          healthy: false,
          message: 'Test failed'
        }
      }));
      toast.error('Failed to test proxy');
    }
  };

  const handleToggleProxy = async (proxyId: string, currentlyActive: boolean) => {
    try {
      const response = await apiClient.patch(`/api/admin/proxies/${proxyId}`, {
        enabled: !currentlyActive
      });

      if (response.data.success) {
        toast.success(response.data.message || `Proxy ${!currentlyActive ? 'enabled' : 'disabled'}`);
        fetchProxies();
      } else {
        toast.error(response.data.message || 'Failed to toggle proxy');
      }
    } catch (error: any) {
      console.error('Failed to toggle proxy:', error);
      toast.error('Failed to toggle proxy');
    }
  };

  const handleDeleteProxy = async () => {
    if (!proxyToDelete) return;

    try {
      const response = await apiClient.delete(`/api/admin/proxies/${proxyToDelete.id}`);

      if (response.data.success) {
        toast.success('Proxy deleted successfully');
        setShowDeleteDialog(false);
        setProxyToDelete(null);
        fetchProxies();
      } else {
        toast.error(response.data.message || 'Failed to delete proxy');
      }
    } catch (error: any) {
      console.error('Failed to delete proxy:', error);
      toast.error('Failed to delete proxy');
    }
  };

  const openDeleteDialog = (proxy: Proxy) => {
    setProxyToDelete({ id: proxy.id, host: proxy.ipAddress });
    setShowDeleteDialog(true);
  };

  const handleAddProxy = async () => {
    try {
      if (!formData.ipAddress || !formData.port || !formData.country) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Strip parenthetical text and construct proxyUrl
      const cleanHost = formData.ipAddress.replace(/\s*\(.*?\)\s*$/g, '').trim();
      let proxyUrl: string;
      if (formData.username && formData.password) {
        proxyUrl = `${formData.protocol.toLowerCase()}://${formData.username}:${formData.password}@${cleanHost}:${formData.port}`;
      } else {
        proxyUrl = `${formData.protocol.toLowerCase()}://${cleanHost}:${formData.port}`;
      }

      const response = await apiClient.post('/api/admin/proxies', {
        proxyUrl,
        host: cleanHost,
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
        toast.error(response.data.error || response.data.message || 'Failed to add proxy');
      }
    } catch (error: any) {
      console.error('Failed to add proxy:', error);
      toast.error('Failed to add proxy');
    }
  };

  const activeProxies = proxies.filter(p => p.status === 'ACTIVE' || p.status === 'active' || p.status === 'live').length;
  const totalSessions = proxies.reduce((sum, p) => sum + (p.activeSessions || 0), 0);
  const avgUptime = proxies.length > 0 
    ? (proxies.reduce((sum, p) => sum + (p.uptime || 0), 0) / proxies.length).toFixed(1)
    : '0';

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
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
            <span>Infrastructure</span>
            <span> / </span>
            <span>Proxies</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Proxies</h1>
          <p className="mt-1 text-sm text-white/50">Manage proxy infrastructure for sessions</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Proxy
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Proxies</p>
          <p className="mt-2 text-3xl font-bold text-white">{proxies.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Active</p>
          <p className="mt-2 text-3xl font-bold text-white">{activeProxies}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Active Sessions</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalSessions}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Avg Uptime</p>
          <p className="mt-2 text-3xl font-bold text-white">{avgUptime}%</p>
        </div>
      </div>

      {/* Proxies Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-white">Proxy Pool</h2>
          <p className="text-xs text-white/50">{activeProxies} active</p>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : proxies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Network className="h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/50">No proxies configured</p>
            <p className="mt-1 text-xs text-white/30 mb-6">Add proxies to distribute session traffic</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add First Proxy
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Proxy Host</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Port</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Protocol</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Uptime</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Sessions</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {proxies.map((proxy) => {
                const testResult = testResults[proxy.id];
                return (
                  <tr key={proxy.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-white">{proxy.ipAddress}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono text-sm text-white/70">{proxy.port}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        proxy.protocol === 'SOCKS5' || proxy.protocol === 'SOCKS4'
                          ? 'bg-purple-500/10 text-purple-400' 
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {proxy.protocol}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-white">{proxy.country}</span>
                    </td>
                    <td className="px-6 py-4">
                      {proxy.status === 'ACTIVE' || proxy.status === 'active' || proxy.status === 'live' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-mono ${
                        proxy.uptime > 95 ? 'text-emerald-400' :
                        proxy.uptime > 80 ? 'text-amber-400' :
                        'text-red-400'
                      }`}>
                        {proxy.uptime.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-medium text-white">{proxy.activeSessions}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Test Button */}
                        <button
                          onClick={() => handleTestProxy(proxy.id)}
                          disabled={testResult?.testing}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#4F7FFF]/10 px-2.5 py-1.5 text-xs font-medium text-[#4F7FFF] hover:bg-[#4F7FFF]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Test proxy health"
                        >
                          {testResult?.testing ? (
                            <>
                              <div className="h-3 w-3 border border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
                              <span className="hidden lg:inline">Testing...</span>
                            </>
                          ) : testResult?.healthy === true ? (
                            <>
                              <CheckCircle className="h-3 w-3 text-emerald-400" />
                              <span className="hidden lg:inline">Healthy ({testResult.responseTime}ms)</span>
                            </>
                          ) : testResult?.healthy === false ? (
                            <>
                              <XCircle className="h-3 w-3 text-red-400" />
                              <span className="hidden lg:inline">Unreachable</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3" />
                              <span className="hidden lg:inline">Test</span>
                            </>
                          )}
                        </button>

                        {/* Toggle Enable/Disable */}
                        <button
                          onClick={() => handleToggleProxy(proxy.id, proxy.status === 'ACTIVE' || proxy.status === 'active' || proxy.status === 'live')}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            proxy.status === 'ACTIVE' || proxy.status === 'active' || proxy.status === 'live'
                              ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={proxy.status === 'ACTIVE' || proxy.status === 'active' || proxy.status === 'live' ? 'Disable proxy' : 'Enable proxy'}
                        >
                          {proxy.status === 'ACTIVE' || proxy.status === 'active' || proxy.status === 'live' ? (
                            <PowerOff className="h-3 w-3" />
                          ) : (
                            <Power className="h-3 w-3" />
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => openDeleteDialog(proxy)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete proxy"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && proxyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F1117] p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Delete Proxy</h2>
                <p className="text-sm text-white/50">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6 rounded-lg bg-white/5 p-4">
              <p className="text-sm text-white/70">
                Are you sure you want to delete this proxy?
              </p>
              <p className="mt-2 font-mono text-sm text-white">
                {proxyToDelete.host}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setProxyToDelete(null);
                }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProxy}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Proxy Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F1117] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Add Proxy</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Proxy Host *</label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/\s*\(.*?\)\s*$/g, '').trim();
                    setFormData({...formData, ipAddress: cleanValue});
                  }}
                  placeholder="192.168.1.1 or proxy.example.com"
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
                      { value: 'SOCKS4', label: 'SOCKS4' },
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
