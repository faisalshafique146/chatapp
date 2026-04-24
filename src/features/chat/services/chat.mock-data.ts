import { ChatRoom } from '../../../core/models/chat-room.model';
import { Message } from '../../../core/models/message.model';
import { User } from '../../../core/models/user.model';

const now = Date.now();

const minutesAgo = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();

export const MOCK_CURRENT_USER: User = {
  id: 'me',
  name: 'You',
  accentColor: '#155c48',
  presence: 'online',
  statusMessage: 'Available'
};

export const MOCK_USERS: User[] = [
  MOCK_CURRENT_USER,
  {
    id: 'user-sara',
    name: 'Sara Parker',
    accentColor: '#ff7a59',
    presence: 'online',
    statusMessage: 'Shipping the new onboarding flow'
  },
  {
    id: 'user-liam',
    name: 'Liam Chen',
    accentColor: '#3a86ff',
    presence: 'away',
    statusMessage: 'Reviewing support inbox'
  },
  {
    id: 'user-noor',
    name: 'Noor Ahmed',
    accentColor: '#9b5de5',
    presence: 'offline',
    statusMessage: 'Back after lunch'
  }
];

export const MOCK_CHAT_ROOMS: ChatRoom[] = [
  {
    id: 'room-sara',
    participantIds: ['me', 'user-sara'],
    unreadCount: 0,
    updatedAt: minutesAgo(2)
  },
  {
    id: 'room-liam',
    participantIds: ['me', 'user-liam'],
    unreadCount: 2,
    updatedAt: minutesAgo(11)
  },
  {
    id: 'room-noor',
    participantIds: ['me', 'user-noor'],
    unreadCount: 0,
    updatedAt: minutesAgo(35)
  }
];

export const MOCK_MESSAGES_BY_ROOM: Record<string, Message[]> = {
  'room-sara': [
    {
      id: 'msg-sara-1',
      roomId: 'room-sara',
      senderId: 'user-sara',
      content: 'Morning. Do you want the revised product copy before standup?',
      timestamp: minutesAgo(24),
      status: 'read'
    },
    {
      id: 'msg-sara-2',
      roomId: 'room-sara',
      senderId: 'me',
      content: 'Yes please. Share it here and I will review it in the next few minutes.',
      timestamp: minutesAgo(21),
      status: 'read'
    },
    {
      id: 'msg-sara-3',
      roomId: 'room-sara',
      senderId: 'user-sara',
      content: 'Perfect. I tightened the hero section and CTA so it feels more conversational.',
      timestamp: minutesAgo(2),
      status: 'read'
    }
  ],
  'room-liam': [
    {
      id: 'msg-liam-1',
      roomId: 'room-liam',
      senderId: 'me',
      content: 'How are we looking on the support queue?',
      timestamp: minutesAgo(52),
      status: 'read'
    },
    {
      id: 'msg-liam-2',
      roomId: 'room-liam',
      senderId: 'user-liam',
      content: 'Pretty healthy. We had a spike from the password reset rollout though.',
      timestamp: minutesAgo(43),
      status: 'read'
    },
    {
      id: 'msg-liam-3',
      roomId: 'room-liam',
      senderId: 'user-liam',
      content: 'I drafted a short macro for the repeated billing question.',
      timestamp: minutesAgo(11),
      status: 'delivered'
    }
  ],
  'room-noor': [
    {
      id: 'msg-noor-1',
      roomId: 'room-noor',
      senderId: 'user-noor',
      content: 'The dashboard charts are finally matching the analytics export.',
      timestamp: minutesAgo(61),
      status: 'read'
    },
    {
      id: 'msg-noor-2',
      roomId: 'room-noor',
      senderId: 'me',
      content: 'That is excellent news. Let us share a quick screenshot in the team channel later.',
      timestamp: minutesAgo(35),
      status: 'delivered'
    }
  ]
};

export const MOCK_AUTO_REPLIES: readonly string[] = [
  'That works for me.',
  'I can take the next pass on that.',
  'Let me double check the details and get back to you.',
  'Looks good from my side so far.',
  'Nice. I will keep the thread updated.',
  'I am online now if you want to sync live.'
];
