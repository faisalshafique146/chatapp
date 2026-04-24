import { InjectionToken, Provider } from '@angular/core';

export interface ChatRealtimeConfig {
  enabled: boolean;
  url: string;
  namespace: string;
  path: string;
  withCredentials: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
  authToken?: () => string | null;
}

export const DEFAULT_CHAT_REALTIME_CONFIG: ChatRealtimeConfig = {
  enabled: false,
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  namespace: '/',
  path: '/socket.io',
  withCredentials: false,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10_000
};

export const CHAT_REALTIME_CONFIG = new InjectionToken<ChatRealtimeConfig>('CHAT_REALTIME_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_CHAT_REALTIME_CONFIG
});

export function provideChatRealtimeConfig(config: Partial<ChatRealtimeConfig> = {}): Provider {
  return {
    provide: CHAT_REALTIME_CONFIG,
    useValue: {
      ...DEFAULT_CHAT_REALTIME_CONFIG,
      ...config
    } satisfies ChatRealtimeConfig
  };
}
