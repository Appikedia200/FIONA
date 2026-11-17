'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard,
  Activity,
  Users,
  Target,
  Rocket,
  Globe,
  Zap,
  Network,
  ShieldAlert,
  Eye,
  ScrollText,
  BarChart3,
  Settings,
  UserCheck,
  Cloud,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState('');
  const [activeSessions, setActiveSessions] = useState(0);

  // Auth guard with loading state
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    if (!loading && user && !isAdmin) {
      router.replace('/dashboard');
      return;
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getUTCHours().toString().padStart(2, '0');
      const minutes = now.getUTCMinutes().toString().padStart(2, '0');
      const seconds = now.getUTCSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return; // Don't fetch if not authenticated

    const fetchActiveSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/stats`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await response.json();
        if (data.success) {
          setActiveSessions(data.stats?.liveSessions || 0);
        }
      } catch (error) {
        console.error('Failed to fetch active sessions:', error);
      }
    };
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Show loading spinner while auth is resolving
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0C0E14',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '2px solid #4F7FFF',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Don't render layout if not authenticated
  if (!user || !isAdmin) {
    return null;
  }

  const navigation = {
    main: [
      { name: 'Overview', href: '/admin', icon: LayoutDashboard },
      { name: 'Campaigns', href: '/admin/campaigns', icon: Target },
      { name: 'Sessions', href: '/admin/sessions', icon: Activity, showBadge: true },
      { name: 'Technicians', href: '/admin/technicians', icon: Users },
    ],
    infrastructure: [
      { name: 'Deployments', href: '/admin/deployments', icon: Rocket },
      { name: 'Domains', href: '/admin/domains', icon: Globe },
      { name: 'Workers', href: '/admin/infrastructure/workers', icon: Zap },
      { name: 'Proxies', href: '/admin/infrastructure/proxies', icon: Network },
    ],
    security: [
      { name: 'Profiles', href: '/admin/profiles', icon: UserCheck },
      { name: 'IP Shield', href: '/admin/security/ip-shield', icon: ShieldAlert },
      { name: 'Threat Monitor', href: '/admin/security/threats', icon: Eye },
      { name: 'Audit Logs', href: '/admin/security/logs', icon: ScrollText },
    ],
    system: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
      { name: 'Cloudflare', href: '/admin/settings/cloudflare', icon: Cloud },
    ],
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(href);
  };

  const getPageTitle = () => {
    const allItems = [
      ...navigation.main,
      ...navigation.infrastructure,
      ...navigation.security,
      ...navigation.system,
    ];
    const route = allItems.find((n) => isActive(n.href));
    return route?.name || 'Admin';
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0C0E14', overflow: 'hidden' }}>
      {/* TOPBAR - Full width, above everything */}
      <div
        style={{
          height: '48px',
          backgroundColor: '#12151E',
          borderBottom: '1px solid #1E2433',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: '24px',
          paddingRight: '24px',
          flexShrink: 0,
        }}
      >
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.25em',
              color: '#E2E8F0',
            }}
          >
            FIONA
          </span>
          <span style={{ color: '#334155', fontSize: '14px' }}>/</span>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: '#64748B',
            }}
          >
            {getPageTitle()}
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Live counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#22D3A5',
                animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: '12px',
                color: '#22D3A5',
              }}
            >
              {activeSessions} sessions active
            </span>
          </div>

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', backgroundColor: '#1E2433' }} />

          {/* UTC Clock */}
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: '12px',
              color: '#64748B',
            }}
          >
            {currentTime}
          </span>

          {/* Separator */}
          <div style={{ width: '1px', height: '20px', backgroundColor: '#1E2433' }} />

          {/* User avatar */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#1A1E2E',
              border: '1px solid #252A3A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '11px',
              color: '#94A3B8',
            }}
          >
            {getInitials(user.email)}
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER - Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <aside
          style={{
            width: '220px',
            backgroundColor: '#0F1219',
            borderRight: '1px solid #1E2433',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
            overflowY: 'auto',
          }}
        >
          {/* Navigation sections */}
          <nav style={{ padding: '12px 0' }}>
            {/* Section 1 - Top nav (no label) */}
            <div style={{ marginBottom: '24px' }}>
              {navigation.main.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      paddingLeft: active ? '14px' : '16px',
                      paddingRight: '16px',
                      gap: '12px',
                      color: active ? '#E2E8F0' : '#4A5568',
                      backgroundColor: active ? '#161B22' : 'transparent',
                      borderLeft: active ? '2px solid #4F7FFF' : 'none',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13.5px',
                      fontWeight: 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.backgroundColor = '#161B22';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#4A5568';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? '#4F7FFF' : 'inherit' }} />
                    {item.name}
                    {item.showBadge && activeSessions > 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontFamily: '"Geist Mono", monospace',
                          fontSize: '10px',
                          paddingLeft: '6px',
                          paddingRight: '6px',
                          paddingTop: '1px',
                          paddingBottom: '1px',
                          borderRadius: '3px',
                          backgroundColor: '#0D2E1A',
                          color: '#22D3A5',
                        }}
                      >
                        {activeSessions}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Section 2 - Infrastructure */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  fontWeight: 400,
                  color: '#334155',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  marginTop: '24px',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Infrastructure
              </div>
              {navigation.infrastructure.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      paddingLeft: active ? '14px' : '16px',
                      paddingRight: '16px',
                      gap: '12px',
                      color: active ? '#E2E8F0' : '#4A5568',
                      backgroundColor: active ? '#161B22' : 'transparent',
                      borderLeft: active ? '2px solid #4F7FFF' : 'none',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13.5px',
                      fontWeight: 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.backgroundColor = '#161B22';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#4A5568';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? '#4F7FFF' : 'inherit' }} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Section 3 - Security */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  fontWeight: 400,
                  color: '#334155',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  marginTop: '24px',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Security
              </div>
              {navigation.security.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      paddingLeft: active ? '14px' : '16px',
                      paddingRight: '16px',
                      gap: '12px',
                      color: active ? '#E2E8F0' : '#4A5568',
                      backgroundColor: active ? '#161B22' : 'transparent',
                      borderLeft: active ? '2px solid #4F7FFF' : 'none',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13.5px',
                      fontWeight: 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.backgroundColor = '#161B22';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#4A5568';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? '#4F7FFF' : 'inherit' }} />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Section 4 - System */}
            <div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  fontWeight: 400,
                  color: '#334155',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  marginTop: '24px',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                System
              </div>
              {navigation.system.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: '36px',
                      paddingLeft: active ? '14px' : '16px',
                      paddingRight: '16px',
                      gap: '12px',
                      color: active ? '#E2E8F0' : '#4A5568',
                      backgroundColor: active ? '#161B22' : 'transparent',
                      borderLeft: active ? '2px solid #4F7FFF' : 'none',
                      textDecoration: 'none',
                      transition: 'all 0.15s',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13.5px',
                      fontWeight: 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#94A3B8';
                        e.currentTarget.style.backgroundColor = '#161B22';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = '#4A5568';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} style={{ color: active ? '#4F7FFF' : 'inherit' }} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Bottom user section */}
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid #1E2433',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                fontFamily: '"Geist Mono", monospace',
                fontSize: '10px',
                paddingLeft: '8px',
                paddingRight: '8px',
                paddingTop: '2px',
                paddingBottom: '2px',
                backgroundColor: '#1A1E2E',
                border: '1px solid #252A3A',
                borderRadius: '3px',
                color: '#4F7FFF',
                marginBottom: '8px',
              }}
            >
              Admin
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                color: '#64748B',
                marginBottom: '12px',
                wordBreak: 'break-all',
              }}
            >
              {user.email}
            </div>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#EF4444',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#0C0E14',
            padding: '32px',
          }}
        >
          {children}
        </main>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}
