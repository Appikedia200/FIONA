'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Target,
  Globe,
  Layers,
  Database,
  BarChart3,
  Settings,
  LogOut
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAdmin, isTechnician, loading } = useAuth();
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
    if (!loading && user && isAdmin) {
      router.replace('/admin');
      return;
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toUTCString().slice(17, 25) + ' UTC');
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
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/sessions?status=active`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await response.json();
        if (data.success) {
          setActiveSessions(data.sessions?.length || 0);
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
  if (!user || isAdmin) {
    return null;
  }

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', href: '/campaigns', icon: Target },
    { name: 'Deployments', href: '/deployments', icon: Globe },
    { name: 'Domains', href: '/domains', icon: Layers },
    { name: 'Profiles', href: '/profiles', icon: Database },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(href);
  };

  const getPageTitle = () => {
    const route = navigation.find(n => isActive(n.href));
    return route?.name || 'Dashboard';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0C0E14' }}>
      <aside 
        style={{ 
          width: '220px',
          backgroundColor: '#12151E',
          borderRight: '1px solid #1E2433',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
        }}
      >
        <div 
          style={{ 
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '20px',
            borderBottom: '1px solid #1E2433',
          }}
        >
          <span 
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.2em',
              color: '#E2E8F0',
            }}
          >
            FIONA
          </span>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navigation.map((item) => {
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
                  paddingLeft: active ? '18px' : '20px',
                  gap: '12px',
                  color: active ? '#E2E8F0' : '#64748B',
                  backgroundColor: active ? '#1A1E2E' : 'transparent',
                  borderLeft: active ? '2px solid #4F7FFF' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#94A3B8';
                    e.currentTarget.style.backgroundColor = '#161B22';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#64748B';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon size={16} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div 
          style={{ 
            padding: '16px',
            borderTop: '1px solid #1E2433',
          }}
        >
          <div 
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              backgroundColor: '#1A1E2E',
              border: '1px solid #1E2433',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          >
            <span 
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: '11px',
                color: '#64748B',
              }}
            >
              Technician
            </span>
          </div>
          <div 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              color: '#94A3B8',
              marginBottom: '12px',
            }}
          >
            {user.email}
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#EF4444',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <div style={{ marginLeft: '220px', flex: 1 }}>
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
          }}
        >
          <div 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              color: '#E2E8F0',
            }}
          >
            {getPageTitle()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div 
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#22D3A5',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              />
              <span 
                style={{
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '12px',
                  color: '#22D3A5',
                }}
              >
                {activeSessions} active
              </span>
            </div>
            <span 
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: '12px',
                color: '#64748B',
              }}
            >
              {currentTime}
            </span>
          </div>
        </div>

        <main style={{ padding: '24px' }}>
          {children}
        </main>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
