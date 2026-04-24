export type UserPresence = 'online' | 'offline' | 'away';

export interface User {
  id: string;
  name: string;
  accentColor: string;
  avatarUrl?: string;
  presence: UserPresence;
  statusMessage: string;
}
