import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'chatapp-theme';

  private readonly darkModeState = signal(this.resolveInitialMode());

  readonly isDarkMode = this.darkModeState.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.isDarkMode() ? 'dark' : 'light';
      this.document.documentElement.dataset['theme'] = theme;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(this.storageKey, theme);
      }
    });
  }

  toggleTheme(): void {
    this.darkModeState.update((currentMode) => !currentMode);
  }

  private resolveInitialMode(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedTheme = window.localStorage.getItem(this.storageKey);

    if (storedTheme === 'dark') {
      return true;
    }

    if (storedTheme === 'light') {
      return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
