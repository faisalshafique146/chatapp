import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';
import { CHAT_REALTIME_CONFIG } from './chat-realtime.config';
import { AuthService } from '../services/auth.service';
import {
  ClientToServerEvents,
  ChatSocketConnectContext,
  ConnectionState,
  ServerToClientEvents
} from './chat-realtime.types';

type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;

@Injectable({
  providedIn: 'root'
})
export class ChatSocketService {
  private readonly zone = inject(NgZone);
  private readonly config = inject(CHAT_REALTIME_CONFIG);
  private readonly authService = inject(AuthService);

  private socket?: SocketClient;
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private readonly listeners: Array<{
    event: keyof ServerToClientEvents;
    wrapped: (...args: any[]) => void;
  }> = [];

  private readonly connectionStateSignal = signal<ConnectionState>('disconnected');

  readonly enabled = this.config.enabled;
  readonly connectionState = this.connectionStateSignal.asReadonly();

  connect(context: ChatSocketConnectContext): void {
    if (!this.enabled || typeof window === 'undefined') {
      return;
    }

    this.currentUserId = context.userId;
    this.currentRoomId = context.roomId ?? null;

    if (this.socket?.connected || this.socket?.active) {
      return;
    }

    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;

    this.connectionStateSignal.set('connecting');

    const socket = io(this.buildNamespaceUrl(), {
      autoConnect: false,
      path: this.config.path,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials,
      auth: this.createAuthPayload(context.userId)
    } satisfies Partial<ManagerOptions & SocketOptions>);

    this.socket = socket;
    this.attachRegisteredListeners(socket);
    this.registerSocketHandlers(socket);
    socket.connect();
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = undefined;
    this.currentUserId = null;
    this.currentRoomId = null;
    this.connectionStateSignal.set('disconnected');
  }

  joinRoom(roomId: string): void {
    if (!this.socket || !this.currentUserId || roomId === this.currentRoomId) {
      return;
    }

    if (this.currentRoomId) {
      this.socket.emit('chat:leave', {
        roomId: this.currentRoomId,
        userId: this.currentUserId
      });
    }

    this.currentRoomId = roomId;

    this.socket.emit('chat:join', {
      roomId,
      userId: this.currentUserId
    });
  }

  leaveRoom(roomId: string): void {
    if (!this.socket || !this.currentUserId) {
      return;
    }

    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }

    this.socket.emit('chat:leave', {
      roomId,
      userId: this.currentUserId
    });
  }

  sendMessage(payload: Parameters<ClientToServerEvents['chat:send-message']>[0]): void {
    this.socket?.emit('chat:send-message', payload);
  }

  setTyping(roomId: string, isTyping: boolean): void {
    if (!this.socket || !this.currentUserId) {
      return;
    }

    this.socket.emit('chat:typing', {
      roomId,
      userId: this.currentUserId,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }

  on<K extends keyof ServerToClientEvents>(event: K, handler: ServerToClientEvents[K]): () => void {
    const wrappedHandler = (...args: any[]) => {
      this.zone.run(() => (handler as (...wrappedArgs: any[]) => void)(...args));
    };

    const listener = {
      event,
      wrapped: wrappedHandler
    };

    this.listeners.push(listener);
    this.socket?.on(event as never, wrappedHandler as never);

    return () => {
      const listenerIndex = this.listeners.indexOf(listener);

      if (listenerIndex >= 0) {
        this.listeners.splice(listenerIndex, 1);
      }

      this.socket?.off(event as never, wrappedHandler as never);
    };
  }

  private registerSocketHandlers(socket: SocketClient): void {
    socket.on('connect', () => {
      this.zone.run(() => {
        this.connectionStateSignal.set('connected');

        if (this.currentUserId) {
          socket.emit('chat:sync', {
            userId: this.currentUserId,
            roomId: this.currentRoomId || undefined
          });
        }

        if (this.currentRoomId && this.currentUserId) {
          socket.emit('chat:join', {
            roomId: this.currentRoomId,
            userId: this.currentUserId
          });
        }
      });
    });

    socket.on('disconnect', () => {
      this.zone.run(() => {
        this.connectionStateSignal.set(socket.active ? 'connecting' : 'disconnected');
      });
    });

    socket.on('connect_error', () => {
      this.zone.run(() => {
        this.connectionStateSignal.set(socket.active ? 'connecting' : 'disconnected');
      });
    });
  }

  private attachRegisteredListeners(socket: SocketClient): void {
    for (const listener of this.listeners) {
      socket.on(listener.event as never, listener.wrapped as never);
    }
  }

  private buildNamespaceUrl(): string {
    const baseUrl = this.config.url.replace(/\/$/, '');
    const namespace = this.normalizeNamespace(this.config.namespace);

    if (namespace === '/') {
      return baseUrl;
    }

    return `${baseUrl}${namespace}`;
  }

  private normalizeNamespace(namespace: string): string {
    if (!namespace || namespace === '/') {
      return '/';
    }

    return namespace.startsWith('/') ? namespace : `/${namespace}`;
  }

  private createAuthPayload(userId: string): Record<string, string | null> {
    return {
      userId,
      token: this.config.authToken?.() ?? this.authService.session()?.accessToken ?? null
    };
  }
}
