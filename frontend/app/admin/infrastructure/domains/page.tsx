'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Globe, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, X, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';

interface Domain {
  id: string;
  name: string;
  status: string;
  dnsStatus: string;
  sslStatus: string;
  cloudflareZoneId?: string;
  nameservers?: string[];
  cfAccountName?: string;
  createdAt: string;
}

interface NewDomainResponse {
  success: boolean;
  domain: {
    id: string;
    name: string;
    zoneId?: string;
    nameservers?: string[];
    cfAccountName?: string;
    status: string;
    message?: string;
  };
  error?: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showNameserverModal, setShowNameserverModal] = useState(false);
  const [nameservers, setNameservers] = useState<string[]>([]);
  const [nameserverDomain, setNameserverDomain] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [deletingDomain, setDeletingDomain] = useState(false);
  const [deleteError, setDeleteError] = useState<string>('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [pollingDomains, setPollingDomains] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
    const interval = setInterval(fetchDomains, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll domain status for pending domains
  useEffect(() => {
    const pendingDomains = domains.filter(d => d.status === 'pending' && d.cloudflareZoneId);
    
    if (pendingDomains.length > 0) {
      const pollInterval = setInterval(() => {
        pendingDomains.forEach(domain => {
          if (!pollingDomains.has(domain.id)) {
            checkDomainStatus(domain.id);
          }
        });
      }, 30000); // Poll every 30 seconds

      return () => clearInterval(pollInterval);
    }
  }, [domains]);

  const fetchDomains = async () => {
    try {
      const response = await apiClient.get('/api/admin/domains');
      if (response.data.success) {
        setDomains(response.data.domains || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch domains:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDomainStatus = async (domainId: string) => {
    if (pollingDomains.has(domainId)) return;

    setPollingDomains(prev => new Set(prev).add(domainId));

    try {
      const response = await apiClient.get(`/api/admin/domains/${domainId}/status`);
      
      if (response.data.success && response.data.status) {
        setDomains(prevDomains => 
          prevDomains.map(d => 
            d.id === domainId ? { ...d, status: response.data.status } : d
          )
        );

        if (response.data.status === 'active') {
          toast.success('Domain is now active!');
        }
      }
    } catch (error) {
      console.error('Failed to check domain status:', error);
    } finally {
      setPollingDomains(prev => {
        const next = new Set(prev);
        next.delete(domainId);
        return next;
      });
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) {
      toast.error('Domain name is required');
      return;
    }

    setAddingDomain(true);
    try {
      const response = await apiClient.post('/api/admin/domains', {
        name: newDomain.trim().toLowerCase()
      });
      
      const { domain, nameservers: ns } = response.data;
      
      setShowAddDialog(false);
      setNewDomain('');
      await fetchDomains();

      if (ns && ns.length > 0) {
        setNameserverDomain(domain.name);
        setNameservers(ns);
        setShowNameserverModal(true);
      } else {
        toast.info('Domain added successfully');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to add domain';
      toast.error(errorMsg);
    } finally {
      setAddingDomain(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleCheckDomain = async (domainId: string) => {
    setChecking(domainId);
    try {
      const res = await apiClient.post(`/api/admin/domains/${domainId}/check`);
      const { status, message } = res.data;
      if (status === 'active') {
        toast.success(message);
      } else {
        toast(message, { icon: '⏳' });
      }
      fetchDomains();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Check failed');
    } finally {
      setChecking(null);
    }
  };

  const handleDeleteClick = (domain: Domain) => {
    setDomainToDelete(domain);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!domainToDelete) return;

    setDeletingDomain(true);
    setDeleteError('');

    try {
      await apiClient.delete(`/api/admin/domains/${domainToDelete.id}`);
      toast.success(`${domainToDelete.name} deleted`);
      setShowDeleteModal(false);
      setDomainToDelete(null);
      fetchDomains(); // Re-fetch the list
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete domain';
      setDeleteError(errorMsg);
    } finally {
      setDeletingDomain(false);
    }
  };

  const activeDomains = domains.filter(d => d.status === 'active').length;
  const pendingDomains = domains.filter(d => d.status === 'pending' || d.status === 'pending_cf').length;
  const validSSL = domains.filter(d => d.sslStatus === 'valid' || d.sslStatus === 'active').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            Pending NS
          </span>
        );
      case 'pending_cf':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            CF Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
            Inactive
          </span>
        );
    }
  };

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
            <span>Domains</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Domains</h1>
          <p className="mt-1 text-sm text-white/50">Manage campaign domains and SSL certificates</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {/* Stat Cards - 4 Column Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Domains</p>
          <p className="mt-2 text-3xl font-bold text-white">{domains.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Active</p>
          <p className="mt-2 text-3xl font-bold text-white">{activeDomains}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Pending Setup</p>
          <p className="mt-2 text-3xl font-bold text-white">{pendingDomains}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Valid SSL</p>
          <p className="mt-2 text-3xl font-bold text-white">{validSSL}</p>
        </div>
      </div>

      {/* Domains Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-white">All Domains</h2>
          <p className="text-xs text-white/50">{domains.length} total</p>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : domains.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/50">No domains configured</p>
            <p className="mt-1 text-xs text-white/30 mb-6">Add domains to host your campaigns</p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Your First Domain
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">CF Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">SSL Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {domains.map((domain) => {
                const ns: string[] = Array.isArray(domain.nameservers) 
                  ? domain.nameservers 
                  : (typeof domain.nameservers === 'string' 
                      ? (() => { try { return JSON.parse(domain.nameservers) } catch { return [] } })()
                      : []);
                
                return (
                  <tr key={domain.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-white/40" />
                          <span className="font-mono text-sm text-white">{domain.name}</span>
                        </div>
                        {ns.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1 ml-6">
                            {ns.map((n) => (
                              <span key={n} className="font-mono text-xs text-white/50 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-white/30 mt-0.5 block ml-6">No nameservers yet</span>
                        )}
                      </div>
                    </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(domain.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {domain.cfAccountName || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {domain.sslStatus === 'valid' || domain.sslStatus === 'active' ? (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400">Valid</span>
                      </div>
                    ) : domain.sslStatus === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <span className="text-sm text-amber-400">Pending</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-sm text-red-400">Expired</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60 font-mono">
                    {new Date(domain.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(domain.status === 'pending_ns' || domain.status === 'active') && (
                        <button
                          onClick={() => handleCheckDomain(domain.id)}
                          disabled={checking === domain.id}
                          title="Check nameserver propagation"
                          className="text-white/40 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <RefreshCw className={`w-4 h-4 ${checking === domain.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(domain)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
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

      {/* Add Domain Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Add Domain</h2>
              <button
                onClick={() => setShowAddDialog(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddDomain} className="p-6">
              <div className="mb-6">
                <label htmlFor="domain" className="block text-sm font-medium text-white mb-2">
                  Domain Name
                </label>
                <input
                  id="domain"
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  disabled={addingDomain}
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                  disabled={addingDomain}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDomain}
                  className="flex-1 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingDomain ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nameserver Modal */}
      {showNameserverModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#151823] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-white font-semibold text-lg mb-1">Update Your Nameservers</h2>
            <p className="text-white/50 text-sm mb-4">
              Point <span className="text-white font-mono">{nameserverDomain}</span> to these nameservers at your registrar. Propagation takes up to 48 hours.
            </p>
            <div className="space-y-2 mb-6">
              {nameservers.map((ns) => (
                <div key={ns} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <span className="font-mono text-sm text-white">{ns}</span>
                  <button
                    onClick={() => copyToClipboard(ns)}
                    className="text-white/40 hover:text-white ml-3 text-xs"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowNameserverModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && domainToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823]">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Delete Domain</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-white/70 mb-6">
                Are you sure you want to delete <span className="font-semibold text-white">{domainToDelete.name}</span>? 
                This will permanently remove the Cloudflare zone and cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <p className="text-sm text-red-400">{deleteError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDomainToDelete(null);
                    setDeleteError('');
                  }}
                  disabled={deletingDomain}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deletingDomain}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingDomain ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
