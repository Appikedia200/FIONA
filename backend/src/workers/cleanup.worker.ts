import { logger } from '../utils/logger.util';
import resourceManager from '../services/resource-manager.service';
import websocketService from '../services/websocket.service';
import { RESOURCE_LIMITS } from '../config/resources';
import prisma from '../config/database';

export class CleanupWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Start cleanup worker
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Cleanup worker already running');
      return;
    }

    logger.info('Starting cleanup worker...');

    // Run every 2 minutes
    this.intervalId = setInterval(() => {
      this.runCleanupCycle();
    }, 2 * 60 * 1000);

    this.isRunning = true;
    logger.success('Cleanup worker started (runs every 2 minutes)');

    // Run initial cleanup after 30 seconds
    setTimeout(() => {
      this.runCleanupCycle();
    }, 30 * 1000);
  }

  /**
   * Stop cleanup worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Cleanup worker stopped');
  }

  /**
   * Run cleanup cycle
   */
  private async runCleanupCycle(): Promise<void> {
    try {
      logger.debug('Running cleanup cycle...');

      // Check and cleanup idle sessions
      await this.cleanupIdleSessions();

      // Check and warn/cleanup idle profiles
      await this.cleanupIdleProfiles();

      // Check resource health
      await this.checkResourceHealth();

      logger.debug('Cleanup cycle completed');
    } catch (error: any) {
      logger.error('Cleanup cycle error:', error.message);
    }
  }

  /**
   * Cleanup idle sessions (user sessions)
   */
  private async cleanupIdleSessions(): Promise<void> {
    const idleSessions = resourceManager.getIdleSessions(
      RESOURCE_LIMITS.SESSION_IDLE_TIMEOUT
    );

    if (idleSessions.length === 0) {
      return;
    }

    logger.info(`Found ${idleSessions.length} idle sessions for cleanup`);

    for (const session of idleSessions) {
      try {
        const idleMinutes = Math.floor(
          (Date.now() - session.lastActivity.getTime()) / (1000 * 60)
        );

        logger.info(
          `Closing idle session: ${session.sessionId} (idle for ${idleMinutes} min)`
        );

        // Close browser
        await resourceManager.closeSession(session.sessionId);

        // Update database
        await prisma.session.update({
          where: { id: session.sessionId },
          data: {
            status: 'EXPIRED',
            lastActivityAt: new Date(),
          },
        });

        // Broadcast event
        const dbSession = await prisma.session.findUnique({
          where: { id: session.sessionId },
          include: { user: true },
        });

        if (dbSession && dbSession.userId) {
          websocketService.broadcastSessionUpdate(dbSession.userId, {
            sessionId: session.sessionId,
            stage: 'expired',
            status: 'EXPIRED',
          });
        }

        logger.success(`Idle session cleaned up: ${session.sessionId}`);
      } catch (error: any) {
        logger.error(
          `Failed to cleanup session ${session.sessionId}:`,
          error.message
        );
      }
    }
  }

  /**
   * Cleanup idle launched profiles (technician sessions)
   */
  private async cleanupIdleProfiles(): Promise<void> {
    const now = Date.now();
    const allProfiles = resourceManager.getAllLaunchedProfiles();

    for (const profile of allProfiles) {
      const idleTime = now - profile.lastInteraction.getTime();
      const idleMinutes = Math.floor(idleTime / (1000 * 60));

      // Warning threshold (15 minutes)
      if (
        idleTime > RESOURCE_LIMITS.PROFILE_HARD_TIMEOUT * 0.75 &&
        idleTime < RESOURCE_LIMITS.PROFILE_HARD_TIMEOUT &&
        !profile.activityWarned
      ) {
        logger.warn(
          `Profile idle warning: ${profile.profileId} (idle for ${idleMinutes} min)`
        );

        resourceManager.warnProfileInactivity(profile.profileId);

        // Get profile details
        const dbProfile = await prisma.profile.findUnique({
          where: { id: profile.profileId },
        });

        if (dbProfile) {
          websocketService.broadcastProfileUpdate(profile.userId, {
            profileId: profile.profileId,
            event: 'idle-warning',
            email: dbProfile.email,
          });
        }
      }

      // Cleanup threshold (30 minutes)
      if (idleTime > RESOURCE_LIMITS.PROFILE_HARD_TIMEOUT) {
        try {
          logger.info(
            `Closing idle profile: ${profile.profileId} (idle for ${idleMinutes} min)`
          );

          // Close browser context
          await resourceManager.closeLaunchedProfile(profile.profileId);

          // Update database - mark as NOT launched (but keep data!)
          await prisma.profile.update({
            where: { id: profile.profileId },
            data: {
              isLaunched: false,
              lastLaunched: null,
            },
          });

          // Get profile details
          const dbProfile = await prisma.profile.findUnique({
            where: { id: profile.profileId },
          });

          if (dbProfile) {
            websocketService.broadcastProfileUpdate(profile.userId, {
              profileId: profile.profileId,
              event: 'closed',
              email: dbProfile.email,
            });
          }

          logger.success(`Idle profile cleaned up: ${profile.profileId}`);
        } catch (error: any) {
          logger.error(
            `Failed to cleanup profile ${profile.profileId}:`,
            error.message
          );
        }
      }
    }
  }

  /**
   * Check resource health and send warnings
   */
  private async checkResourceHealth(): Promise<void> {
    const stats = resourceManager.getResourceStats();

    // Check memory threshold
    const memoryPercentage = parseFloat(stats.memory.percentage);
    if (memoryPercentage >= RESOURCE_LIMITS.MEMORY_THRESHOLD * 100) {
      websocketService.broadcastResourceWarning('memory', {
        message: `Memory usage critical: ${memoryPercentage.toFixed(2)}%`,
        severity: 'critical',
        metrics: stats.memory,
      });
    } else if (memoryPercentage >= (RESOURCE_LIMITS.MEMORY_THRESHOLD - 0.1) * 100) {
      websocketService.broadcastResourceWarning('memory', {
        message: `Memory usage high: ${memoryPercentage.toFixed(2)}%`,
        severity: 'warning',
        metrics: stats.memory,
      });
    }

    // Check session capacity
    const sessionPercentage = parseFloat(stats.sessions.percentage);
    if (sessionPercentage >= 90) {
      websocketService.broadcastResourceWarning('capacity', {
        message: `Session capacity at ${sessionPercentage.toFixed(0)}%`,
        severity: sessionPercentage >= 100 ? 'critical' : 'warning',
        metrics: stats.sessions,
      });
    }

    // Broadcast system stats to admin
    websocketService.broadcastSystemStats(stats);
  }
}

export default new CleanupWorker();
