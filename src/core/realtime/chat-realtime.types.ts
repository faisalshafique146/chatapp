import { ChatRoom } from '../models/chat-room.model';
import { Message, MessageStatus } from '../models/message.model';
import { User, UserPresence } from '../models/user.model';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface ChatSocketConnectContext {
  userId: string;
  roomId: string;
}

export interface ChatSocketMessagePayload {
  messageId: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export interface ChatSocketTypingPayload {
  roomId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ChatSocketPresencePayload {
  userId: string;
  presence: UserPresence;
}

export interface ChatSocketMessageStatusPayload {
  roomId: string;
  messageId: string;
  status: MessageStatus;
}

export interface ChatSocketSnapshot {
  currentUser?: User;
  users?: User[];
  rooms?: ChatRoom[];
  messagesByRoom?: Record<string, Message[]>;
  activeRoomId?: string;
}

export interface ServerToClientEvents {
  'chat:snapshot': (snapshot: ChatSocketSnapshot) => void;
  'chat:message': (message: Message) => void;
  'chat:typing': (payload: ChatSocketTypingPayload) => void;
  'chat:presence': (payload: ChatSocketPresencePayload) => void;
  'chat:message-status': (payload: ChatSocketMessageStatusPayload) => void;
  'chat:error': (message: string) => void;
}

export interface ClientToServerEvents {
  'chat:join': (payload: { roomId: string; userId: string }) => void;
  'chat:leave': (payload: { roomId: string; userId: string }) => void;
  'chat:sync': (payload: { userId: string; roomId?: string }) => void;
  'chat:send-message': (payload: ChatSocketMessagePayload) => void;
  'chat:typing': (payload: ChatSocketTypingPayload) => void;
}
