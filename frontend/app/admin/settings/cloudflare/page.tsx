'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import ConfirmModal from '@/components/ConfirmModal';
import { Cloud, Plus, CheckCircle, XCircle, AlertCircle, Key, Shield, Activity, ArrowLeft, Eye, EyeOff, RefreshCw, Trash2, Edit2, Power, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface CloudflareAccount {
  id: string;
  name: string;
  accountId: string;
  email: string | null;
  status: string;
  zonesCount: number;
  lastUsedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface CloudflareAccountsResponse {
  success: boolean;
  accounts: CloudflareAccount[];
  total?: number;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function CloudflareAccountsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CloudflareAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    apiToken: '',
    accountId: '',
    email: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; accountId: string; accountName: string }>({
    isOpen: false,
    accountId: '',
    accountName: '',
  });

  const swrKey = '/api/admin/settings/cloudflare/accounts';
  const { data, error, isLoading } = useSWR<CloudflareAccountsResponse>(swrKey, fetcher);

  const accounts = data?.accounts || [];

  // Fetch Turnstile Widgets
  const widgetsKey = '/api/admin/settings/cloudflare/turnstile-widgets';
  const { data: widgetsData, error: widgetsError, isLoading: widgetsLoading } = useSWR<{
    success: boolean;
    widgets: Array<{
      id: string;
      domain: string;
      siteKey: string;
      cloudflareAccount: string;
      cloudflareAccountId: string | null;
      createdAt: string;
    }>;
    total: number;
  }>(widgetsKey, fetcher);

  const widgets = widgetsData?.widgets || [];

  const handleAddAccount = async () => {
    try {
      if (!formData.name || !formData.apiToken || !formData.accountId) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await apiClient.post('/api/admin/settings/cloudflare/accounts', formData);
      
      if (response.status === 200 || response.status === 201) {
        toast.success('Cloudflare account added successfully');
        setShowAddDialog(false);
        setFormData({ name: '', apiToken: '', accountId: '', email: '' });
        setShowToken(false);
        // Re-fetch accounts after creation
        mutate(swrKey);
      }
    } catch (error: any) {
      console.error('Failed to add account:', error);
      toast.error(error.response?.data?.error || 'Failed to add Cloudflare account');
    }
  };

  const handleTestAccount = async (id: string) => {
    setTestingId(id);
    try {
      const response = await apiClient.post(`/api/admin/settings/cloudflare/accounts/${id}/test`);
      
      if (response.data.success && response.data.valid) {
        toast.success(`Connection successful: ${response.data.accountName || 'Account verified'}`);
        mutate(swrKey);
      }
    } catch (error: any) {
      console.error('Failed to test account:', error);
      toast.error(error.response?.data?.error || 'Connection failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
      const response = await apiClient.patch(`/api/admin/settings/cloudflare/accounts/${id}`, { status: newStatus });
      if (response.status === 200) {
        toast.success(`Account ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
        mutate(swrKey);
      }
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      toast.error(error.response?.data?.error || 'Failed to update account');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      const response = await apiClient.delete(`/api/admin/settings/cloudflare/accounts/${id}`);
      // Only show success if backend returned 200
      if (response.status === 200 && response.data.success) {
        toast.success('Account permanently deleted');
        // Re-fetch accounts AFTER backend confirms deletion
        mutate(swrKey);
      } else {
        toast.error('Delete failed - no confirmation from server');
      }
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast.error(error.response?.data?.error || 'Failed to delete account');
    }
  };

  const activeAccounts = accounts.filter(a => a.status === 'active').length;
  const totalDomains = accounts.reduce((sum, a) => sum + a.zonesCount, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto p-8 max-w-7xl">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center">
          <p className="text-red-500">Failed to load Cloudflare accounts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto p-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/settings" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="mb-2 text-sm text-white/50">
            <Link href="/admin" className="hover:text-white/70 transition-colors cursor-pointer">Admin</Link>
            <span> / </span>
            <Link href="/admin/settings" className="hover:text-white/70 transition-colors cursor-pointer">Settings</Link>
            <span> / </span>
            <span>Cloudflare</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Cloudflare Accounts</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage Cloudflare API accounts for automated domain provisioning
          </p>
          <p className="text-xs text-white/40 mt-2">
            {activeAccounts} accounts active · {totalDomains} total domains managed
          </p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {/* Accounts Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-white">Cloudflare API Accounts</h2>
        </div>

        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Cloud className="h-10 w-10 text-white/20 mb-3" />
            <p className="text-sm font-medium text-white/50">No Cloudflare accounts configured</p>
            <p className="text-xs text-white/30 mb-6 mt-1">Add an account to enable automated domain provisioning</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add First Account
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Account ID</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Domains</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Last Used</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-white">{account.name}</div>
                      {account.email && (
                        <div className="text-xs text-white/40 mt-0.5">{account.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs text-white/50 font-mono">
                      {account.accountId.substring(0, 8)}...
                    </code>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                      {account.zonesCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {account.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                        Active
                      </span>
                    ) : account.status === 'error' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400" title={account.lastError || 'Error'}>
                        <div className="h-1.5 w-1.5 rounded-full bg-red-400"></div>
                        Error
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {account.lastUsedAt ? new Date(account.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleTestAccount(account.id)}
                        disabled={testingId === account.id}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                        title="Test connection"
                      >
                        {testingId === account.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggleStatus(account.id, account.status)}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white transition-colors"
                        title={account.status === 'active' ? 'Disable' : 'Enable'}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, accountId: account.id, accountName: account.name })}
                        className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Turnstile Widgets Section */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Turnstile Widgets</h2>
          <p className="text-sm text-white/50 mt-1">
            Bot protection widgets automatically created for domains
          </p>
        </div>

        {widgetsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : widgetsError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-red-500">Failed to load Turnstile widgets</p>
          </div>
        ) : widgets.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-3 text-white/20" />
            <h3 className="text-sm font-medium text-white/50">No Turnstile widgets yet</h3>
            <p className="text-xs text-white/40 mt-1">
              Widgets are created automatically when you add domains with Cloudflare
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase">Domain</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase">Site Key</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase">Cloudflare Account</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {widgets.map((widget) => (
                  <tr key={widget.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[#4F7FFF]" />
                        <span className="font-mono text-sm text-white">{widget.domain}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-[#0C0E14] border border-white/10 rounded text-xs font-mono text-white/70">
                          {widget.siteKey}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(widget.siteKey);
                            toast.success('Site key copied');
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Copy site key"
                        >
                          <Key className="h-3.5 w-3.5 text-white/50" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/70">{widget.cloudflareAccount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/50">
                        {new Date(widget.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Account Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823] shadow-2xl">
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-white">Add Cloudflare Account</h2>
              <p className="text-sm text-white/50 mt-1">Connect a new Cloudflare API account for domain provisioning</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Production Account, Team A"
                  className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">API Token *</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={formData.apiToken}
                    onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    autoComplete="new-password"
                    className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Account ID *</label>
                <input
                  type="text"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  placeholder="32-character hex ID"
                  className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                />
                <p className="text-xs text-white/40 mt-1">
                  Find this in your Cloudflare dashboard URL: dash.cloudflare.com/:accountId
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">Email (optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com"
                  autoComplete="off"
                  className="w-full bg-[#0C0E14] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#4F7FFF]/50 focus:border-[#4F7FFF]/50"
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 flex items-center justify-end gap-3 border-t border-white/5">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({ name: '', apiToken: '', accountId: '', email: '' });
                  setShowToken(false);
                }}
                className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                className="px-4 py-2 text-sm font-medium bg-[#4F7FFF] hover:bg-[#3D6FEF] text-white rounded-lg transition-colors"
              >
                Verify & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, accountId: '', accountName: '' })}
        onConfirm={() => handleDeleteAccount(deleteConfirm.accountId)}
        title="Delete Cloudflare Account"
        message={`Permanently delete "${deleteConfirm.accountName}"? All associated domains will be removed and this action cannot be undone.`}
        confirmText="Delete Permanently"
        variant="danger"
      />
    </div>
  );
}
