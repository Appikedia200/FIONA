/**
 * Admin Panel API Client
 * NO HARDCODING - Uses environment variable or relative paths
 */

// Use relative API path (same domain) or environment variable for separate API domain
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface Profile {
  id: string;
  email: string;
  password?: string;
  domain: string;
  status: 'LAUNCHED' | 'NEVER_LAUNCHED';
  launchCount: number;
  lastLaunched: string | null;
  captureId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ActiveSessionData {
  id: string;
  profileId: string;
  email: string;
  launchedAt: string;
  lastActivity: string;
  isRunning: boolean;
}

export interface ProfilesResponse {
  success: boolean;
  data?: {
    profiles: Profile[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
    stats: {
      total: number;
      launched: number;
      neverLaunched: number;
    };
  };
  message?: string;
}

export interface ActiveSessionsResponse {
  success: boolean;
  data?: {
    sessions: ActiveSessionData[];
    count: number;
  };
  message?: string;
}

export interface CookiesResponse {
  success: boolean;
  data?: {
    cookies: any[];
    count: number;
  };
  message?: string;
}

/**
 * Get all profiles with filters
 */
export async function getProfiles(params: {
  domain?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProfilesResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params.domain) queryParams.append('domain', params.domain);
    if (params.status) queryParams.append('status', params.status);
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const response = await fetch(`${API_BASE}/admin/profiles?${queryParams}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to fetch profiles',
    };
  }
}

/**
 * Get specific profile details (includes password)
 */
export async function getProfile(profileId: string): Promise<{ success: boolean; data?: Profile; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/admin/profiles/${profileId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to fetch profile',
    };
  }
}

/**
 * Launch browser for profile
 */
export async function launchProfile(profileId: string): Promise<{ success: boolean; sessionId?: string; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/admin/profiles/${profileId}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to launch profile',
    };
  }
}

/**
 * Delete profile
 */
export async function deleteProfile(profileId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/admin/profiles/${profileId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to delete profile',
    };
  }
}

/**
 * Get all active browser sessions
 */
export async function getActiveSessions(): Promise<ActiveSessionsResponse> {
  try {
    const response = await fetch(`${API_BASE}/admin/active-sessions`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to fetch active sessions',
    };
  }
}

/**
 * Get cookies from active session
 */
export async function getSessionCookies(sessionId: string): Promise<CookiesResponse> {
  try {
    const response = await fetch(`${API_BASE}/admin/active-sessions/${sessionId}/cookies`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to fetch session cookies',
    };
  }
}

/**
 * Close active session
 */
export async function closeSession(sessionId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/admin/active-sessions/${sessionId}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to close session',
    };
  }
}

/**
 * Get available domains (for filter dropdown)
 */
export async function getDomains(): Promise<{ success: boolean; data?: Array<{ domain: string; count: number }>; message?: string }> {
  try {
    const response = await fetch(`${API_BASE}/admin/domains`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to fetch domains',
    };
  }
}
