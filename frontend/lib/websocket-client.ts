import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.fioona.org';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string, role: 'ADMIN' | 'TECHNICIAN') {
    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return this.socket;
    }

    this.socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;

      // Join user room
      this.socket?.emit('join', { userId, role });

      // Join admin broadcast if admin
      if (role === 'ADMIN') {
        this.socket?.emit('join-admin');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ WebSocket reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('WebSocket disconnected manually');
    }
  }

  onLiveCapture(callback: (data: any) => void) {
    this.socket?.on('live-capture', callback);
  }

  onResourceWarning(callback: (data: any) => void) {
    this.socket?.on('resource-warning', callback);
  }

  onSessionUpdate(callback: (data: any) => void) {
    this.socket?.on('session-update', callback);
  }

  onProfileUpdate(callback: (data: any) => void) {
    this.socket?.on('profile-update', callback);
  }

  onSystemStats(callback: (data: any) => void) {
    this.socket?.on('system-stats', callback);
  }

  offLiveCapture(callback?: (data: any) => void) {
    this.socket?.off('live-capture', callback);
  }

  offResourceWarning(callback?: (data: any) => void) {
    this.socket?.off('resource-warning', callback);
  }

  offSessionUpdate(callback?: (data: any) => void) {
    this.socket?.off('session-update', callback);
  }

  offProfileUpdate(callback?: (data: any) => void) {
    this.socket?.off('profile-update', callback);
  }

  offSystemStats(callback?: (data: any) => void) {
    this.socket?.off('system-stats', callback);
  }

  onLaunchResult(callback: (data: any) => void) {
    this.socket?.on('launch-result', callback);
  }

  offLaunchResult(callback?: (data: any) => void) {
    this.socket?.off('launch-result', callback);
  }

  onCloseResult(callback: (data: any) => void) {
    this.socket?.on('close-result', callback);
  }

  offCloseResult(callback?: (data: any) => void) {
    this.socket?.off('close-result', callback);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsClient = new WebSocketClient();
export default wsClient;
