export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp: string;
  status: MessageStatus;
}
