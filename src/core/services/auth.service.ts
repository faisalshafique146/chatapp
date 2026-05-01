import { isPlatformBrowser } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { Observable, delay, of, tap } from 'rxjs';

import { AuthSession, AuthUser, SignInPayload, SignUpPayload } from '../models/auth-user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly storageKey = 'chatapp.auth-session';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly sessionState = signal<AuthSession | null>(this.readSession());

  readonly session = this.sessionState.asReadonly();
  readonly currentUser = computed(() => this.sessionState()?.user ?? null);
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  signIn(payload: SignInPayload): Observable<AuthSession> {
    const session = this.createSession({
      fullName: this.deriveDisplayName(payload.email),
      email: payload.email,
      handle: this.deriveHandle(payload.email),
      role: 'member'
    });

    return of(session).pipe(
      delay(450),
      tap((nextSession) => this.persistSession(nextSession))
    );
  }

  signUp(payload: SignUpPayload): Observable<AuthSession> {
    const session = this.createSession({
      fullName: payload.fullName,
      email: payload.email,
      handle: payload.handle,
      role: 'member'
    });

    return of(session).pipe(
      delay(550),
      tap((nextSession) => this.persistSession(nextSession))
    );
  }

  signOut(): void {
    this.sessionState.set(null);

    if (this.canUseStorage()) {
      window.localStorage.removeItem(this.storageKey);
    }
  }

  private createSession(userInput: {
    fullName: string;
    email: string;
    handle: string;
    role: AuthUser['role'];
  }): AuthSession {
    const createdAt = new Date().toISOString();

    return {
      user: {
        id: this.createId(),
        fullName: userInput.fullName,
        email: userInput.email.toLowerCase(),
        handle: this.normalizeHandle(userInput.handle),
        role: userInput.role,
        avatarInitials: this.createInitials(userInput.fullName),
        createdAt
      },
      accessToken: this.buildToken(userInput.email, 'access'),
      refreshToken: this.buildToken(userInput.email, 'refresh'),
      expiresAt: this.buildExpiry()
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
      return JSON.parse(storedValue) as AuthSession;
    } catch {
      return null;
    }
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId) && typeof window !== 'undefined';
  }

  private deriveDisplayName(email: string): string {
    const prefix = email.split('@')[0] || 'Hi-Sync user';
    return prefix
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private deriveHandle(email: string): string {
    const prefix = email.split('@')[0] || 'user';
    return prefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'hisync';
  }

  private normalizeHandle(handle: string): string {
    const trimmed = handle.trim().replace(/^@+/, '');
    return trimmed.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  }

  private createInitials(fullName: string): string {
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private buildToken(email: string, type: 'access' | 'refresh'): string {
    const payload = `${email}:${type}:${Date.now()}`;
    const encoded = typeof btoa === 'function' ? btoa(payload) : payload;
    return `${type}.${encoded}`;
  }

  private buildExpiry(): string {
    return new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
