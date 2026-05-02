import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  effect,
  signal
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { ConnectionState } from '../../services/chat.service';
import { ChatService } from '../../services/chat.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, AvatarComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
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
  readonly isProfileEditorOpen = signal(false);
  readonly isSavingProfile = signal(false);
  readonly isSavingPassword = signal(false);
  readonly copyStatus = signal<'email' | 'handle' | null>(null);
  readonly profileError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSuccess = signal<string | null>(null);
  readonly selectedProfilePic = signal<File | null>(null);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly profileNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3)]
  });
  readonly currentPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)]
  });
  readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)]
  });
  readonly confirmNewPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)]
  });

  private readonly allowedProfileImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
  private readonly maxProfileImageSize = 5 * 1024 * 1024;

  constructor() {
    effect(() => {
      const user = this.currentUser();

      if (!user) {
        return;
      }

      this.profileNameControl.setValue(user.fullName, { emitEvent: false });
    });
  }

  toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((current) => !current);
  }

  closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
    this.closeProfileEditor();
  }

  openProfileEditor(): void {
    const user = this.currentUser();

    if (!user) {
      return;
    }

    this.isAccountMenuOpen.set(false);
    this.profileNameControl.setValue(user.fullName, { emitEvent: false });
    this.profileError.set(null);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    this.selectedProfilePic.set(null);
    this.currentPasswordControl.reset('');
    this.newPasswordControl.reset('');
    this.confirmNewPasswordControl.reset('');
    this.isProfileEditorOpen.set(true);
  }

  closeProfileEditor(): void {
    this.isProfileEditorOpen.set(false);
    this.profileError.set(null);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);
    this.selectedProfilePic.set(null);
    this.currentPasswordControl.reset('');
    this.newPasswordControl.reset('');
    this.confirmNewPasswordControl.reset('');
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

  handleProfilePicSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedProfilePic.set(null);
      return;
    }

    if (!this.allowedProfileImageTypes.has(file.type)) {
      this.profileError.set('Please choose a supported image file.');
      input.value = '';
      return;
    }

    if (file.size > this.maxProfileImageSize) {
      this.profileError.set('Image attachments must be 5 MB or smaller.');
      input.value = '';
      return;
    }

    this.selectedProfilePic.set(file);
    this.profileError.set(null);
  }

  removeSelectedProfilePic(): void {
    this.selectedProfilePic.set(null);
  }

  saveProfile(): void {
    const user = this.currentUser();
    const fullName = this.profileNameControl.value.trim();
    const profilePic = this.selectedProfilePic();

    if (!user || this.profileNameControl.invalid || this.isSavingProfile()) {
      this.profileNameControl.markAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    this.profileError.set(null);

    this.authService.updateProfile({ fullName }).subscribe({
      next: () => {
        this.chatService.refreshCurrentUserFromSession();

        if (!profilePic) {
          this.isSavingProfile.set(false);
          this.closeProfileEditor();
          this.closeAccountMenu();
          return;
        }

        this.authService.updateProfileAvatar(profilePic).subscribe({
          next: () => {
            this.chatService.refreshCurrentUserFromSession();
            this.isSavingProfile.set(false);
            this.closeProfileEditor();
            this.closeAccountMenu();
          },
          error: (error) => {
            this.isSavingProfile.set(false);
            this.profileError.set(getHttpErrorMessage(error, 'Your name was updated, but the profile image could not be uploaded.'));
          }
        });
      },
      error: (error) => {
        this.isSavingProfile.set(false);
        this.profileError.set(getHttpErrorMessage(error, 'Unable to update your profile.'));
      }
    });
  }

  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  savePassword(): void {
    if (this.isSavingPassword()) {
      return;
    }

    const currentPassword = this.currentPasswordControl.value.trim();
    const newPassword = this.newPasswordControl.value.trim();
    const confirmNewPassword = this.confirmNewPasswordControl.value.trim();

    this.passwordError.set(null);
    this.passwordSuccess.set(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      this.currentPasswordControl.markAsTouched();
      this.newPasswordControl.markAsTouched();
      this.confirmNewPasswordControl.markAsTouched();
      this.passwordError.set('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      this.passwordError.set('The new passwords do not match.');
      return;
    }

    this.isSavingPassword.set(true);

    this.authService.changePassword({
      currentPassword,
      newPassword,
      confirmNewPassword
    }).subscribe({
      next: () => {
        this.isSavingPassword.set(false);
        this.passwordSuccess.set('Password updated successfully.');
        this.currentPasswordControl.reset('');
        this.newPasswordControl.reset('');
        this.confirmNewPasswordControl.reset('');
      },
      error: (error) => {
        this.isSavingPassword.set(false);
        this.passwordError.set(getHttpErrorMessage(error, 'Unable to update your password.'));
      }
    });
  }

  cancelProfileEdit(): void {
    this.closeProfileEditor();
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
