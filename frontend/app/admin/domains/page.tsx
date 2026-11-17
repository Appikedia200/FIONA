'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { Globe, Plus, Trash2, ChevronDown, ChevronRight, Key, RefreshCw, Copy, Check, X, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Domain {
  id: string;
  name: string;
  status: string;
  dnsStatus: string;
  sslStatus: string;
  cloudflareZoneId: string | null;
  nameservers: string[] | null;
  turnstileSitekey: string | null;
  cfAccountName: string | null;
  activeCampaignId: string | null;
  activeCampaign: {
    id: string;
    name: string;
    captureId: string;
  } | null;
  createdAt: string;
}

interface Subdomain {
  id: string;
  subdomain: string;
  status: string;
  createdAt: string;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function AdminDomainsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [copiedNS, setCopiedNS] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [redeployingWorker, setRedeployingWorker] = useState<string | null>(null);
  
  // Subdomain management state
  const [showSubdomainModal, setShowSubdomainModal] = useState(false);
  const [selectedDomainForSubdomain, setSelectedDomainForSubdomain] = useState<Domain | null>(null);
  const [newSubdomainName, setNewSubdomainName] = useState('');
  const [addingSubdomain, setAddingSubdomain] = useState(false);
  const [subdomains, setSubdomains] = useState<Record<string, Subdomain[]>>({});

  const { data, error, isLoading } = useSWR('/api/admin/domains', fetcher, {
    refreshInterval: 10000,
  });

  const domains: Domain[] = data?.domains || [];

