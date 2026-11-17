'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0C0E14',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#12151E',
          border: '1px solid #1E2433',
          borderRadius: '12px',
          padding: '48px 40px',
        }}
      >
        <div
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontWeight: 600,
            fontSize: '18px',
            letterSpacing: '0.2em',
            color: '#E2E8F0',
            marginBottom: '48px',
            textAlign: 'center',
          }}
        >
          FIONA
        </div>

        <div
          style={{
            fontSize: '15px',
            color: '#64748B',
            marginBottom: '32px',
            textAlign: 'center',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Authentication Control Plane
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: '14px 16px',
                marginBottom: '24px',
                backgroundColor: '#2D0A0A',
                color: '#EF4444',
                border: '1px solid #EF4444',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: '#94A3B8',
                marginBottom: '10px',
              }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              placeholder="operator@fiona.local"
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: '#0C0E14',
                border: '1px solid #1E2433',
                borderRadius: '8px',
                color: '#E2E8F0',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '15px',
                padding: '0 16px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4F7FFF';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#1E2433';
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: '#94A3B8',
                marginBottom: '10px',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Enter your password"
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: '#0C0E14',
                border: '1px solid #1E2433',
                borderRadius: '8px',
                color: '#E2E8F0',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '15px',
                padding: '0 16px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4F7FFF';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#1E2433';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: loading ? '#3D6EE8' : '#4F7FFF',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#3D6EE8';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#4F7FFF';
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: '"Geist Mono", monospace',
          fontWeight: 400,
          fontSize: '12px',
          color: '#334155',
        }}
      >
        FIONA v1.2.4
      </div>
    </div>
  );
}
