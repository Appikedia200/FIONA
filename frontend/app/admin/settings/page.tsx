'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { User, Lock, Info, Shield, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  fullName: string;
  email: string;
  role: string;
}

interface SystemInfo {
  version: string;
  environment: string;
  backend: string;
  frontend: string;
  database: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    fullName: '',
    email: user?.email || '',
    role: user?.role || '',
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    version: '1.2.4',
    environment: 'Production',
    backend: 'Node.js + Express',
    frontend: 'Next.js 16',
    database: 'SQLite (Prisma)',
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/settings`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfile(data.profile || profile);
        setSystemInfo(data.systemInfo || systemInfo);
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fullName: profile.fullName }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Profile updated successfully');
      } else {
        toast.error(data.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/admin/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-8 space-y-6">
      {/* Header */}
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
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-white/50 mt-1">Manage your admin account and preferences</p>
      </div>

      {/* Profile Information */}
      <div className="rounded-xl border border-white/10 bg-[#151823]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-[#4F7FFF]/10 flex items-center justify-center">
            <User className="h-5 w-5 text-[#4F7FFF]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Profile Information</h2>
            <p className="text-sm text-white/50">Your admin account details</p>
          </div>
        </div>
        <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Full Name</label>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              className="w-full max-w-md px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4F7FFF] transition-colors"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Email</label>
            <div className="text-sm text-white/60 font-mono">{profile.email}</div>
            <p className="text-xs text-white/40 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Role</label>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-sm font-medium">
              <Shield className="h-3.5 w-3.5" />
              {profile.role}
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 bg-[#4F7FFF] hover:bg-[#3d6ee0] disabled:bg-[#4F7FFF]/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-white/10 bg-[#151823]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-[#F59E0B]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Change Password</h2>
            <p className="text-sm text-white/50">Update your admin password</p>
          </div>
        </div>
        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4F7FFF] transition-colors"
              placeholder="Enter current password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4F7FFF] transition-colors"
              placeholder="Enter new password"
              required
            />
            <p className="text-xs text-white/40 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full max-w-md px-3 py-2 rounded-lg bg-[#0C0E14] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4F7FFF] transition-colors"
              placeholder="Confirm new password"
              required
            />
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <div className="flex items-center gap-2 text-[#EF4444] text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Passwords do not match</span>
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 bg-[#F59E0B] hover:bg-[#d97706] disabled:bg-[#F59E0B]/50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* System Information */}
      <div className="rounded-xl border border-white/10 bg-[#151823]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
            <Info className="h-5 w-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">System Information</h2>
            <p className="text-sm text-white/50">FIONA platform details</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/50 mb-1">Version</div>
                <div className="text-sm font-mono text-white">{systemInfo.version}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">Environment</div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></div>
                  {systemInfo.environment}
                </div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">Backend</div>
                <div className="text-sm font-mono text-white">{systemInfo.backend}</div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/50 mb-1">Frontend</div>
                <div className="text-sm font-mono text-white">{systemInfo.frontend}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 mb-1">Database</div>
                <div className="text-sm font-mono text-white">{systemInfo.database}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