  const toggleExpanded = (domainId: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
      // Load subdomains if not already loaded
      if (!subdomains[domainId]) {
        loadSubdomains(domainId);
      }
    }
    setExpandedDomains(newExpanded);
  };

  const loadSubdomains = async (domainId: string) => {
    try {
      const response = await apiClient.get(`/api/admin/domains/${domainId}/subdomains`);
      if (response.data.success) {
        setSubdomains(prev => ({
          ...prev,
          [domainId]: response.data.subdomains || []
        }));
      }
    } catch (error) {
      console.error('Failed to load subdomains:', error);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomainName.trim()) {
      toast.error('Domain name is required');
      return;
    }

    setAdding(true);
    try {
      const response = await apiClient.post('/api/admin/domains', {
        name: newDomainName.trim().toLowerCase()
      });

      if (response.data.nameservers && response.data.nameservers.length > 0) {
        toast.success('Domain added! Update nameservers at your registrar.');
      } else {
        toast.success('Domain added successfully');
      }

      setShowAddModal(false);
      setNewDomainName('');
      mutate('/api/admin/domains');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleCheckStatus = async (domainId: string) => {
    setCheckingStatus(domainId);
    try {
      const response = await apiClient.post(`/api/admin/domains/${domainId}/check`);
      toast.success(response.data.message || 'Domain status updated');
      mutate('/api/admin/domains');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to check domain status');
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleRedeployWorker = async (domainId: string, domainName: string) => {
    setRedeployingWorker(domainId);
    try {
      const response = await apiClient.post(`/api/admin/domains/${domainId}/repair`);
      toast.success(response.data.message || 'Worker redeployed successfully');
      mutate('/api/admin/domains');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to redeploy worker');
    } finally {
      setRedeployingWorker(null);
    }
  };

  const handleDeleteDomain = async (domainId: string, domainName: string) => {
    if (!confirm(`Delete domain "${domainName}"? This will remove the Cloudflare zone and cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/domains/${domainId}`);
      toast.success('Domain deleted successfully');
      mutate('/api/admin/domains');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete domain');
    }
  };

  const copyNameservers = (nameservers: string[], domainId: string) => {
    const text = nameservers.join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNS(domainId);
    setTimeout(() => setCopiedNS(null), 2000);
    toast.success('Nameservers copied to clipboard');
  };

  const handleAddSubdomain = async () => {
    if (!selectedDomainForSubdomain || !newSubdomainName.trim()) {
      toast.error('Subdomain name is required');
      return;
    }

    const currentSubdomains = subdomains[selectedDomainForSubdomain.id] || [];
    if (currentSubdomains.length >= 7) {
      toast.error('Maximum 7 subdomains per domain');
      return;
    }

    setAddingSubdomain(true);
    try {
      await apiClient.post(`/api/admin/domains/${selectedDomainForSubdomain.id}/subdomains`, {
        subdomain: newSubdomainName.trim().toLowerCase()
      });
      
      toast.success('Subdomain added successfully');
      setShowSubdomainModal(false);
      setNewSubdomainName('');
      setSelectedDomainForSubdomain(null);
      
      // Reload subdomains
      await loadSubdomains(selectedDomainForSubdomain.id);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add subdomain');
    } finally {
      setAddingSubdomain(false);
    }
  };

  const handleDeleteSubdomain = async (domainId: string, subdomainId: string, subdomainName: string) => {
    if (!confirm(`Delete subdomain "${subdomainName}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/domains/${domainId}/subdomains/${subdomainId}`);
      toast.success('Subdomain deleted successfully');
      
      // Reload subdomains
      await loadSubdomains(domainId);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete subdomain');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'active': 'bg-green-500/10 text-green-400 border-green-500/20',
      'pending_ns': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      'pending_cf': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColors[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          Failed to load domains
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Domain Management</h1>
            <p className="text-white/60">
              Add domains and manage Cloudflare deployment, DNS, and Turnstile security
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#4F7FFF] text-white rounded-lg hover:bg-[#3d6ee0] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[#151823] border border-white/10 rounded-lg p-6">
          <p className="text-sm text-white/50">Total Domains</p>
          <p className="mt-2 text-3xl font-bold text-white">{domains.length}</p>
        </div>
        <div className="bg-[#151823] border border-white/10 rounded-lg p-6">
          <p className="text-sm text-white/50">Active</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {domains.filter(d => d.status === 'active').length}
          </p>
        </div>
        <div className="bg-[#151823] border border-white/10 rounded-lg p-6">
          <p className="text-sm text-white/50">Pending NS</p>
          <p className="mt-2 text-3xl font-bold text-yellow-400">
            {domains.filter(d => d.status === 'pending_ns').length}
          </p>
        </div>
        <div className="bg-[#151823] border border-white/10 rounded-lg p-6">
          <p className="text-sm text-white/50">With Turnstile</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">
            {domains.filter(d => d.turnstileSitekey).length}
          </p>
        </div>
      </div>

      {/* Domains List */}
      {domains.length === 0 ? (
        <div className="bg-[#151823] border border-white/10 rounded-lg p-12 text-center">
          <Globe className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No domains yet</h3>
          <p className="text-sm text-white/50 mb-6">
            Add your first domain to start deploying campaigns on Cloudflare
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F7FFF] text-white rounded-lg hover:bg-[#3d6ee0] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Domain
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => {
            const isExpanded = expandedDomains.has(domain.id);
            const domainSubdomains = subdomains[domain.id] || [];

            return (
              <div key={domain.id} className="bg-[#151823] border border-white/10 rounded-lg overflow-hidden">
                {/* Domain Header */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleExpanded(domain.id)}
                        className="p-1 hover:bg-white/5 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-white/60" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-white/60" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <Globe className="h-5 w-5 text-blue-400" />
                          <h3 className="text-lg font-semibold text-white">{domain.name}</h3>
                          {getStatusBadge(domain.status)}
                        </div>
                        {domain.cloudflareZoneId && (
                          <p className="text-xs text-white/40 ml-8">
                            Zone: {domain.cloudflareZoneId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {domain.turnstileSitekey && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
                          <Key className="h-3 w-3" />
                          Turnstile: ...{domain.turnstileSitekey.slice(-6)}
                        </div>
                      )}
                      {domain.status === 'pending_ns' && (
                        <button
                          onClick={() => handleCheckStatus(domain.id)}
                          disabled={checkingStatus === domain.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors border border-yellow-500/20 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${checkingStatus === domain.id ? 'animate-spin' : ''}`} />
                          Check Status
                        </button>
                      )}
                      <button
                        onClick={() => handleRedeployWorker(domain.id, domain.name)}
                        disabled={redeployingWorker === domain.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/20 disabled:opacity-50"
                      >
                        <Upload className={`h-3 w-3 ${redeployingWorker === domain.id ? 'animate-spin' : ''}`} />
                        Redeploy Worker
                      </button>
                      <button
                        onClick={() => handleDeleteDomain(domain.id, domain.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-6 space-y-6">
                    {/* Nameservers Section */}
                    {domain.nameservers && domain.nameservers.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-white">Cloudflare Nameservers</h4>
                          <button
                            onClick={() => copyNameservers(domain.nameservers!, domain.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          >
                            {copiedNS === domain.id ? (
                              <>
                                <Check className="h-3 w-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy All
                              </>
                            )}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {domain.nameservers.map((ns, idx) => (
                            <div
                              key={idx}
                              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm font-mono text-white/80"
                            >
                              {ns}
                            </div>
                          ))}
                        </div>
                        {domain.status === 'pending_ns' && (
                          <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-yellow-400">
                              Update these nameservers at your domain registrar, then click "Check Status" to verify
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Subdomain Management */}
                    {domain.status === 'active' && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-white">
                            Subdomains ({domainSubdomains.length}/7)
                          </h4>
                          <button
                            onClick={() => {
                              setSelectedDomainForSubdomain(domain);
                              setShowSubdomainModal(true);
                            }}
                            disabled={domainSubdomains.length >= 7}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-3 w-3" />
                            Add Subdomain
                          </button>
                        </div>
                        
                        {domainSubdomains.length === 0 ? (
                          <p className="text-sm text-white/40 text-center py-4 bg-white/5 rounded-lg">
                            No subdomains added yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {domainSubdomains.map((subdomain) => (
                              <div
                                key={subdomain.id}
                                className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-medium text-white font-mono">
                                    {subdomain.subdomain}.{domain.name}
                                  </p>
                                  <p className="text-xs text-white/40 mt-0.5">
                                    Added {new Date(subdomain.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteSubdomain(domain.id, subdomain.id, subdomain.subdomain)}
                                  className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Additional Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-white/50">CF Account</p>
                        <p className="text-white mt-1">{domain.cfAccountName || '—'}</p>
                      </div>
                      <div>
                        <p className="text-white/50">Created</p>
                        <p className="text-white mt-1">{new Date(domain.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Domain Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#151823] border border-white/10 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add New Domain</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDomainName('');
                }}
                disabled={adding}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">
              This will create a Cloudflare zone, configure DNS, and set up Turnstile security automatically.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Domain Name
                </label>
                <input
                  type="text"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="example.com"
                  disabled={adding}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#4F7FFF] focus:ring-1 focus:ring-[#4F7FFF] disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !adding) {
                      handleAddDomain();
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDomainName('');
                }}
                disabled={adding}
                className="flex-1 px-4 py-2 border border-white/10 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDomain}
                disabled={adding || !newDomainName.trim()}
                className="flex-1 px-4 py-2 bg-[#4F7FFF] text-white rounded-lg hover:bg-[#3d6ee0] transition-colors disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Domain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subdomain Modal */}
      {showSubdomainModal && selectedDomainForSubdomain && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#151823] border border-white/10 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Add Subdomain</h2>
              <button
                onClick={() => {
                  setShowSubdomainModal(false);
                  setNewSubdomainName('');
                  setSelectedDomainForSubdomain(null);
                }}
                disabled={addingSubdomain}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">
              Add a subdomain to <span className="font-semibold text-white">{selectedDomainForSubdomain.name}</span> (maximum 7 per domain)
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Subdomain Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubdomainName}
                    onChange={(e) => setNewSubdomainName(e.target.value)}
                    placeholder="accounts"
                    disabled={addingSubdomain}
                    className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#4F7FFF] focus:ring-1 focus:ring-[#4F7FFF] disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !addingSubdomain) {
                        handleAddSubdomain();
                      }
                    }}
                  />
                  <span className="text-white/60 text-sm">.{selectedDomainForSubdomain.name}</span>
                </div>
                <p className="text-xs text-white/40 mt-2">
                  Enter only the subdomain part (e.g., "accounts" for accounts.{selectedDomainForSubdomain.name})
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSubdomainModal(false);
                  setNewSubdomainName('');
                  setSelectedDomainForSubdomain(null);
                }}
                disabled={addingSubdomain}
                className="flex-1 px-4 py-2 border border-white/10 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSubdomain}
                disabled={addingSubdomain || !newSubdomainName.trim()}
                className="flex-1 px-4 py-2 bg-[#4F7FFF] text-white rounded-lg hover:bg-[#3d6ee0] transition-colors disabled:opacity-50"
              >
                {addingSubdomain ? 'Adding...' : 'Add Subdomain'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
