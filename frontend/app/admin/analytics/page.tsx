'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BarChart3, TrendingUp, Clock, Target, Activity, Database, Award, ArrowLeft, Globe, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  success: boolean;
  range: string;
  capturesByDay: Array<{ date: string; count: number }>;
  topDomains: Array<{ domain: string; captures: number }>;
  topCampaigns: Array<{ name: string; captures: number }>;
  sessionsByStatus: Array<{ status: string; count: number }>;
  geoBreakdown: Array<{ country: string; requests: number }>;
  requestsByHour: Array<{ hour: number; requests: number }>;
  botBlocked: number;
  uniqueIPs: number;
  totalRequests: number;
}

import apiClient from '@/lib/api-client';

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');

  const { data, error, isLoading } = useSWR<AnalyticsData>(
    `/api/admin/analytics?range=${range}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  if (error) {
    toast.error('Failed to load analytics');
  }

  const totalCaptures = data?.capturesByDay.reduce((sum, day) => sum + day.count, 0) || 0;
  const totalCampaigns = data?.topCampaigns.length || 0;
  const avgCapturesPerDay = data?.capturesByDay.length
    ? (totalCaptures / data.capturesByDay.length).toFixed(1)
    : '0';

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
            <span>Analytics</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-white/50 mt-1">Platform performance metrics and insights</p>
        </div>

        {/* Range Selector */}
        <div className="flex gap-2 rounded-lg border border-white/10 bg-[#151823] p-1">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-[#4F7FFF] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <p className="text-white/50">No analytics data available</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#4F7FFF]/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-[#4F7FFF]" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white mb-1">{totalCaptures}</div>
              <div className="text-sm text-white/50">Total Captures</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-[#10B981]" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white mb-1">{data.totalRequests}</div>
              <div className="text-sm text-white/50">Total Requests</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-[#8B5CF6]" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white mb-1">{data.uniqueIPs}</div>
              <div className="text-sm text-white/50">Unique IPs</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-[#F59E0B]" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white mb-1">{data.botBlocked}</div>
              <div className="text-sm text-white/50">Bots Blocked</div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Captures Over Time */}
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#4F7FFF]/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[#4F7FFF]" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Captures Over Time</h2>
                  <p className="text-sm text-white/50">Daily capture activity</p>
                </div>
              </div>

              {data.capturesByDay.length > 0 ? (
                <div className="space-y-2">
                  {data.capturesByDay.map((day, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="text-xs text-white/50 w-24 font-mono">{day.date}</div>
                      <div className="flex-1 h-8 rounded-lg bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-[#4F7FFF]/30 rounded-lg transition-all"
                          style={{
                            width: `${(day.count / Math.max(...data.capturesByDay.map(d => d.count))) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="text-sm text-white w-12 text-right">{day.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 text-white/20" />
                    <p className="text-sm text-white/50">No capture data available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Top Campaigns */}
            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Top Campaigns</h2>
                  <p className="text-sm text-white/50">Most active campaigns</p>
                </div>
              </div>

              {data.topCampaigns && data.topCampaigns.length > 0 ? (
                <div className="space-y-3">
                  {data.topCampaigns.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#4F7FFF]/10 flex items-center justify-center text-xs font-medium text-[#4F7FFF]">
                          {i + 1}
                        </div>
                        <span className="text-sm text-white truncate">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{item.captures}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/50 text-sm">
                  No campaigns yet
                </div>
              )}
            </div>
          </div>

          {/* Geographic Breakdown */}
          {data.geoBreakdown && data.geoBreakdown.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Geographic Distribution</h2>
                  <p className="text-sm text-white/50">Top countries by requests</p>
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-4">
                {data.geoBreakdown.map((geo, i) => (
                  <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-2xl font-semibold text-white mb-1">{geo.country}</div>
                    <div className="text-sm text-white/50 mb-2">{geo.requests} requests</div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#8B5CF6] rounded-full"
                        style={{
                          width: `${(geo.requests / Math.max(...data.geoBreakdown.map(g => g.requests))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requests by Hour Heatmap */}
          {data.requestsByHour && data.requestsByHour.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-white">Activity by Hour</h2>
                  <p className="text-sm text-white/50">Requests distribution over 24 hours</p>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
                {data.requestsByHour.map((hour) => (
                  <div key={hour.hour} className="text-center">
                    <div
                      className="h-16 rounded-lg bg-[#10B981] mb-2 transition-all hover:opacity-80"
                      style={{
                        opacity: hour.requests > 0 
                          ? 0.3 + (hour.requests / Math.max(...data.requestsByHour.map(h => h.requests))) * 0.7
                          : 0.1,
                      }}
                      title={`${hour.hour}:00 - ${hour.requests} requests`}
                    />
                    <div className="text-xs text-white/40">{hour.hour}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
