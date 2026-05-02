import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/backend.config';
import { AuthService } from '../../../core/services/auth.service';
import { AuthUser } from '../../../core/models/auth-user.model';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { Message, MessageStatus } from '../../../core/models/message.model';
import { User, UserPresence } from '../../../core/models/user.model';
import { ChatSocketService } from '../../../core/realtime/chat-socket.service';
import {
  ChatSocketMessageStatusPayload,
  ChatSocketPresencePayload,
  ChatSocketSnapshot,
  ChatSocketTypingPayload,
  ConnectionState
} from '../../../core/realtime/chat-realtime.types';

export type { ConnectionState } from '../../../core/realtime/chat-realtime.types';

export interface ChatRoomPreview {
  room: ChatRoom;
  contact: User;
  lastMessage: Message | null;
}

interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

interface ChatBootstrap {
  currentUser: User;
  users: User[];
  rooms: ChatRoom[];
  messagesByRoom: Record<string, Message[]>;
  activeRoomId: string | null;
}

interface ConversationResponse {
  roomId: string;
  messages: Message[];
}

interface SendMessageResponse {
  message: Message;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly realtimeTransport = inject(ChatSocketService);

  private readonly currentUserState = signal<User>(this.createFallbackCurrentUser());
  private readonly usersState = signal<User[]>([]);
  private readonly roomsState = signal<ChatRoom[]>([]);
  private readonly messagesState = signal<Record<string, Message[]>>({});
  private readonly activeRoomIdState = signal<string>('');
  private readonly typingState = signal<{ roomId: string; userId: string } | null>(null);
  private readonly connectionStateSignal = signal<ConnectionState>('disconnected');
  private readonly initializedState = signal(false);

  private readonly incomingMessageSubject = new Subject<Message>();
  private readonly socketDisposers: Array<() => void> = [];
  private bootstrapSubscription?: Subscription;
  private conversationSubscription?: Subscription;
  private readReceiptSubscription?: Subscription;

  readonly currentUser = this.currentUserState.asReadonly();
  readonly users = this.usersState.asReadonly();
  readonly currentRoomId = this.activeRoomIdState.asReadonly();
  readonly connectionState = computed(() =>
    this.realtimeTransport.enabled ? this.realtimeTransport.connectionState() : this.connectionStateSignal()
  );
  readonly incomingMessages$ = this.incomingMessageSubject.asObservable();

