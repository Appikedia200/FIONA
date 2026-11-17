'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { Users, Activity, Database, Target } from 'lucide-react';

interface Stats {
  totalTechnicians: number;
  activeTechnicians: number;
  pendingApprovals: number;
  totalSessions: number;
  activeSessions: number;
  totalProfiles: number;
  totalCaptures: number;
  activeCampaigns: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiClient.getAdminAnalyticsSummary();
      if (response.data.success) {
        setStats(response.data.summary);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #4F7FFF',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        {/* Breadcrumb */}
        <div className="mb-2 text-sm text-white/50">
          Admin
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#E2E8F0', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
          Platform statistics and system status
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Active Technicians
          </p>
          <p style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '8px 0 0 0'
          }}>
            {stats?.activeTechnicians || 0}
          </p>
          {stats?.pendingApprovals ? (
            <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.3)', marginTop: '4px' }}>
              {stats.pendingApprovals} pending approval
            </p>
          ) : null}
        </div>

        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Live Sessions
          </p>
          <p style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '8px 0 0 0'
          }}>
            {stats?.activeSessions || 0}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.3)', marginTop: '4px' }}>
            {stats?.totalSessions || 0} total
          </p>
        </div>

        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Total Captures
          </p>
          <p style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '8px 0 0 0'
          }}>
            {stats?.totalCaptures || 0}
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.3)', marginTop: '4px' }}>
            {stats?.totalProfiles || 0} profiles
          </p>
        </div>

        <div style={{
          backgroundColor: '#151823',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Active Campaigns
          </p>
          <p style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: '8px 0 0 0'
          }}>
            {stats?.activeCampaigns || 0}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        backgroundColor: '#151823',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '16px 24px'
        }}>
          <h2 style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF', margin: 0 }}>
            Quick Actions
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Common tasks
          </p>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            <a
              href="/admin/technicians"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
            >
              <Users style={{ width: '32px', height: '32px', color: '#4F7FFF' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  Manage Technicians
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '2px' }}>
                  {stats?.pendingApprovals || 0} pending
                </div>
              </div>
            </a>

            <a
              href="/admin/sessions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
            >
              <Activity style={{ width: '32px', height: '32px', color: '#4F7FFF' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  View Sessions
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '2px' }}>
                  {stats?.activeSessions || 0} active
                </div>
              </div>
            </a>

            <a
              href="/admin/analytics"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
            >
              <Database style={{ width: '32px', height: '32px', color: '#4F7FFF' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  Analytics
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '2px' }}>
                  View reports
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
