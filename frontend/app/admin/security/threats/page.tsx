'use client';

import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { Shield, AlertTriangle, CheckCircle, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Threat {
  id: string;
  type: string;
  severity: string;
  source: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface ThreatsResponse {
  success: boolean;
  threats: Threat[];
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function ThreatsPage() {
  const swrKey = '/api/admin/security/threats';
  const { data, error, isLoading } = useSWR<ThreatsResponse>(swrKey, fetcher, {
    refreshInterval: 5000,
  });

  const threats = data?.threats || [];

  const criticalThreats = threats.filter(t => t.severity === 'CRITICAL' || t.severity === 'critical').length;
  const activeThreats = threats.filter(t => !t.resolved).length;
  const resolvedThreats = threats.filter(t => t.resolved).length;

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Page Header */}
      <div className="mb-8">
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
          <span>Threat Monitor</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Threat Monitor</h1>
        <p className="mt-1 text-sm text-white/50">Real-time security threat detection and monitoring</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Total Threats</p>
          <p className="mt-2 text-3xl font-bold text-white">{threats.length}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Critical</p>
          <p className="mt-2 text-3xl font-bold text-white">{criticalThreats}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Active</p>
          <p className="mt-2 text-3xl font-bold text-white">{activeThreats}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Resolved</p>
          <p className="mt-2 text-3xl font-bold text-white">{resolvedThreats}</p>
        </div>
      </div>

      {/* Threats Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-white">Detected Threats</h2>
          <p className="text-xs text-white/50">{activeThreats} active</p>
        </div>

        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-500">Failed to load threats</p>
          </div>
        ) : threats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/50">No threats detected</p>
            <p className="mt-1 text-xs text-white/30">System is secure</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {threats.map((threat) => (
                <tr key={threat.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    {threat.severity === 'CRITICAL' || threat.severity === 'critical' ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        Critical
                      </span>
                    ) : threat.severity === 'HIGH' || threat.severity === 'high' ? (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        High
                      </span>
                    ) : threat.severity === 'MEDIUM' || threat.severity === 'medium' ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        Medium
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                        Low
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">{threat.type}</td>
                  <td className="px-6 py-4 text-sm text-white/70 font-mono">{threat.source}</td>
                  <td className="px-6 py-4 text-sm text-white/70">{threat.description}</td>
                  <td className="px-6 py-4 text-sm text-white/60 font-mono">
                    {new Date(threat.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {threat.resolved ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        Active
                      </span>
                    )}
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
