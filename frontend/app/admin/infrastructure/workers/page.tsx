'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Plus, Activity, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Worker {
  id: string;
  name: string;
  type: string;
  status: string;
  requestsPerMinute: number;
  lastRun?: string;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(fetchWorkers, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchWorkers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/workers`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json();
      if (data.success) {
        setWorkers(data.workers || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch workers:', error);
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const runningWorkers = workers.filter(w => w.status === 'RUNNING' || w.status === 'running' || w.status === 'live').length;
  const totalRequests = workers.reduce((sum, w) => sum + (w.requestsPerMinute || 0), 0);

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
            <span>Workers</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Workers</h1>
          <p className="mt-1 text-sm text-white/50">System workers managing infrastructure</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Workers</p>
          <p className="mt-2 text-3xl font-bold text-white">{workers.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Running</p>
          <p className="mt-2 text-3xl font-bold text-white">{runningWorkers}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Requests/min</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalRequests}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Avg Response Time</p>
          <p className="mt-2 text-3xl font-bold text-white">45ms</p>
        </div>
      </div>

      {/* Workers Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-white">Active Workers</h2>
          <p className="text-xs text-white/50">{workers.length} total</p>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/50">System workers initializing</p>
            <p className="mt-1 text-xs text-white/30">Background services will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Worker Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">Requests/min</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {workers.map((worker) => (
                <tr key={worker.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">{worker.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/70">{worker.type}</td>
                  <td className="px-6 py-4">
                    {worker.status === 'RUNNING' || worker.status === 'running' || worker.status === 'live' ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        Running
                      </span>
                    ) : worker.status === 'IDLE' || worker.status === 'idle' ? (
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                        Idle
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        Stopped
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-mono text-white">{worker.requestsPerMinute || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-white/60">
                    {worker.lastRun ? new Date(worker.lastRun).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
