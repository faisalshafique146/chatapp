export type UserPresence = 'online' | 'offline' | 'away';

export interface User {
  id: string;
  name: string;
  accentColor: string;
  avatarUrl?: string;
  presence: UserPresence;
  statusMessage: string;
  fullName?: string;
  email?: string;
  handle?: string;
  profilePic?: string | null;
  createdAt?: string;
}
