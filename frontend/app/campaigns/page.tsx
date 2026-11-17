'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import CustomSelect from '@/components/CustomSelect';
import ConfirmModal from '@/components/ConfirmModal';
import { Plus, Target, Play, Pause, Trash2, Copy, Globe, ArrowLeft, Eye, Monitor, Smartphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  provider: string;
  status: 'ACTIVE' | 'PAUSED';
  captureId: string;
  description?: string;
  createdAt: string;
  deploymentCount: number;
  viewCount: number;
  captureCount: number;
}

interface CampaignsResponse {
  success: boolean;
  campaigns: Campaign[];
  total?: number;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function CampaignsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    provider: 'GOOGLE',
    description: '',
    domainId: '',
    profileId: '',
  });
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; campaignId: string; campaignName: string }>({
    isOpen: false,
    campaignId: '',
    campaignName: '',
  });

  const swrKey = '/api/campaigns';
  const { data, error, isLoading } = useSWR<CampaignsResponse>(swrKey, fetcher);
  const { data: domainsData } = useSWR('/api/domains', fetcher);
  const { data: profilesData } = useSWR('/api/profiles', fetcher);

  const campaigns = data?.campaigns || [];
  const domains = domainsData?.domains || [];
  const profiles = profilesData?.profiles || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    
    setCreating(true);
    try {
      const response = await apiClient.createCampaign({
        name: newCampaign.name.trim(),
        provider: newCampaign.provider,
        description: newCampaign.description.trim() || undefined,
        domainId: newCampaign.domainId || undefined,
        profileId: newCampaign.profileId || undefined,
      });
      if (response.status === 201 || response.status === 200) {
        toast.success('Campaign created successfully');
        setShowCreateDialog(false);
        setNewCampaign({ name: '', provider: 'GOOGLE', description: '', domainId: '', profileId: '' });
        // Re-fetch campaigns after creation
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setActionLoading(id);
    
    try {
      const response = await apiClient.toggleCampaignStatus(id, newStatus);
      if (response.status === 200) {
        toast.success(`Campaign ${newStatus === 'ACTIVE' ? 'activated' : 'paused'}`);
        // Re-fetch campaigns after status change
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to toggle status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await apiClient.deleteCampaign(id);
      // Only show success if backend returned 200
      if (response.status === 200 && response.data.success) {
        toast.success('Campaign deleted');
        // Re-fetch campaigns AFTER backend confirms deletion
        mutate(swrKey);
      } else {
        toast.error('Delete failed - no confirmation from server');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div>
          {/* Back Link */}
          <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          {/* Breadcrumb */}
          <div className="mb-2 text-sm text-white/50">
            <Link href="/dashboard" className="hover:text-white/70 transition-colors cursor-pointer">Dashboard</Link>
            <span> / </span>
            <span>Campaigns</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#E2E8F0', margin: 0 }}>Campaigns</h1>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
            Create and manage your capture campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#4F7FFF',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background-color 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3d6ee0'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F7FFF'}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          Create Campaign
        </button>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>Total Campaigns</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
            {campaigns.length}
          </p>
        </div>
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>Active</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
            {campaigns.filter(c => c.status === 'ACTIVE').length}
          </p>
        </div>
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>Deployments</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
            {campaigns.reduce((sum, c) => sum + (c.deploymentCount || 0), 0)}
          </p>
        </div>
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>Total Captures</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
            {campaigns.reduce((sum, c) => sum + (c.captureCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Campaigns Table */}
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid #4F7FFF',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)'
        }}>
          <p style={{ color: '#EF4444' }}>Failed to load campaigns</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center'
        }}>
          <Target style={{ width: '64px', height: '64px', color: 'rgba(255, 255, 255, 0.2)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', marginBottom: '8px' }}>
            No campaigns yet
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginBottom: '24px' }}>
            Create your first campaign to start capturing credentials
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#4F7FFF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
              <tr>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Campaign</th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Target Org</th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Capture ID</th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Status</th>
                <th style={{
                  textAlign: 'center',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Deployments</th>
                <th style={{
                  textAlign: 'center',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Captures</th>
                <th style={{
                  textAlign: 'left',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Created</th>
                <th style={{
                  textAlign: 'right',
                  padding: '12px 24px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, idx) => (
                <tr
                  key={campaign.id}
                  style={{
                    borderTop: idx > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontWeight: 500, color: '#FFFFFF' }}>{campaign.name}</div>
                    {campaign.description && (
                      <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '2px' }}>
                        {campaign.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#FFFFFF'
                      }}>
                        {campaign.provider === 'GOOGLE' ? 'G' : campaign.provider[0]}
                      </div>
                      <span style={{ fontSize: '14px', color: '#FFFFFF' }}>{campaign.provider}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ fontSize: '14px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.7)' }}>
                        {campaign.captureId}
                      </code>
                      <button
                        onClick={() => copyToClipboard(campaign.captureId, 'Capture ID')}
                        style={{
                          padding: '4px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Copy ID"
                      >
                        <Copy style={{ width: '14px', height: '14px', color: 'rgba(255, 255, 255, 0.5)' }} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {campaign.status === 'ACTIVE' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#10B981',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#10B981'
                        }} />
                        Active
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.5)'
                        }} />
                        Paused
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>
                      {campaign.deploymentCount || 0}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>
                      {campaign.captureCount || 0}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)' }}>
                      {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setPreviewCampaignId(campaign.id);
                          setShowPreview(true);
                        }}
                        disabled={actionLoading === campaign.id}
                        style={{
                          padding: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: actionLoading === campaign.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === campaign.id ? 0.5 : 1,
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== campaign.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Preview"
                      >
                        <Eye style={{ width: '16px', height: '16px', color: 'rgba(255, 255, 255, 0.7)' }} />
                      </button>
                      <button
                        onClick={() => window.location.href = `/deployments?campaign=${campaign.id}`}
                        disabled={actionLoading === campaign.id}
                        style={{
                          padding: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: actionLoading === campaign.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === campaign.id ? 0.5 : 1,
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== campaign.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Deploy"
                      >
                        <Globe style={{ width: '16px', height: '16px', color: 'rgba(255, 255, 255, 0.7)' }} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                        disabled={actionLoading === campaign.id}
                        style={{
                          padding: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: actionLoading === campaign.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === campaign.id ? 0.5 : 1,
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== campaign.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title={campaign.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                      >
                        {campaign.status === 'ACTIVE' ? (
                          <Pause style={{ width: '16px', height: '16px', color: 'rgba(255, 255, 255, 0.7)' }} />
                        ) : (
                          <Play style={{ width: '16px', height: '16px', color: 'rgba(255, 255, 255, 0.7)' }} />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ isOpen: true, campaignId: campaign.id, campaignName: campaign.name })}
                        disabled={actionLoading === campaign.id}
                        style={{
                          padding: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: actionLoading === campaign.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === campaign.id ? 0.5 : 1,
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== campaign.id) {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete"
                      >
                        <Trash2 style={{ width: '16px', height: '16px', color: '#EF4444' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Dialog */}
      {showCreateDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#151823',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '448px'
          }}>
            <div style={{
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '16px 24px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', margin: 0 }}>
                Create New Campaign
              </h2>
              <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
                Set up a new credential capture campaign
              </p>
            </div>
            
            <form onSubmit={handleCreate} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="name" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  marginBottom: '8px'
                }}>
                  Campaign Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Q1 Security Assessment"
                  required
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0C0E14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                    opacity: creating ? 0.5 : 1,
                    cursor: creating ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F7FFF'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="provider" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  marginBottom: '8px'
                }}>
                  Target Organization *
                </label>
                <CustomSelect
                  value={newCampaign.provider}
                  onChange={(value) => setNewCampaign({ ...newCampaign, provider: value })}
                  options={[
                    { value: 'GOOGLE', label: 'Google' },
                    { value: 'MICROSOFT', label: 'Microsoft' },
                    { value: 'FACEBOOK', label: 'Facebook' },
                    { value: 'YAHOO', label: 'Yahoo' },
                    { value: 'APPLE', label: 'Apple' },
                  ]}
                  disabled={creating}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="description" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  marginBottom: '8px'
                }}>
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  placeholder="Campaign description..."
                  disabled={creating}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0C0E14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                    opacity: creating ? 0.5 : 1,
                    cursor: creating ? 'not-allowed' : 'text'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F7FFF'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="domain" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  marginBottom: '8px'
                }}>
                  Domain (Optional)
                </label>
                <select
                  id="domain"
                  value={newCampaign.domainId}
                  onChange={(e) => setNewCampaign({ ...newCampaign, domainId: e.target.value })}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0C0E14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                    opacity: creating ? 0.5 : 1,
                    cursor: creating ? 'not-allowed' : 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F7FFF'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                >
                  <option value="">Select domain...</option>
                  {domains.map((domain: any) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.4)', marginTop: '4px' }}>
                  Assign campaign to an already-deployed domain
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="profile" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  marginBottom: '8px'
                }}>
                  Profile (Optional)
                </label>
                <select
                  id="profile"
                  value={newCampaign.profileId}
                  onChange={(e) => setNewCampaign({ ...newCampaign, profileId: e.target.value })}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#0C0E14',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    outline: 'none',
                    opacity: creating ? 0.5 : 1,
                    cursor: creating ? 'not-allowed' : 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4F7FFF'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                >
                  <option value="">Select profile...</option>
                  {profiles.map((profile: any) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.email || profile.name}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.4)', marginTop: '4px' }}>
                  Auto-classify captured credentials by account type
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.5 : 1,
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!creating) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#4F7FFF',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.5 : 1,
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!creating) e.currentTarget.style.backgroundColor = '#3d6ee0';
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F7FFF'}
                >
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewCampaignId && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 50
        }}>
          {/* Preview Header */}
          <div style={{
            width: '100%',
            maxWidth: previewDevice === 'desktop' ? '1400px' : '500px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', margin: 0 }}>
                Campaign Preview
              </h2>
              <div style={{ display: 'flex', gap: '4px', backgroundColor: '#151823', borderRadius: '8px', padding: '4px' }}>
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: previewDevice === 'desktop' ? '#4F7FFF' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    transition: 'all 0.15s'
                  }}
                >
                  <Monitor style={{ width: '16px', height: '16px' }} />
                  Desktop
                </button>
                <button
                  onClick={() => setPreviewDevice('mobile')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: previewDevice === 'mobile' ? '#4F7FFF' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    transition: 'all 0.15s'
                  }}
                >
                  <Smartphone style={{ width: '16px', height: '16px' }} />
                  Mobile
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowPreview(false);
                setPreviewCampaignId(null);
                setPreviewDevice('desktop');
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#151823',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#151823'}
            >
              Close Preview
            </button>
          </div>

          {/* Preview Iframe Container */}
          <div style={{
            width: '100%',
            maxWidth: previewDevice === 'desktop' ? '1400px' : '500px',
            height: previewDevice === 'desktop' ? '800px' : '700px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            transition: 'all 0.3s ease-in-out'
          }}>
            <iframe
              src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.fioona.org'}/api/preview/${previewCampaignId}`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              title="Campaign Preview"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, campaignId: '', campaignName: '' })}
        onConfirm={() => handleDelete(deleteConfirm.campaignId)}
        title="Delete Campaign"
        message={`Permanently delete "${deleteConfirm.campaignName}"? This will also delete all associated deployments and captures. This action cannot be undone.`}
        confirmText="Delete Campaign"
        variant="danger"
      />
    </div>
  );
}
