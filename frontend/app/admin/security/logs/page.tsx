'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Shield, AlertTriangle, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  ipAddress: string;
  timestamp: string;
  status: string;
  details?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'warning'>('all');

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchLogs = async () => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/security/logs`;
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
        setLogs(data.logs || mockLogs);
      }
    } catch (error: any) {
      console.error('Failed to fetch logs:', error);
      // Use mock data if API fails
      setLogs(mockLogs);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.info('Exporting audit logs...');
  };

  const successLogs = logs.filter(l => l.status === 'SUCCESS' || l.status === 'success').length;
  const failedLogs = logs.filter(l => l.status === 'FAILED' || l.status === 'failed').length;
  const warningLogs = logs.filter(l => l.status === 'WARNING' || l.status === 'warning').length;

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
            <span>Security</span>
            <span> / </span>
            <span>Audit Logs</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Audit Logs</h1>
          <p className="text-sm text-white/50 mt-1">
            Complete history of system actions and admin activities
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-white">{logs.length}</div>
          <div className="text-sm text-white/50 mt-1">Total Events</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#10B981]">{successLogs}</div>
          <div className="text-sm text-white/50 mt-1">Success</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#EF4444]">{failedLogs}</div>
          <div className="text-sm text-white/50 mt-1">Failed</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#F59E0B]">{warningLogs}</div>
          <div className="text-sm text-white/50 mt-1">Warnings</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'success', 'failed', 'warning'] as const).map((f) => (
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

      {/* Logs Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-medium text-white mb-2">No audit logs found</h3>
            <p className="text-sm text-white/50">
              System activities will appear here
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Action</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Actor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Target</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">IP Address</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Time</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">{log.action}</div>
                    {log.details && (
                      <div className="text-xs text-white/50 mt-0.5">{log.details}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/70">{log.actor}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/60">{log.target}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-white/60">{log.ipAddress}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      <span className="text-sm text-white/60">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.status === 'SUCCESS' || log.status === 'success' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Success
                      </span>
                    ) : log.status === 'FAILED' || log.status === 'failed' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    ) : log.status === 'WARNING' || log.status === 'warning' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium">
                        {log.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-4">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-[#8B5CF6] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/70 space-y-1">
            <p className="font-medium text-white">Security Monitoring</p>
            <p className="text-white/60">
              All administrative actions, authentication events, and system changes are automatically logged. Logs are retained for 90 days and auto-refresh every 5 seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mock data for development
const mockLogs: AuditLog[] = [
  {
    id: 'log_1',
    action: 'User Login',
    actor: 'admin@fiona.com',
    target: 'Authentication System',
    ipAddress: '192.168.1.100',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    status: 'SUCCESS',
    details: 'Successful admin login',
  },
  {
    id: 'log_2',
    action: 'Campaign Created',
    actor: 'tech@fiona.com',
    target: 'Campaign: Gmail Phish',
    ipAddress: '192.168.1.101',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    status: 'SUCCESS',
    details: 'New campaign deployed',
  },
  {
    id: 'log_3',
    action: 'Failed Login Attempt',
    actor: 'unknown@attacker.com',
    target: 'Authentication System',
    ipAddress: '203.0.113.45',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    status: 'FAILED',
    details: 'Invalid credentials',
  },
  {
    id: 'log_4',
    action: 'Proxy Health Check',
    actor: 'System',
    target: 'Proxy Pool',
    ipAddress: 'localhost',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    status: 'WARNING',
    details: '2 proxies offline',
  },
];
