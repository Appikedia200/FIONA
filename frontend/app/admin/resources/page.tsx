'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import wsClient from '@/lib/websocket-client';
import { Activity, Cpu, HardDrive, Database, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';

interface ResourceStats {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    percentage: string;
  };
  cpu: {
    user: number;
    system: number;
  };
  sessions: {
    active: number;
    max: number;
    percentage: string;
    canStartNew: boolean;
  };
  profiles: {
    launched: number;
    max: number;
    percentage: string;
    canLaunchNew: boolean;
  };
  uptime: number;
}

interface Warning {
  id: string;
  type: string;
  message: string;
  severity: 'warning' | 'critical';
  timestamp: string;
}

export default function ResourcesPage() {
  const [stats, setStats] = useState<ResourceStats | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    wsClient.onSystemStats((data) => {
      setStats(data);
    });

    wsClient.onResourceWarning((data) => {
      const warning: Warning = {
        id: Date.now().toString(),
        type: data.warningType,
        message: data.message,
        severity: data.severity,
        timestamp: data.timestamp,
      };
      setWarnings((prev) => [warning, ...prev].slice(0, 50));
    });

    const interval = setInterval(loadStats, 5000);

    return () => {
      clearInterval(interval);
      wsClient.offSystemStats();
      wsClient.offResourceWarning();
    };
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiClient.getAdminResourceStats();
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-6">
      {/* Header */}
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
            <span>Resource Monitor</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Resource Monitor</h1>
          <p className="mt-1 text-sm text-white/50">Real-time VPS resource monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm text-white/50">Live Updates</span>
        </div>
      </div>

      {/* Stat Cards - 4 Column Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">System Uptime</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats ? formatUptime(stats.uptime) : '--'}
          </p>
          <p className="mt-1 text-xs text-emerald-400">System stable</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Memory Usage</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats ? stats.memory.percentage : '--'}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {stats ? `${stats.memory.heapUsed} / ${stats.memory.heapTotal} MB` : '--'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Active Sessions</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats ? `${stats.sessions.active} / ${stats.sessions.max}` : '--'}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {stats ? stats.sessions.percentage : '--'} capacity
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <p className="text-sm text-white/50">Launched Profiles</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {stats ? `${stats.profiles.launched} / ${stats.profiles.max}` : '--'}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {stats ? stats.profiles.percentage : '--'} capacity
          </p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Memory Details */}
        <div className="rounded-xl border border-white/10 bg-[#151823]">
          <div className="border-b border-white/10 p-6">
            <h2 className="text-lg font-medium text-white">Memory Breakdown</h2>
            <p className="mt-1 text-sm text-white/50">Detailed memory usage metrics</p>
          </div>
          <div className="p-6 space-y-4">
            {stats && (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">Heap Used</span>
                    <span className="font-semibold text-white">{stats.memory.heapUsed} MB</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div
                      className="bg-[#4F7FFF] h-2 rounded-full transition-all duration-500"
                      style={{ width: stats.memory.percentage }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">Total RSS (Resident Set)</span>
                    <span className="font-semibold text-white">{stats.memory.rss} MB</span>
                  </div>
                  <div className="text-xs text-white/30">
                    Total memory allocated by OS
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">External Memory</span>
                    <span className="font-semibold text-white">{stats.memory.external} MB</span>
                  </div>
                  <div className="text-xs text-white/30">
                    C++ objects bound to JavaScript
                  </div>
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  parseFloat(stats.memory.percentage) > 85 
                    ? 'bg-red-500/10 text-red-400' 
                    : parseFloat(stats.memory.percentage) > 70
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {parseFloat(stats.memory.percentage) > 85 ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Critical: Memory cleanup recommended</span>
                    </>
                  ) : parseFloat(stats.memory.percentage) > 70 ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Warning: High memory usage</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Memory usage healthy</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Capacity Status */}
        <div className="rounded-xl border border-white/10 bg-[#151823]">
          <div className="border-b border-white/10 p-6">
            <h2 className="text-lg font-medium text-white">Capacity Status</h2>
            <p className="mt-1 text-sm text-white/50">Session and profile limits</p>
          </div>
          <div className="p-6 space-y-4">
            {stats && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-white">Capture Sessions</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      stats.sessions.canStartNew 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {stats.sessions.canStartNew ? 'Available' : 'At Capacity'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        parseFloat(stats.sessions.percentage) > 80 
                          ? 'bg-red-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: stats.sessions.percentage }}
                    />
                  </div>
                  <div className="text-xs text-white/30">
                    {stats.sessions.active} of {stats.sessions.max} sessions active
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-white">Launched Profiles</span>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      stats.profiles.canLaunchNew 
                        ? 'bg-emerald-500/10 text-emerald-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {stats.profiles.canLaunchNew ? 'Available' : 'At Capacity'}
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        parseFloat(stats.profiles.percentage) > 80 
                          ? 'bg-red-500' 
                          : 'bg-purple-500'
                      }`}
                      style={{ width: stats.profiles.percentage }}
                    />
                  </div>
                  <div className="text-xs text-white/30">
                    {stats.profiles.launched} of {stats.profiles.max} profiles launched
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400">
                  <Activity className="h-4 w-4 flex-shrink-0" />
                  <div className="text-xs">
                    Idle sessions cleanup after 8 minutes • Profile cleanup after 30 minutes of inactivity
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Resource Warnings */}
      <div className="rounded-xl border border-white/10 bg-[#151823]">
        <div className="border-b border-white/10 p-6">
          <h2 className="text-lg font-medium text-white">Resource Warnings</h2>
          <p className="mt-1 text-sm text-white/50">Recent system alerts and warnings</p>
        </div>
        <div className="p-6">
          {warnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-white/20" />
              <p className="mt-3 text-sm font-medium text-white/50">No warnings</p>
              <p className="mt-1 text-xs text-white/30">System running smoothly</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    warning.severity === 'critical' 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                    warning.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                  }`} />
                  <div className="flex-1">
                    <div className={`font-semibold text-sm ${
                      warning.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {warning.type.toUpperCase()} Warning
                    </div>
                    <div className="text-sm text-white/70 mt-1">{warning.message}</div>
                    <div className="text-xs text-white/30 mt-2">
                      {new Date(warning.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
