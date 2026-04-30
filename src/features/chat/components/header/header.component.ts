import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { ConnectionState } from '../../services/chat.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [DatePipe, AvatarComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly accentColor = input.required<string>();
  readonly avatarUrl = input<string | undefined>(undefined);
  readonly isOnline = input<boolean>(false);
  readonly showBackButton = input<boolean>(false);
  readonly isDarkMode = input<boolean>(false);
  readonly connectionState = input<ConnectionState>('disconnected');

  readonly back = output<void>();
  readonly themeToggle = output<void>();
  readonly logoutRequested = output<void>();

  readonly currentUser = this.authService.currentUser;
  readonly isAccountMenuOpen = signal(false);
  readonly copyStatus = signal<'email' | 'handle' | null>(null);

  toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((current) => !current);
  }

  closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeToggle.emit();
    this.closeAccountMenu();
  }

  async copyValue(value: string, kind: 'email' | 'handle'): Promise<void> {
    if (!value) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }

      this.copyStatus.set(kind);
      window.setTimeout(() => this.copyStatus.set(null), 1200);
    } catch {
      this.copyStatus.set(null);
    }
  }

  logout(): void {
    this.closeAccountMenu();
    this.logoutRequested.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isAccountMenuOpen()) {
      return;
    }

    const target = event.target as Node | null;

    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeAccountMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
  }
}
