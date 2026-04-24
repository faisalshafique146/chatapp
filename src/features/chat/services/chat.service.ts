import { computed, Injectable, signal } from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';
import { ChatRoom } from '../../../core/models/chat-room.model';
import { Message, MessageStatus } from '../../../core/models/message.model';
import { User, UserPresence } from '../../../core/models/user.model';
import {
  MOCK_AUTO_REPLIES,
  MOCK_CHAT_ROOMS,
  MOCK_CURRENT_USER,
  MOCK_MESSAGES_BY_ROOM,
  MOCK_USERS
} from './chat.mock-data';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

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
export class ChatService {
  private readonly currentUserState = signal<User>(MOCK_CURRENT_USER);
  private readonly usersState = signal<User[]>(MOCK_USERS);
  private readonly roomsState = signal<ChatRoom[]>(MOCK_CHAT_ROOMS);
  private readonly messagesState = signal<Record<string, Message[]>>(MOCK_MESSAGES_BY_ROOM);
  private readonly activeRoomIdState = signal<string>(MOCK_CHAT_ROOMS[0]?.id ?? '');
  private readonly typingState = signal<TypingState | null>(null);
  private readonly connectionStateSignal = signal<ConnectionState>('disconnected');

  private readonly incomingMessageSubject = new Subject<Message>();
  private mockRealtimeSubscription?: Subscription;
  private mockPresenceSubscription?: Subscription;

  readonly currentUser = this.currentUserState.asReadonly();
  readonly users = this.usersState.asReadonly();
  readonly currentRoomId = this.activeRoomIdState.asReadonly();
  readonly connectionState = this.connectionStateSignal.asReadonly();
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

  connect(): void {
    if (this.connectionStateSignal() !== 'disconnected') {
      return;
    }

    this.connectionStateSignal.set('connecting');

    // This placeholder keeps the API shape ready for a future Socket.IO transport.
    timer(800).subscribe(() => {
      this.connectionStateSignal.set('connected');
      this.startMockRealtime();
      this.startMockPresenceUpdates();
    });
  }

  selectRoom(roomId: string): void {
    this.activeRoomIdState.set(roomId);
    this.typingState.set(null);
    this.updateRoom(roomId, (room) => ({
      ...room,
      unreadCount: 0
    }));
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
      status: 'sent'
    };

    this.appendMessage(message);
    this.scheduleStatusUpdate(message.id, room.id, 'delivered', 650);
    this.scheduleMockReply(room.id);
  }

  receiveMessage(message: Message): void {
    // Future socket integrations can push normalized inbound events through here.
    this.typingState.set(null);
    this.appendMessage(message, message.roomId !== this.activeRoomIdState());
    this.incomingMessageSubject.next(message);
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
      this.messagesState.update((messagesByRoom) => ({
        ...messagesByRoom,
        [roomId]: (messagesByRoom[roomId] ?? []).map((message) =>
          message.id === messageId
            ? {
                ...message,
                status: nextStatus
              }
            : message
        )
      }));
    });
  }

  private appendMessage(message: Message, incrementUnread = false): void {
    this.messagesState.update((messagesByRoom) => ({
      ...messagesByRoom,
      [message.roomId]: [...(messagesByRoom[message.roomId] ?? []), message]
    }));

    this.updateRoom(message.roomId, (room) => ({
      ...room,
      unreadCount: incrementUnread ? room.unreadCount + 1 : room.unreadCount,
      updatedAt: message.timestamp
    }));
  }

  private updateRoom(roomId: string, updater: (room: ChatRoom) => ChatRoom): void {
    this.roomsState.update((rooms) => rooms.map((room) => (room.id === roomId ? updater(room) : room)));
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
