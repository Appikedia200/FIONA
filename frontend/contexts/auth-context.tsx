'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import wsClient from '@/lib/websocket-client';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TECHNICIAN';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTechnician: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in on mount
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          // Call GET /api/auth/profile to verify token and get user
          const response = await apiClient.getProfile();
          if (response.data && response.data.user) {
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            // Connect WebSocket
            wsClient.connect(response.data.user.id, response.data.user.role);
          }
        } catch (err: any) {
          if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('fiona_token');
            router.replace('/login');
          }
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });

      if (response.data.success) {
        const { token, user: userData } = response.data;
        
        // Store token and user in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        
        setUser(userData);

        // Connect WebSocket
        wsClient.connect(userData.id, userData.role);

        // Redirect based on role
        if (userData.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      wsClient.disconnect();
      router.push('/login');
    }
  };

  const register = async (email: string, fullName: string, password: string) => {
    try {
      const response = await apiClient.register({ email, fullName, password });

      if (response.data.success) {
        // Registration successful - redirect to pending page
        router.push('/pending-approval');
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Registration failed');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isTechnician: user?.role === 'TECHNICIAN',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
