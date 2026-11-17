'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import apiClient from '@/lib/api-client';
import { Users, Plus, Edit2, Trash2, Tag, Shield, Globe } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface CampaignProfile {
  id: string;
  name: string;
  type: 'GMAIL' | 'GSUITE';
  targetDomainPattern: string | null;
  campaignCount: number;
  credentialCount: number;
  createdBy: {
    id: string;
    email: string;
    fullName: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProfilesResponse {
  success: boolean;
  profiles: CampaignProfile[];
}

const fetcher = async (url: string) => {
  const response = await apiClient.get(url);
  return response.data;
};

export default function CampaignProfilesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<CampaignProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'GMAIL' as 'GMAIL' | 'GSUITE',
    targetDomainPattern: '',
  });

  const { data, error, isLoading } = useSWR<ProfilesResponse>(
    '/api/admin/campaign-profiles',
    fetcher,
    { refreshInterval: 5000 }
  );

  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Profile name is required');
      return;
    }

    try {
      await apiClient.post('/api/admin/campaign-profiles', {
        name: formData.name,
        type: formData.type,
        targetDomainPattern: formData.targetDomainPattern || null,
      });

      toast.success('Campaign profile created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', type: 'GMAIL', targetDomainPattern: '' });
      mutate('/api/admin/campaign-profiles');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create profile');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProfile) return;

    try {
      await apiClient.put(`/api/admin/campaign-profiles/${selectedProfile.id}`, {
        name: formData.name,
        type: formData.type,
        targetDomainPattern: formData.targetDomainPattern || null,
      });

      toast.success('Campaign profile updated successfully');
      setShowEditModal(false);
      setSelectedProfile(null);
      setFormData({ name: '', type: 'GMAIL', targetDomainPattern: '' });
      mutate('/api/admin/campaign-profiles');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleDelete = async (profile: CampaignProfile) => {
    if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/api/admin/campaign-profiles/${profile.id}`);
      toast.success('Campaign profile deleted successfully');
      mutate('/api/admin/campaign-profiles');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete profile');
    }
  };

  const openEditModal = (profile: CampaignProfile) => {
    setSelectedProfile(profile);
    setFormData({
      name: profile.name,
      type: profile.type,
      targetDomainPattern: profile.targetDomainPattern || '',
    });
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load campaign profiles
        </div>
      </div>
    );
  }

  const profiles = data?.profiles || [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campaign Profiles</h1>
            <p className="text-gray-500 mt-1">
              Organize campaigns by credential type (Gmail vs G Suite)
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({ name: '', type: 'GMAIL', targetDomainPattern: '' });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  {profile.type === 'GMAIL' ? (
                    <Users className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Globe className="w-6 h-6 text-purple-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      profile.type === 'GMAIL'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {profile.type}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(profile)}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(profile)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete"
                  disabled={profile.campaignCount > 0}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {profile.targetDomainPattern && (
              <div className="mb-4 text-sm text-gray-600">
                <span className="font-medium">Domain Pattern:</span> {profile.targetDomainPattern}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{profile.campaignCount}</div>
                <div className="text-xs text-gray-500">Campaigns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{profile.credentialCount}</div>
                <div className="text-xs text-gray-500">Credentials</div>
              </div>
            </div>

            <div className="text-xs text-gray-400 space-y-1">
              <div>
                Created by {profile.createdBy.fullName || profile.createdBy.email}
              </div>
              <div>
                {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No campaign profiles yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first profile to organize campaigns by credential type
          </p>
          <button
            onClick={() => {
              setFormData({ name: '', type: 'GMAIL', targetDomainPattern: '' });
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Profile
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Campaign Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Personal Gmail Accounts"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credential Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as 'GMAIL' | 'GSUITE' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GMAIL">GMAIL (@gmail.com)</option>
                  <option value="GSUITE">GSUITE (Custom domains)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Domain Pattern (Optional)
                </label>
                <input
                  type="text"
                  value={formData.targetDomainPattern}
                  onChange={(e) =>
                    setFormData({ ...formData, targetDomainPattern: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., @company.com"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Campaign Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credential Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as 'GMAIL' | 'GSUITE' })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GMAIL">GMAIL (@gmail.com)</option>
                  <option value="GSUITE">GSUITE (Custom domains)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Domain Pattern (Optional)
                </label>
                <input
                  type="text"
                  value={formData.targetDomainPattern}
                  onChange={(e) =>
                    setFormData({ ...formData, targetDomainPattern: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., @company.com"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedProfile(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
