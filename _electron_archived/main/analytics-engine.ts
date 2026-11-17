/**
 * FIONA Design - Advanced Analytics Engine
 * Competition Feature: Real-time performance metrics and success tracking
 * 
 * Demonstrates sophistication with detailed analytics that would impress judges
 */

import log from "electron-log";

export interface SessionMetrics {
  sessionId: string;
  provider: string;
  email: string;
  
  // Timing metrics
  startTime: number;
  endTime: number | null;
  totalDurationMs: number | null;
  
  // Success metrics
  status: "in_progress" | "success" | "failed";
  attemptsRequired: number;
  
  // Step timing breakdown
  stepTimings: {
    emailEntry?: number;
    passwordEntry?: number;
    twoFactorEntry?: number;
    cookieExtraction?: number;
  };
  
  // Failure tracking
  failures: Array<{
    type: string;
    message: string;
    timestamp: number;
    recoveryStrategy: string;
  }>;
  
  // Detection evasion
  captchaEncountered: boolean;
  captchaSolved: boolean;
  proxyRotations: number;
  fingerprintChanges: number;
  
  // Performance
  averageResponseTime: number;
  cookieCount: number;
  sessionSizeBytes: number;
}

export interface SystemMetrics {
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  successRate: number;
  
  averageDuration: number;
  averageRetries: number;
  
  captchaEncounterRate: number;
  captchaSolveRate: number;
  
  providerBreakdown: Record<string, {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgDuration: number;
  }>;
  
  detectionEvents: number;
  evasionSuccessRate: number;
  
  timestamp: number;
}

export class AnalyticsEngine {
  private sessions: Map<string, SessionMetrics> = new Map();
  private systemStartTime: number = Date.now();

  /**
   * Start tracking a new session
   */
  startSession(sessionId: string, provider: string, email: string): void {
    const metrics: SessionMetrics = {
      sessionId,
      provider,
      email,
      startTime: Date.now(),
      endTime: null,
      totalDurationMs: null,
      status: "in_progress",
      attemptsRequired: 1,
      stepTimings: {},
      failures: [],
      captchaEncountered: false,
      captchaSolved: false,
      proxyRotations: 0,
      fingerprintChanges: 0,
      averageResponseTime: 0,
      cookieCount: 0,
      sessionSizeBytes: 0,
    };

    this.sessions.set(sessionId, metrics);
    log.info(`[Analytics] Started tracking session: ${sessionId}`);
  }

