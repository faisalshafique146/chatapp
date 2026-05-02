import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { API_BASE_URL } from '../config/backend.config';
import { AuthSession, AuthUser, SignInPayload, SignUpPayload } from '../models/auth-user.model';

interface ApiEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
}

interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'chatapp.auth-session';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<AuthSession | null>(this.readSession());

  readonly session = computed(() => {
    const session = this.sessionState();

    return this.isSessionExpired(session) ? null : session;
  });
  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  signIn(payload: SignInPayload): Observable<AuthSession> {
    return this.http
      .post<ApiEnvelope<AuthPayload>>(`${API_BASE_URL}/auth/login`, {
        email: payload.email,
        password: payload.password
      })
      .pipe(
        map((response) => this.toSession(response.data)),
        tap((session) => this.persistSession(session))
      );
  }

  signUp(payload: SignUpPayload): Observable<AuthSession> {
    const formData = new FormData();
    formData.append('fullName', payload.fullName);
    formData.append('username', payload.handle);
    formData.append('email', payload.email);
    formData.append('password', payload.password);
    formData.append('acceptTerms', String(payload.acceptTerms));

    if (payload.profilePic) {
      formData.append('profilePic', payload.profilePic);
    }

    return this.http
      .post<ApiEnvelope<AuthPayload>>(`${API_BASE_URL}/auth/signup`, formData)
      .pipe(
        map((response) => this.toSession(response.data)),
        tap((session) => this.persistSession(session))
      );
  }

  signOut(): void {
    this.sessionState.set(null);

    if (this.canUseStorage()) {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private toSession(payload: AuthPayload): AuthSession {
    return {
      user: payload.user,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: payload.expiresAt
    };
  }

  private persistSession(session: AuthSession): void {
    this.sessionState.set(session);

    if (this.canUseStorage()) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(session));
    }
  }

  private readSession(): AuthSession | null {
    if (!this.canUseStorage()) {
      return null;
    }

    const storedValue = window.localStorage.getItem(this.storageKey);

    if (!storedValue) {
      return null;
    }

    try {
      const session = JSON.parse(storedValue) as AuthSession;

      if (this.isSessionExpired(session)) {
        window.localStorage.removeItem(this.storageKey);
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  private isSessionExpired(session: AuthSession | null): boolean {
    if (!session?.expiresAt) {
      return true;
    }

    const expiresAt = Date.parse(session.expiresAt);

    if (Number.isNaN(expiresAt)) {
      return true;
    }

    return expiresAt <= Date.now();
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId) && typeof window !== 'undefined';
  }
}