  readonly rooms = computed(() => this.roomsState());
  readonly currentRoom = computed(() => this.roomsState().find((room) => room.id === this.activeRoomIdState()) ?? null);
  readonly currentMessages = computed(() => this.messagesState()[this.activeRoomIdState()] ?? []);
  readonly currentContact = computed(() => {
    const room = this.currentRoom();

    if (!room) {
      return null;
    }

    return this.resolveRoomContact(room);
  });
  readonly typingUser = computed(() => {
    const typingState = this.typingState();

    if (!typingState || typingState.roomId !== this.activeRoomIdState()) {
      return null;
    }

    return this.usersState().find((user) => user.id === typingState.userId) ?? null;
  });
  readonly roomPreviews = computed<ChatRoomPreview[]>(() =>
    [...this.roomsState()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map((room) => ({
        room,
        contact: this.resolveRoomContact(room),
        lastMessage: this.messagesState()[room.id]?.at(-1) ?? null
      }))
  );

  constructor() {
    this.registerRealtimeListeners();
    this.syncCurrentUserFromSession();
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.bootstrapSubscription?.unsubscribe();
    this.conversationSubscription?.unsubscribe();
    this.readReceiptSubscription?.unsubscribe();
    this.incomingMessageSubject.complete();
  }

  initialize(): void {
    if (this.initializedState()) {
      return;
    }

    this.syncCurrentUserFromSession();

    this.bootstrapSubscription?.unsubscribe();
    this.bootstrapSubscription = this.http
      .get<ApiEnvelope<ChatBootstrap>>(`${API_BASE_URL}/messages/conversations`)
      .subscribe({
        next: (response) => {
          const snapshot = response.data;

          this.applySnapshot(snapshot);
          this.initializedState.set(true);

          if (this.realtimeTransport.enabled && this.realtimeTransport.connectionState() === 'connected') {
            this.realtimeTransport.joinRoom(this.activeRoomIdState());
          }
        },
        error: (error) => {
          console.error('[chat bootstrap]', error);
        }
      });
  }

  disconnect(): void {
    this.bootstrapSubscription?.unsubscribe();
    this.conversationSubscription?.unsubscribe();
    this.readReceiptSubscription?.unsubscribe();
    this.bootstrapSubscription = undefined;
    this.conversationSubscription = undefined;
    this.readReceiptSubscription = undefined;
    this.connectionStateSignal.set('disconnected');
    this.socketDisposers.forEach((dispose) => dispose());
    this.socketDisposers.length = 0;
    this.realtimeTransport.disconnect();
  }

  connect(): void {
    const currentUser = this.currentUserState();

    if (!currentUser.id) {
      return;
    }

    if (this.realtimeTransport.enabled) {
      if (this.realtimeTransport.connectionState() !== 'disconnected') {
        return;
      }

      this.realtimeTransport.connect({
        userId: currentUser.id,
        roomId: this.activeRoomIdState()
      });
      return;
    }

    this.connectionStateSignal.set('disconnected');
  }

  selectRoom(roomId: string): void {
    const previousRoomId = this.activeRoomIdState();

    if (!roomId || roomId === previousRoomId) {
      return;
    }

    this.activeRoomIdState.set(roomId);
    this.typingState.set(null);
    this.clearUnreadCount(roomId);

    if (this.realtimeTransport.enabled) {
      if (previousRoomId && previousRoomId !== roomId) {
        this.realtimeTransport.leaveRoom(previousRoomId);
      }

      this.realtimeTransport.joinRoom(roomId);
    }

    this.loadConversation(roomId);
    this.markConversationRead(roomId);
  }

  sendMessage(content: string, imageFile: File | null = null): void {
    const room = this.currentRoom();
    const messageBody = content.trim();

    if (!room || (!messageBody && !imageFile)) {
      return;
    }

    const clientMessageId = this.createId('msg');
    const optimisticMessage: Message = {
      id: clientMessageId,
      clientMessageId,
      roomId: room.id,
      senderId: this.currentUserState().id,
      receiverId: room.participantIds.find((participant) => participant !== this.currentUserState().id) ?? room.id,
      content: messageBody,
      imageUrl: imageFile ? URL.createObjectURL(imageFile) : null,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    this.upsertMessage(optimisticMessage);

    const formData = new FormData();
    formData.append('receiverId', optimisticMessage.receiverId ?? room.id);
    formData.append('text', messageBody);
    formData.append('clientMessageId', clientMessageId);

    if (imageFile) {
      formData.append('image', imageFile, imageFile.name);
    }

    this.http.post<ApiEnvelope<SendMessageResponse>>(`${API_BASE_URL}/messages`, formData).subscribe({
      next: (response) => {
        this.receiveMessage(response.data.message);
        this.reconcileClientMessageId(clientMessageId, response.data.message);
      },
      error: (error) => {
        console.error('[send message]', error);
        this.removeMessage(room.id, clientMessageId);
      }
    });

    if (this.realtimeTransport.enabled) {
      this.realtimeTransport.setTyping(room.id, false);
    }
  }

  receiveMessage(message: Message): void {
    this.typingState.set(null);
    this.upsertMessage(message, message.roomId !== this.activeRoomIdState());
    this.incomingMessageSubject.next(message);

    if (message.senderId !== this.currentUserState().id && message.roomId === this.activeRoomIdState()) {
      this.clearUnreadCount(message.roomId);
      this.markConversationRead(message.roomId);
    }
  }

  setTyping(isTyping: boolean): void {
    if (!this.realtimeTransport.enabled) {
      return;
    }

    const room = this.currentRoom();

    if (!room) {
      return;
    }

    this.realtimeTransport.setTyping(room.id, isTyping);
  }

  private registerRealtimeListeners(): void {
    if (!this.realtimeTransport.enabled) {
      return;
    }

    this.socketDisposers.push(
      this.realtimeTransport.on('chat:snapshot', (snapshot) => this.applySnapshot(snapshot))
    );
    this.socketDisposers.push(
      this.realtimeTransport.on('chat:message', (message) => this.receiveMessage(message))
    );
    this.socketDisposers.push(
      this.realtimeTransport.on('chat:typing', (payload) => this.handleRealtimeTyping(payload))
    );
    this.socketDisposers.push(
      this.realtimeTransport.on('chat:presence', (payload) => this.handleRealtimePresence(payload))
    );
    this.socketDisposers.push(
      this.realtimeTransport.on('chat:message-status', (payload) => this.handleRealtimeMessageStatus(payload))
    );
    this.socketDisposers.push(
      this.realtimeTransport.on('chat:error', (message) => {
        console.error('[chat socket]', message);
      })
    );
  }

  private applySnapshot(snapshot: ChatSocketSnapshot): void {
    if (snapshot.currentUser) {
      this.currentUserState.set(snapshot.currentUser);
    } else {
      this.syncCurrentUserFromSession();
    }

    if (snapshot.users) {
      this.usersState.set(snapshot.users);
    }

    if (snapshot.rooms) {
      this.roomsState.set(snapshot.rooms);
    }

    if (snapshot.messagesByRoom) {
      this.messagesState.set(snapshot.messagesByRoom);
    }

    if (snapshot.activeRoomId) {
      this.activeRoomIdState.set(snapshot.activeRoomId);
    } else if (!this.activeRoomIdState() && this.roomsState().length > 0) {
      this.activeRoomIdState.set(this.roomsState()[0].id);
    }
  }

  private loadConversation(roomId: string): void {
    this.conversationSubscription?.unsubscribe();
    this.conversationSubscription = this.http
      .get<ApiEnvelope<ConversationResponse>>(`${API_BASE_URL}/messages/${roomId}`)
      .subscribe({
        next: (response) => {
          const { messages } = response.data;

          this.messagesState.update((messagesByRoom) => ({
            ...messagesByRoom,
            [roomId]: messages
          }));
        },
        error: (error) => {
          console.error('[conversation]', error);
        }
      });
  }

  private markConversationRead(roomId: string): void {
    this.readReceiptSubscription?.unsubscribe();
    this.readReceiptSubscription = this.http
      .patch<ApiEnvelope<{ modifiedCount: number }>>(`${API_BASE_URL}/messages/${roomId}/read`, {})
      .subscribe({
        next: () => {
          this.updateMessageStatus(roomId, undefined, 'read', true);
          this.clearUnreadCount(roomId);
        },
        error: (error) => {
          console.error('[read receipt]', error);
        }
      });
  }

  private handleRealtimeTyping(payload: ChatSocketTypingPayload): void {
    if (payload.roomId !== this.activeRoomIdState()) {
      return;
    }

    if (payload.userId === this.currentUserState().id) {
      return;
    }

    this.typingState.set(
      payload.isTyping
        ? {
            roomId: payload.roomId,
            userId: payload.userId
          }
        : null
    );
  }

  private handleRealtimePresence(payload: ChatSocketPresencePayload): void {
    this.usersState.update((users) =>
      users.map((user) =>
        user.id === payload.userId
          ? {
              ...user,
              presence: payload.presence
            }
          : user
      )
    );
  }

  private handleRealtimeMessageStatus(payload: ChatSocketMessageStatusPayload): void {
    if (payload.messageId === '*') {
      if (payload.readerId && payload.readerId === this.currentUserState().id) {
        this.updateMessageStatus(payload.roomId, undefined, payload.status, true);
      } else {
        this.updateOutgoingConversationStatus(payload.roomId, payload.status);
      }

      if (payload.status === 'read') {
        this.clearUnreadCount(payload.roomId);
      }
      return;
    }

    this.updateMessageStatus(payload.roomId, payload.messageId, payload.status);

    if (payload.status === 'read') {
      this.clearUnreadCount(payload.roomId);
    }
  }

  private upsertMessage(message: Message, incrementUnread = false): void {
    const roomId = message.roomId;

    this.messagesState.update((messagesByRoom) => {
      const existingMessages = messagesByRoom[roomId] ?? [];
      const clientIndex = message.clientMessageId
        ? existingMessages.findIndex((currentMessage) => currentMessage.clientMessageId === message.clientMessageId)
        : -1;
      const idIndex = existingMessages.findIndex((currentMessage) => currentMessage.id === message.id);
      const nextMessages = [...existingMessages];

      if (idIndex >= 0) {
        nextMessages[idIndex] = message;
      } else if (clientIndex >= 0) {
        nextMessages[clientIndex] = message;
      } else {
        nextMessages.push(message);
      }

      return {
        ...messagesByRoom,
        [roomId]: nextMessages
      };
    });

    this.updateRoom(roomId, (room) => ({
      ...room,
      unreadCount: incrementUnread && message.senderId !== this.currentUserState().id ? room.unreadCount + 1 : room.unreadCount,
      updatedAt: message.timestamp
    }));
  }

  private removeMessage(roomId: string, messageId: string): void {
    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [roomId]: (messagesByRoom[roomId] ?? []).filter(
        (message) => message.id !== messageId && message.clientMessageId !== messageId
      )
    }));
  }

  private reconcileClientMessageId(clientMessageId: string, serverMessage: Message): void {
    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [serverMessage.roomId]: (messagesByRoom[serverMessage.roomId] ?? []).map((message) =>
        message.clientMessageId === clientMessageId || message.id === clientMessageId
          ? {
              ...serverMessage,
              clientMessageId
            }
          : message
      )
    }));
  }

  private updateRoom(roomId: string, updater: (room: ChatRoom) => ChatRoom): void {
    this.roomsState.update((rooms) => rooms.map((room) => (room.id === roomId ? updater(room) : room)));
  }

  private clearUnreadCount(roomId: string): void {
    this.updateRoom(roomId, (room) => ({
      ...room,
      unreadCount: 0
    }));
  }

  private updateOutgoingConversationStatus(roomId: string, status: MessageStatus): void {
    const currentUserId = this.currentUserState().id;

    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [roomId]: (messagesByRoom[roomId] ?? []).map((message) =>
        message.senderId === currentUserId && (message.receiverId === roomId || message.roomId === roomId)
          ? {
              ...message,
              status
            }
          : message
      )
    }));
  }

  private updateMessageStatus(
    roomId: string,
    messageId: string | undefined,
    status: MessageStatus,
    applyToUnreadConversation = false
  ): void {
    const currentUserId = this.currentUserState().id;

    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [roomId]: (messagesByRoom[roomId] ?? []).map((message) => {
        const shouldUpdate =
          (applyToUnreadConversation && message.senderId !== currentUserId) ||
          (messageId ? message.id === messageId || message.clientMessageId === messageId : false);

        if (!shouldUpdate) {
          return message;
        }

        return {
          ...message,
          status
        };
      })
    }));
  }

  private resolveRoomContact(room: ChatRoom): User {
    const participantId =
      room.participantIds.find((participant) => participant !== this.currentUserState().id) ??
      this.currentUserState().id;

    return this.usersState().find((user) => user.id === participantId) ?? this.currentUserState();
  }

  private syncCurrentUserFromSession(): void {
    const sessionUser = this.authService.currentUser();

    if (!sessionUser) {
      return;
    }

    this.currentUserState.set(this.mapAuthUserToChatUser(sessionUser));
  }

  private mapAuthUserToChatUser(sessionUser: AuthUser): User {
    return {
      id: sessionUser.id,
      name: sessionUser.fullName,
      accentColor: this.createColor(sessionUser.handle || sessionUser.email),
      avatarUrl: sessionUser.profilePic ?? undefined,
      presence: 'online',
      statusMessage: 'Available',
      fullName: sessionUser.fullName,
      email: sessionUser.email,
      handle: sessionUser.handle,
      profilePic: sessionUser.profilePic ?? null,
      createdAt: sessionUser.createdAt
    };
  }

  private createFallbackCurrentUser(): User {
    return {
      id: '',
      name: 'You',
      accentColor: '#155c48',
      presence: 'online',
      statusMessage: 'Available'
    };
  }

  private createColor(seed: string): string {
    let hash = 0;

    for (const char of seed ?? '') {
      hash = (hash << 5) - hash + char.charCodeAt(0);
      hash |= 0;
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 55% 42%)`;
  }

  private createId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
