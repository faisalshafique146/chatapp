export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  receiverId?: string;
  content: string;
  imageUrl?: string | null;
  timestamp: string;
  status: MessageStatus;
  clientMessageId?: string | null;
}
