'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import CustomSelect from '@/components/CustomSelect';
import { Shield, Plus, Activity, AlertTriangle, Globe, Clock, Ban, CheckCircle, ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface AccessLog {
  id: string;
  ip: string;
  hostname: string | null;
  country: string | null;
  userAgent: string | null;
  path: string;
  method: string;
  statusCode: number;
  blocked: boolean;
  botDetected: boolean;
  botReason: string | null;
  timestamp: string;
}

interface IPRule {
  id: string;
  ipAddress: string;
  action: string;
  reason: string;
  createdAt: string;
  expiresAt?: string | null;
}

export default function IPShieldPage() {
  const [activeTab, setActiveTab] = useState<'log' | 'rules'>('log');
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [rules, setRules] = useState<IPRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, uniqueIPs: 0, blockedCount: 0, botCount: 0 });
  
  // Add Rule Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [formData, setFormData] = useState({
    ipAddress: '',
    action: 'BLOCK',
    reason: '',
    expiresIn: '0'
  });
  const [bulkFormData, setBulkFormData] = useState({
    ips: '',
    action: 'BLOCK',
    reason: '',
    expiresIn: '0'
  });

  useEffect(() => {
    if (activeTab === 'log') {
      fetchAccessLogs();
      const interval = setInterval(fetchAccessLogs, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    } else {
      fetchRules();
    }
  }, [activeTab]);

  const fetchAccessLogs = async () => {
    try {
      const response = await apiClient.get('/api/admin/security/access-log', {
        params: { page: 1, limit: 50 },
      });
      if (response.data.success) {
        setAccessLogs(response.data.logs || []);
        setStats({
          total: response.data.total || 0,
          uniqueIPs: response.data.uniqueIPs || 0,
          blockedCount: response.data.blockedCount || 0,
          botCount: response.data.botCount || 0,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch access logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/api/admin/security/ip-shield');
      if (response.data.success) {
        setRules(response.data.rules || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch rules:', error);
      toast.error('Failed to load IP rules');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async (ip: string) => {
    try {
      await apiClient.post('/api/admin/security/ip-shield', {
        ip,
        type: 'block',
        reason: 'Blocked from access log',
      });
      toast.success(`Blocked ${ip}`);
      fetchAccessLogs();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to block IP');
    }
  };

  const handleAddRule = async () => {
    try {
      if (!formData.ipAddress || !formData.reason) {
        toast.error('Please fill in all required fields');
        return;
      }

      const body: any = {
        ip: formData.ipAddress,
        type: formData.action.toLowerCase(),
        reason: formData.reason,
      };

      if (formData.expiresIn !== '0') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expiresIn));
        body.expiresAt = expiresAt.toISOString();
      }

      await apiClient.post('/api/admin/security/ip-shield', body);
      toast.success('IP rule added successfully');
      setShowAddDialog(false);
      setFormData({ ipAddress: '', action: 'BLOCK', reason: '', expiresIn: '0' });
      fetchRules();
    } catch (error: any) {
      console.error('Failed to add rule:', error);
      toast.error(error.response?.data?.error || 'Failed to add IP rule');
    }
  };

  const handleBulkAdd = async () => {
    try {
      const lines = bulkFormData.ips
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      if (lines.length === 0) {
        toast.error('Please enter at least one IP address');
        return;
      }

      if (!bulkFormData.reason) {
        toast.error('Please provide a reason');
        return;
      }

      const body: any = {
        ips: lines,
        action: bulkFormData.action.toLowerCase(),
        reason: bulkFormData.reason,
      };

      if (bulkFormData.expiresIn !== '0') {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + parseInt(bulkFormData.expiresIn));
        body.expiresAt = expiresAt.toISOString();
      }

      const response = await apiClient.post('/api/admin/security/ip-rules/bulk', body);
      
      if (response.data.success) {
        const created = response.data.created || 0;
        const skipped = response.data.skipped || 0;
        toast.success(`${created} rules added${skipped > 0 ? `, ${skipped} duplicates skipped` : ''}`);
        setShowAddDialog(false);
        setBulkFormData({ ips: '', action: 'BLOCK', reason: '', expiresIn: '0' });
        fetchRules();
      }
    } catch (error: any) {
      console.error('Failed to add IP rules:', error);
      toast.error(error.response?.data?.error || 'Failed to add IP rules');
    }
  };

  const countIPs = () => {
    const lines = bulkFormData.ips
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    return lines.length;
  };

  const copyIP = (ip: string) => {
    navigator.clipboard.writeText(ip);
    toast.success('IP copied to clipboard');
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400';
    if (code >= 400 && code < 500) return 'text-amber-400';
    if (code >= 500) return 'text-red-400';
    return 'text-white/60';
  };

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <div className="mb-2 text-sm text-white/50">
          <Link href="/admin" className="hover:text-white/70 transition-colors cursor-pointer">Admin</Link>
          <span> / </span>
          <span>Security</span>
          <span> / </span>
          <span>IP Shield</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">IP Shield & Access Monitor</h1>
        <p className="text-sm text-white/50 mt-1">Real-time IP monitoring and access control</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.uniqueIPs}</p>
              <p className="text-xs text-white/50">Unique IPs</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Ban className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.blockedCount}</p>
              <p className="text-xs text-white/50">Blocked</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.botCount}</p>
              <p className="text-xs text-white/50">Bots Detected</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-white/50">Total Requests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('log')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'log'
              ? 'border-b-2 border-[#4F7FFF] text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Access Log
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'rules'
              ? 'border-b-2 border-[#4F7FFF] text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          IP Rules
        </button>
      </div>

      {/* Access Log Tab */}
      {activeTab === 'log' && (
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="text-sm font-medium text-white">Live Access Monitor</h2>
            <p className="text-xs text-white/40 mt-0.5">Updates every 10 seconds</p>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : accessLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-10 w-10 text-white/20 mb-3" />
              <p className="text-sm font-medium text-white/50">No access logs yet</p>
              <p className="text-xs text-white/30">Access logs will appear here as requests come in</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Hostname</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Country</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Path</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Bot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Time</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {accessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-white font-mono">{log.ip}</code>
                          <button
                            onClick={() => copyIP(log.ip)}
                            className="text-white/40 hover:text-white/70"
                            title="Copy IP"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-white/50">
                          {log.hostname || 'resolving...'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-white/70">{log.country || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs text-white/60">{log.path.substring(0, 30)}{log.path.length > 30 ? '...' : ''}</code>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-sm font-mono font-medium ${getStatusColor(log.statusCode)}`}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.botDetected && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400" title={log.botReason || ''}>
                            Bot
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!log.blocked && (
                          <button
                            onClick={() => handleBlockIP(log.ip)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Block IP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* IP Rules Tab */}
      {activeTab === 'rules' && (
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-sm font-medium text-white">IP Access Rules</h2>
            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Rule
            </button>
          </div>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-10 w-10 text-white/20 mb-3" />
              <p className="text-sm font-medium text-white/50">No IP rules configured</p>
              <p className="text-xs text-white/30 mb-6">Add rules to control access by IP address</p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add First Rule
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Reason</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <code className="text-sm text-white font-mono">{rule.ipAddress}</code>
                      </td>
                      <td className="px-6 py-4">
                        {rule.action === 'allow' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                            Allow
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                            Block
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/70">{rule.reason}</td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {rule.expiresAt ? new Date(rule.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Rule Dialog - same as before but with proper styling */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#151823] shadow-2xl">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-white">Add IP Rule</h2>
            </div>

            <div className="mb-4 flex gap-2 border-b border-white/10 px-6">
              <button
                onClick={() => setAddMode('single')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  addMode === 'single'
                    ? 'border-b-2 border-[#4F7FFF] text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Single IP
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  addMode === 'bulk'
                    ? 'border-b-2 border-[#4F7FFF] text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Bulk Add
              </button>
            </div>

            {/* Single IP Form */}
            {addMode === 'single' && (
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">IP Address *</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                    placeholder="192.168.1.1 or 10.0.0.0/24"
                    className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                  />
                  <p className="mt-1 text-xs text-white/40">Single IP or CIDR notation</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Action *</label>
                  <CustomSelect
                    value={formData.action}
                    onChange={(value) => setFormData({...formData, action: value})}
                    options={[
                      { value: 'BLOCK', label: 'Block (Blacklist)' },
                      { value: 'ALLOW', label: 'Allow (Whitelist)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Reason *</label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    placeholder="Why is this IP being blocked/allowed?"
                    rows={3}
                    className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Expires</label>
                  <CustomSelect
                    value={formData.expiresIn}
                    onChange={(value) => setFormData({...formData, expiresIn: value})}
                    options={[
                      { value: '0', label: 'Never' },
                      { value: '1', label: '1 Day' },
                      { value: '7', label: '1 Week' },
                      { value: '30', label: '1 Month' },
                      { value: '90', label: '3 Months' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Bulk Add Form */}
            {addMode === 'bulk' && (
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">IP Addresses *</label>
                  <textarea
                    value={bulkFormData.ips}
                    onChange={(e) => setBulkFormData({...bulkFormData, ips: e.target.value})}
                    placeholder="One IP or CIDR per line:&#10;192.168.1.1&#10;10.0.0.0/24&#10;203.0.113.0/24"
                    rows={8}
                    className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                  />
                  <p className="mt-1 text-xs text-white/40">
                    One IP per line. Lines starting with # are ignored. Detected: {countIPs()} IPs
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Action *</label>
                  <CustomSelect
                    value={bulkFormData.action}
                    onChange={(value) => setBulkFormData({...bulkFormData, action: value})}
                    options={[
                      { value: 'BLOCK', label: 'Block (Blacklist)' },
                      { value: 'ALLOW', label: 'Allow (Whitelist)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Reason</label>
                  <input
                    type="text"
                    value={bulkFormData.reason}
                    onChange={(e) => setBulkFormData({...bulkFormData, reason: e.target.value})}
                    placeholder="Bulk import reason"
                    className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">Expires</label>
                  <CustomSelect
                    value={bulkFormData.expiresIn}
                    onChange={(value) => setBulkFormData({...bulkFormData, expiresIn: value})}
                    options={[
                      { value: '0', label: 'Never' },
                      { value: '1', label: '1 Day' },
                      { value: '7', label: '1 Week' },
                      { value: '30', label: '1 Month' },
                      { value: '90', label: '3 Months' },
                    ]}
                  />
                </div>
              </div>
            )}

            <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-3 border-t border-white/5">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({ ipAddress: '', action: 'BLOCK', reason: '', expiresIn: '0' });
                  setBulkFormData({ ips: '', action: 'BLOCK', reason: '', expiresIn: '0' });
                }}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={addMode === 'single' ? handleAddRule : handleBulkAdd}
                className="px-4 py-2 text-sm font-medium bg-[#4F7FFF] hover:bg-[#3D6FEF] text-white rounded-lg transition-colors"
              >
                {addMode === 'single' ? 'Add Rule' : `Add ${countIPs()} Rules`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
