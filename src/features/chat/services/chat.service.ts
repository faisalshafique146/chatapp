import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';
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
import {
  MOCK_AUTO_REPLIES,
  MOCK_CHAT_ROOMS,
  MOCK_CURRENT_USER,
  MOCK_MESSAGES_BY_ROOM,
  MOCK_USERS
} from './chat.mock-data';

export type { ConnectionState } from '../../../core/realtime/chat-realtime.types';

export interface ChatRoomPreview {
  room: ChatRoom;
  contact: User;
  lastMessage: Message | null;
}

interface TypingState {
  roomId: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private readonly realtimeTransport = inject(ChatSocketService);
  private readonly currentUserState = signal<User>(MOCK_CURRENT_USER);
  private readonly usersState = signal<User[]>(MOCK_USERS);
  private readonly roomsState = signal<ChatRoom[]>(MOCK_CHAT_ROOMS);
  private readonly messagesState = signal<Record<string, Message[]>>(MOCK_MESSAGES_BY_ROOM);
  private readonly activeRoomIdState = signal<string>(MOCK_CHAT_ROOMS[0]?.id ?? '');
  private readonly typingState = signal<TypingState | null>(null);
  private readonly connectionStateSignal = signal<ConnectionState>('disconnected');

  private readonly incomingMessageSubject = new Subject<Message>();
  private readonly socketDisposers: Array<() => void> = [];
  private mockRealtimeSubscription?: Subscription;
  private mockPresenceSubscription?: Subscription;
  private mockConnectSubscription?: Subscription;

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
  }

  ngOnDestroy(): void {
    this.mockRealtimeSubscription?.unsubscribe();
    this.mockPresenceSubscription?.unsubscribe();
    this.mockConnectSubscription?.unsubscribe();
    this.socketDisposers.forEach((dispose) => dispose());
    this.realtimeTransport.disconnect();
    this.incomingMessageSubject.complete();
  }

  connect(): void {
    if (this.realtimeTransport.enabled) {
      if (this.realtimeTransport.connectionState() !== 'disconnected') {
        return;
      }

      this.realtimeTransport.connect({
        userId: this.currentUserState().id,
        roomId: this.activeRoomIdState()
      });
      this.realtimeTransport.joinRoom(this.activeRoomIdState());
      return;
    }

    if (this.connectionStateSignal() !== 'disconnected') {
      return;
    }

    this.connectionStateSignal.set('connecting');

    this.mockConnectSubscription?.unsubscribe();
    this.mockConnectSubscription = timer(800).subscribe(() => {
      this.connectionStateSignal.set('connected');
      this.startMockRealtime();
      this.startMockPresenceUpdates();
    });
  }

  selectRoom(roomId: string): void {
    const previousRoomId = this.activeRoomIdState();

    this.activeRoomIdState.set(roomId);
    this.typingState.set(null);
    this.updateRoom(roomId, (room) => ({
      ...room,
      unreadCount: 0
    }));

    if (this.realtimeTransport.enabled) {
      if (previousRoomId && previousRoomId !== roomId) {
        this.realtimeTransport.leaveRoom(previousRoomId);
      }

      this.realtimeTransport.joinRoom(roomId);
    }
  }

  sendMessage(content: string): void {
    const room = this.currentRoom();
    const messageBody = content.trim();

    if (!room || !messageBody) {
      return;
    }

    const message: Message = {
      id: this.createId('msg'),
      roomId: room.id,
      senderId: this.currentUserState().id,
      content: messageBody,
      timestamp: new Date().toISOString(),
      status: this.realtimeTransport.enabled ? 'sending' : 'sent'
    };

    this.upsertMessage(message);

    if (this.realtimeTransport.enabled) {
      this.realtimeTransport.sendMessage({
        messageId: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        content: message.content,
        timestamp: message.timestamp
      });
      this.realtimeTransport.setTyping(room.id, false);
      return;
    }

    this.scheduleStatusUpdate(message.id, room.id, 'delivered', 650);
    this.scheduleMockReply(room.id);
  }

  receiveMessage(message: Message): void {
    this.typingState.set(null);
    this.upsertMessage(message, message.roomId !== this.activeRoomIdState());
    this.incomingMessageSubject.next(message);
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
        // Keep socket errors visible during development and safe in production.
        console.error('[chat socket]', message);
      })
    );
  }

  private applySnapshot(snapshot: ChatSocketSnapshot): void {
    if (snapshot.currentUser) {
      this.currentUserState.set(snapshot.currentUser);
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
    }
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
    this.updateMessageStatus(payload.roomId, payload.messageId, payload.status);
  }

  private startMockRealtime(): void {
    this.mockRealtimeSubscription?.unsubscribe();
    this.mockRealtimeSubscription = timer(12_000, 18_000).subscribe(() => {
      const room = this.pickRandomRoom();
      const contact = this.resolveRoomContact(room);

      this.typingState.set({
        roomId: room.id,
        userId: contact.id
      });

      timer(1_600).subscribe(() => {
        const message: Message = {
          id: this.createId('msg'),
          roomId: room.id,
          senderId: contact.id,
          content: this.pickRandomReply(),
          timestamp: new Date().toISOString(),
          status: 'delivered'
        };

        this.receiveMessage(message);
      });
    });
  }

  private startMockPresenceUpdates(): void {
    this.mockPresenceSubscription?.unsubscribe();
    this.mockPresenceSubscription = timer(9_000, 14_000).subscribe(() => {
      const users = this.usersState().filter((user) => user.id !== this.currentUserState().id);
      const candidate = users[Math.floor(Math.random() * users.length)];

      if (!candidate) {
        return;
      }

      const nextPresence = this.nextPresence(candidate.presence);

      this.usersState.update((currentUsers) =>
        currentUsers.map((user) =>
          user.id === candidate.id
            ? {
                ...user,
                presence: nextPresence
              }
            : user
        )
      );
    });
  }

  private scheduleMockReply(roomId: string): void {
    const room = this.roomsState().find((currentRoom) => currentRoom.id === roomId);

    if (!room) {
      return;
    }

    const contact = this.resolveRoomContact(room);

    this.typingState.set({
      roomId,
      userId: contact.id
    });

    timer(1_400).subscribe(() => {
      const message: Message = {
        id: this.createId('msg'),
        roomId,
        senderId: contact.id,
        content: this.pickRandomReply(),
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };

      this.receiveMessage(message);
    });
  }

  private scheduleStatusUpdate(
    messageId: string,
    roomId: string,
    nextStatus: MessageStatus,
    delayMs: number
  ): void {
    timer(delayMs).subscribe(() => {
      this.updateMessageStatus(roomId, messageId, nextStatus);
    });
  }

  private upsertMessage(message: Message, incrementUnread = false): void {
    const isNewMessage = !this.messagesState()[message.roomId]?.some((currentMessage) => currentMessage.id === message.id);

    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [message.roomId]: isNewMessage
        ? [...(messagesByRoom[message.roomId] ?? []), message]
        : (messagesByRoom[message.roomId] ?? []).map((currentMessage) =>
            currentMessage.id === message.id ? message : currentMessage
          )
    }));

    this.updateRoom(message.roomId, (room) => ({
      ...room,
      unreadCount: incrementUnread && isNewMessage ? room.unreadCount + 1 : room.unreadCount,
      updatedAt: isNewMessage ? message.timestamp : room.updatedAt
    }));
  }

  private updateRoom(roomId: string, updater: (room: ChatRoom) => ChatRoom): void {
    this.roomsState.update((rooms) => rooms.map((room) => (room.id === roomId ? updater(room) : room)));
  }

  private updateMessageStatus(roomId: string, messageId: string, status: MessageStatus): void {
    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [roomId]: (messagesByRoom[roomId] ?? []).map((message) =>
        message.id === messageId
          ? {
              ...message,
              status
            }
          : message
      )
    }));
  }

  private resolveRoomContact(room: ChatRoom): User {
    const participantId =
      room.participantIds.find((participant) => participant !== this.currentUserState().id) ??
      this.currentUserState().id;

    return this.usersState().find((user) => user.id === participantId) ?? this.currentUserState();
  }

  private pickRandomRoom(): ChatRoom {
    const rooms = this.roomsState();
    return rooms[Math.floor(Math.random() * rooms.length)] ?? rooms[0];
  }

  private pickRandomReply(): string {
    return MOCK_AUTO_REPLIES[Math.floor(Math.random() * MOCK_AUTO_REPLIES.length)] ?? 'Sounds good.';
  }

  private nextPresence(currentPresence: UserPresence): UserPresence {
    switch (currentPresence) {
      case 'online':
        return 'away';
      case 'away':
        return 'offline';
      default:
        return 'online';
    }
  }

  private createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
