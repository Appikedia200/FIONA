'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { Plus, Target, Play, Edit2, Trash2, Copy, ArrowLeft, X, ExternalLink, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  provider: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  domainId?: string;
  profileId?: string;
  addedById: string;
  captureCount: number;
  viewCount: number;
  createdAt: string;
  domain?: { id: string; name: string };
  profile?: { id: string; name: string; type: string };
  addedBy?: { id: string; fullName?: string; email: string; role: string };
}

interface Domain {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  name: string;
  type: 'GMAIL' | 'GSUITE';
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function AdminCampaignsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null);
  const [previewCampaignName, setPreviewCampaignName] = useState<string>('');

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    provider: 'GOOGLE',
    description: '',
    domainId: '',
    profileId: '',
  });

  const swrKey = '/api/campaigns';
  const { data, error, isLoading } = useSWR(swrKey, fetcher);
  const { data: domainsData } = useSWR('/api/admin/domains', fetcher);
  const { data: profilesData } = useSWR('/api/admin/campaign-profiles', fetcher);

  const campaigns: Campaign[] = data?.campaigns || [];
  const domains: Domain[] = domainsData?.domains || [];
  const profiles: Profile[] = profilesData?.profiles || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    setCreating(true);
    try {
      const response = await apiClient.post('/api/campaigns', {
        name: newCampaign.name.trim(),
        provider: newCampaign.provider,
        description: newCampaign.description.trim() || undefined,
        domainId: newCampaign.domainId || undefined,
        profileId: newCampaign.profileId || undefined,
      });

      if (response.status === 201) {
        toast.success('Campaign created successfully');
        setShowCreateDialog(false);
        setNewCampaign({ name: '', provider: 'GOOGLE', description: '', domainId: '', profileId: '' });
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;

    setDeleting(true);
    try {
      await apiClient.delete(`/api/campaigns/${campaignToDelete.id}`);
      toast.success('Campaign deleted successfully');
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
      mutate(swrKey);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete campaign');
    } finally {
      setDeleting(false);
    }
  };

  const handleLaunch = async (campaignId: string) => {
    setLaunching(campaignId);
    try {
      await apiClient.post(`/api/campaigns/${campaignId}/launch`);
      toast.success('Campaign launched successfully');
      mutate(swrKey);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to launch campaign');
    } finally {
      setLaunching(null);
    }
  };

  const handleDownloadPackage = async (campaignId: string, campaignName: string) => {
    try {
      const response = await apiClient.get(`/api/campaigns/${campaignId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${campaignName.replace(/\s+/g, '-').toLowerCase()}-login-page.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Package downloaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to download package');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-white p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-white/50">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-white p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-400">Error loading campaigns</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-white/50">Manage and monitor your phishing campaigns</p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-3">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.length}</p>
                <p className="text-sm text-white/40">Total Campaigns</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-3">
                <Play className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'active').length}</p>
                <p className="text-sm text-white/40">Active</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-3">
                <Eye className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + (c.viewCount || 0), 0)}</p>
                <p className="text-sm text-white/40">Total Views</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-3">
                <Target className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{campaigns.reduce((sum, c) => sum + (c.captureCount || 0), 0)}</p>
                <p className="text-sm text-white/40">Total Captures</p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns Table */}
        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#151823] p-12 text-center">
            <Target className="h-12 w-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50 mb-4">No campaigns yet</p>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold">All Campaigns</h2>
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Provider</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Profile</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Stats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{campaign.name}</p>
                        {campaign.description && (
                          <p className="text-sm text-white/50 mt-1 line-clamp-1">{campaign.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
                        {campaign.provider}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        campaign.status === 'active'
                          ? 'bg-green-500/10 text-green-400'
                          : campaign.status === 'inactive'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          campaign.status === 'active' ? 'bg-green-400' :
                          campaign.status === 'inactive' ? 'bg-yellow-400' : 'bg-gray-400'
                        }`} />
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/70">
                        {campaign.domain?.name || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {campaign.profile ? (
                        <div>
                          <p className="text-sm text-white/70">{campaign.profile.name}</p>
                          <p className="text-xs text-white/40">{campaign.profile.type}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-white/70">{campaign.viewCount || 0}</p>
                          <p className="text-xs text-white/40">views</p>
                        </div>
                        <div>
                          <p className="text-white/70">{campaign.captureCount || 0}</p>
                          <p className="text-xs text-white/40">captures</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadPackage(campaign.id, campaign.name)}
                          className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
                          title="Download Package"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => {
                            setCampaignToDelete(campaign);
                            setShowDeleteDialog(true);
                          }}
                          className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#151823]">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                    Campaign Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="Q1 Phishing Assessment"
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="provider" className="block text-sm font-medium text-white mb-2">
                    Provider *
                  </label>
                  <select
                    id="provider"
                    value={newCampaign.provider}
                    onChange={(e) => setNewCampaign({ ...newCampaign, provider: e.target.value })}
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4F7FFF] focus:outline-none"
                  >
                    <option value="GOOGLE">Google</option>
                  </select>
                  <p className="text-xs text-white/40 mt-1">
                    Determines which login page template is deployed
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                    placeholder="Campaign details..."
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="domain" className="block text-sm font-medium text-white mb-2">
                    Domain (Optional)
                  </label>
                  <select
                    id="domain"
                    value={newCampaign.domainId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, domainId: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4F7FFF] focus:outline-none"
                  >
                    <option value="">Select domain...</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-1">
                    Assign campaign to an already-deployed domain
                  </p>
                </div>

                <div>
                  <label htmlFor="profile" className="block text-sm font-medium text-white mb-2">
                    Profile (Optional)
                  </label>
                  <select
                    id="profile"
                    value={newCampaign.profileId}
                    onChange={(e) => setNewCampaign({ ...newCampaign, profileId: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4F7FFF] focus:outline-none"
                  >
                    <option value="">Select profile...</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({profile.type})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-1">
                    Auto-classify captured credentials by account type
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteDialog && campaignToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823]">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-white mb-2">Delete Campaign?</h2>
                <p className="text-sm text-white/50 mb-6">
                  Are you sure you want to delete "<span className="text-white">{campaignToDelete.name}</span>"? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteDialog(false);
                      setCampaignToDelete(null);
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
