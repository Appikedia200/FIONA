'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { UserPlus, Users, CheckCircle, Clock, Activity, Shield, Ban, PlayCircle, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Technician {
  id: string;
  email: string;
  fullName: string;
  status: string;
  role: string;
  createdAt: string;
  lastActive?: string;
  sessionsCount?: number;
  capturesCount?: number;
}

interface TechniciansResponse {
  success: boolean;
  technicians: Technician[];
  total?: number;
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function TechniciansPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: ''
  });

  const swrKey = filter !== 'all' 
    ? `/api/admin/technicians?status=${filter}` 
    : '/api/admin/technicians';
  
  const { data, error, isLoading } = useSWR<TechniciansResponse>(swrKey, fetcher, {
    refreshInterval: 10000,
  });

  const technicians = data?.technicians || [];

  const handleApprove = async (id: string) => {
    try {
      const response = await apiClient.post(`/api/admin/technicians/${id}/approve`);
      if (response.status === 200 && response.data.success) {
        toast.success('Technician approved');
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve technician');
    }
  };

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspend this technician? They will lose access immediately.')) return;
    try {
      const response = await apiClient.post(`/api/admin/technicians/${id}/suspend`);
      if (response.status === 200 && response.data.success) {
        toast.success('Technician suspended');
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to suspend technician');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      const response = await apiClient.post(`/api/admin/technicians/${id}/reactivate`);
      if (response.status === 200 && response.data.success) {
        toast.success('Technician reactivated');
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reactivate technician');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this technician? All their data will be permanently removed.')) return;
    try {
      const response = await apiClient.deleteTechnician(id);
      if (response.status === 200 && response.data.success) {
        toast.success('Technician deleted');
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete technician');
    }
  };

  const handleAddTechnician = async () => {
    try {
      if (!formData.email || !formData.fullName || !formData.password) {
        toast.error('Please fill in all required fields');
        return;
      }

      const response = await apiClient.post('/api/auth/register', {
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password,
        role: 'TECHNICIAN'
      });

      if (response.status === 200 || response.status === 201) {
        toast.success('Technician created successfully');
        setShowAddDialog(false);
        setFormData({ email: '', fullName: '', password: '' });
        mutate(swrKey);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create technician');
    }
  };

  const activeTechnicians = technicians.filter(t => t.status === 'ACTIVE' || t.status === 'active').length;
  const pendingTechnicians = technicians.filter(t => t.status === 'PENDING' || t.status === 'pending').length;
  const suspendedTechnicians = technicians.filter(t => t.status === 'SUSPENDED' || t.status === 'suspended').length;

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
            <span>Technicians</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">Technicians</h1>
          <p className="text-sm text-white/50 mt-1">Manage operator accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3d6ee0] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add Technician
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-white">{technicians.length}</div>
          <div className="text-sm text-white/50 mt-1">Total Technicians</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#10B981]">{activeTechnicians}</div>
          <div className="text-sm text-white/50 mt-1">Active</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#F59E0B]">{pendingTechnicians}</div>
          <div className="text-sm text-white/50 mt-1">Pending Approval</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#151823] p-6">
          <div className="text-2xl font-semibold text-[#EF4444]">{suspendedTechnicians}</div>
          <div className="text-sm text-white/50 mt-1">Suspended</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'pending', 'suspended'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
              filter === f
                ? 'bg-[#4F7FFF]/10 text-[#4F7FFF] border border-[#4F7FFF]/20'
                : 'bg-transparent text-white/50 hover:text-white/70'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Technicians Table */}
      <div className="rounded-xl border border-white/10 bg-[#151823] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-[#4F7FFF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : technicians.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-white/20" />
            <h3 className="text-lg font-medium text-white mb-2">No technicians found</h3>
            <p className="text-sm text-white/50 mb-6">
              Add technicians to start running campaigns
            </p>
            <button
              onClick={() => setShowAddDialog(true)}
              className="inline-flex items-center gap-2 bg-[#4F7FFF] hover:bg-[#3d6ee0] text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Add Your First Technician
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">User</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Status</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Sessions</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Captures</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Last Active</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Joined</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-white/50 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {technicians.map((tech) => (
                <tr key={tech.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#4F7FFF]/10 flex items-center justify-center text-[#4F7FFF] font-medium">
                        {tech.fullName?.charAt(0).toUpperCase() || tech.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{tech.fullName || 'Unknown'}</div>
                        <div className="text-xs text-white/50">{tech.role || 'TECHNICIAN'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/70">{tech.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    {tech.status === 'ACTIVE' || tech.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : tech.status === 'PENDING' || tech.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : tech.status === 'SUSPENDED' || tech.status === 'suspended' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EF4444]/10 text-[#EF4444] text-xs font-medium">
                        <Ban className="w-3 h-3" />
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/50 text-xs font-medium">
                        {tech.status}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-white">{tech.sessionsCount || 0}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-medium text-white">{tech.capturesCount || 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-white/40" />
                      <span className="text-sm text-white/60">
                        {tech.lastActive ? formatDistanceToNow(new Date(tech.lastActive), { addSuffix: true }) : 'Never'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-white/60">
                      {formatDistanceToNow(new Date(tech.createdAt), { addSuffix: true })}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {(tech.status === 'PENDING' || tech.status === 'pending') && (
                        <button
                          onClick={() => handleApprove(tech.id)}
                          className="p-2 hover:bg-[#10B981]/20 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="h-4 w-4 text-[#10B981]" />
                        </button>
                      )}
                      {(tech.status === 'ACTIVE' || tech.status === 'active') && (
                        <button
                          onClick={() => handleSuspend(tech.id)}
                          className="p-2 hover:bg-[#EF4444]/20 rounded-lg transition-colors"
                          title="Suspend"
                        >
                          <Ban className="h-4 w-4 text-[#EF4444]" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Technician Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F1117] p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Add Technician</h2>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-white/70">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/70">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="john@example.com"
                  autoComplete="off"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-white/70">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#4F7FFF] focus:outline-none focus:ring-1 focus:ring-[#4F7FFF]"
                />
                <p className="mt-1 text-xs text-white/40">Minimum 8 characters</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setFormData({ email: '', fullName: '', password: '' });
                }}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTechnician}
                className="flex-1 rounded-lg bg-[#4F7FFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#3d6ee0] transition-colors"
              >
                Create Technician
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
