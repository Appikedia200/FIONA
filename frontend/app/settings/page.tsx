'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { User, Lock, Info, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function TechnicianSettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user?.fullName) {
      setFullName(user.fullName);
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    setSavingProfile(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/settings/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fullName }),
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
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fioona.org'}/api/settings/password`, {
        method: 'PATCH',
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
      setChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* Page Header */}
      <div className="mb-8">
        {/* Back Link */}
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        {/* Breadcrumb */}
        <div className="mb-2 text-sm text-white/50">
          <Link href="/dashboard" className="hover:text-white/70 transition-colors cursor-pointer">Dashboard</Link>
          <span> / </span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/50">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Information Card */}
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-sm font-medium text-white">Profile Information</h2>
            <p className="text-xs text-white/50">Update your account details</p>
          </div>
          <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50 cursor-not-allowed"
              />
              <p className="mt-1.5 text-xs text-white/40">Contact admin to change your email</p>
            </div>

            <div className="border-t border-white/10 pt-4">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="text-sm font-medium text-white">Change Password</h2>
            <p className="text-xs text-white/50">Update your password</p>
          </div>
          <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none"
                placeholder="Enter new password"
              />
              <p className="mt-1.5 text-xs text-white/40">Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none"
                placeholder="Confirm new password"
              />
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>Passwords do not match</span>
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="flex items-center gap-2 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Card */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
          <Info className="h-4 w-4 flex-shrink-0" />
          <p>
            Your account is registered as a Technician. Contact your administrator for role changes or account issues.
          </p>
        </div>
      </div>
    </div>
  );
}
