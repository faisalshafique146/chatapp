export type AuthAccountRole = 'member' | 'owner' | 'admin';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  handle: string;
  role: AuthAccountRole;
  avatarInitials: string;
  workspaceName?: string;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface SignInPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignUpPayload {
  fullName: string;
  handle: string;
  email: string;
  password: string;
  workspaceName: string;
  acceptTerms: boolean;
}