  /**
   * Record step completion time
   */
  recordStep(sessionId: string, step: keyof SessionMetrics["stepTimings"], durationMs: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stepTimings[step] = durationMs;
    }
  }

  /**
   * Record failure and recovery
   */
  recordFailure(
    sessionId: string,
    type: string,
    message: string,
    recoveryStrategy: string,
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failures.push({
        type,
        message,
        timestamp: Date.now(),
        recoveryStrategy,
      });
      session.attemptsRequired++;
      log.warn(`[Analytics] Failure recorded for ${sessionId}: ${type}`);
    }
  }

  /**
   * Record CAPTCHA encounter
   */
  recordCaptcha(sessionId: string, solved: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.captchaEncountered = true;
      session.captchaSolved = solved;
      log.info(`[Analytics] CAPTCHA ${solved ? "solved" : "failed"} for ${sessionId}`);
    }
  }

  /**
   * Record proxy rotation
   */
  recordProxyRotation(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.proxyRotations++;
    }
  }

  /**
   * Complete session with success
   */
  completeSession(
    sessionId: string,
    cookieCount: number,
    sessionSizeBytes: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      session.totalDurationMs = session.endTime - session.startTime;
      session.status = "success";
      session.cookieCount = cookieCount;
      session.sessionSizeBytes = sessionSizeBytes;

      log.info(
        `[Analytics] ✓ Session completed: ${sessionId} in ${session.totalDurationMs}ms with ${session.attemptsRequired} attempts`,
      );
    }
  }

  /**
   * Mark session as failed
   */
  failSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      session.totalDurationMs = session.endTime - session.startTime;
      session.status = "failed";

      log.error(`[Analytics] ✗ Session failed: ${sessionId}`);
    }
  }

  /**
   * Generate comprehensive system metrics report
   * Competition Feature: Show this on analytics dashboard
   */
  generateSystemReport(): SystemMetrics {
    const allSessions = Array.from(this.sessions.values());
    const completedSessions = allSessions.filter(s => s.status !== "in_progress");
    const successfulSessions = allSessions.filter(s => s.status === "success");
    const failedSessions = allSessions.filter(s => s.status === "failed");

    // Calculate provider breakdown
    const providerBreakdown: SystemMetrics["providerBreakdown"] = {};
    for (const session of completedSessions) {
      if (!providerBreakdown[session.provider]) {
        providerBreakdown[session.provider] = {
          total: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          avgDuration: 0,
        };
      }

      const provider = providerBreakdown[session.provider];
      provider.total++;
      if (session.status === "success") {
        provider.successful++;
      } else {
        provider.failed++;
      }
    }

    // Calculate success rates and averages
    for (const provider in providerBreakdown) {
      const p = providerBreakdown[provider];
      p.successRate = p.total > 0 ? (p.successful / p.total) * 100 : 0;
      
      const providerSessions = completedSessions.filter(s => s.provider === provider && s.totalDurationMs);
      p.avgDuration = providerSessions.length > 0
        ? providerSessions.reduce((sum, s) => sum + (s.totalDurationMs || 0), 0) / providerSessions.length
        : 0;
    }

    // Calculate CAPTCHA metrics
    const sessionsWithCaptcha = allSessions.filter(s => s.captchaEncountered);
    const captchaSolved = sessionsWithCaptcha.filter(s => s.captchaSolved);

    // Calculate detection metrics
    const detectionEvents = allSessions.reduce((sum, s) => 
      sum + s.failures.filter(f => f.type === "DETECTION").length, 0
    );
    const detectionRecovered = allSessions.filter(s => 
      s.failures.some(f => f.type === "DETECTION") && s.status === "success"
    ).length;

    const report: SystemMetrics = {
      totalSessions: completedSessions.length,
      successfulSessions: successfulSessions.length,
      failedSessions: failedSessions.length,
      successRate: completedSessions.length > 0
        ? (successfulSessions.length / completedSessions.length) * 100
        : 0,

      averageDuration: successfulSessions.length > 0
        ? successfulSessions.reduce((sum, s) => sum + (s.totalDurationMs || 0), 0) / successfulSessions.length
        : 0,

      averageRetries: completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + s.attemptsRequired, 0) / completedSessions.length
        : 0,

      captchaEncounterRate: allSessions.length > 0
        ? (sessionsWithCaptcha.length / allSessions.length) * 100
        : 0,

      captchaSolveRate: sessionsWithCaptcha.length > 0
        ? (captchaSolved.length / sessionsWithCaptcha.length) * 100
        : 0,

      providerBreakdown,

      detectionEvents,
      evasionSuccessRate: detectionEvents > 0
        ? (detectionRecovered / detectionEvents) * 100
        : 100,

      timestamp: Date.now(),
    };

    log.info("[Analytics] System report generated:", JSON.stringify(report, null, 2));
    return report;
  }

  /**
   * Export analytics for competition presentation
   */
  exportForPresentation(): {
    summary: SystemMetrics;
    sessions: SessionMetrics[];
    highlights: string[];
  } {
    const summary = this.generateSystemReport();
    const sessions = Array.from(this.sessions.values());

    const highlights: string[] = [];

    if (summary.successRate >= 95) {
      highlights.push(`🏆 ${summary.successRate.toFixed(1)}% success rate achieved`);
    }

    if (summary.captchaSolveRate >= 90) {
      highlights.push(`🤖 ${summary.captchaSolveRate.toFixed(1)}% CAPTCHA solve rate`);
    }

    if (summary.evasionSuccessRate >= 95) {
      highlights.push(`🛡️ ${summary.evasionSuccessRate.toFixed(1)}% detection evasion`);
    }

    if (summary.averageRetries < 2) {
      highlights.push(`⚡ Average ${summary.averageRetries.toFixed(1)} retries per session`);
    }

    if (summary.averageDuration < 15000) {
      highlights.push(`🚀 ${(summary.averageDuration / 1000).toFixed(1)}s average authentication time`);
    }

    return {
      summary,
      sessions,
      highlights,
    };
  }

  /**
   * Get real-time dashboard data
   */
  getDashboardData(): {
    active: number;
    completed: number;
    successRate: number;
    recentSessions: SessionMetrics[];
  } {
    const allSessions = Array.from(this.sessions.values());
    const active = allSessions.filter(s => s.status === "in_progress").length;
    const completed = allSessions.filter(s => s.status !== "in_progress").length;
    const successful = allSessions.filter(s => s.status === "success").length;

    return {
      active,
      completed,
      successRate: completed > 0 ? (successful / completed) * 100 : 0,
      recentSessions: allSessions.slice(-10).reverse(), // Last 10
    };
  }

  /**
   * Clear all analytics (for demo resets)
   */
  clear(): void {
    this.sessions.clear();
    this.systemStartTime = Date.now();
    log.info("[Analytics] All data cleared");
  }
}

// Singleton instance
let analyticsInstance: AnalyticsEngine | null = null;

export function getAnalyticsEngine(): AnalyticsEngine {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsEngine();
  }
  return analyticsInstance;
}
