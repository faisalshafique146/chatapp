import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ValidationErrors, ValidatorFn } from '@angular/forms';

const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
};

const allowedProfileImageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const maxProfileImageSize = 5 * 1024 * 1024;

const profileImageValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const file = control.value as File | null;

  if (!file) {
    return null;
  }

  if (!allowedProfileImageTypes.has(file.type)) {
    return { invalidFileType: true };
  }

  if (file.size > maxProfileImageSize) {
    return { fileTooLarge: true };
  }

  return null;
};

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly isDarkMode = this.themeService.isDarkMode;

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      handle: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      profilePic: [null as File | null, [profileImageValidator]],
      acceptTerms: [false, [Validators.requiredTrue]]
    },
    { validators: passwordMatchValidator }
  );

  submit(): void {
    this.submitAttempted.set(true);

    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      this.submitError.set('Please fix the highlighted fields before creating your account.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const { confirmPassword, ...payload } = this.form.getRawValue();

    this.authService.signUp(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/chat');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.submitError.set(
          error.error?.message ??
            error.message ??
            'Sign up failed. Please check your details and try again.'
        );
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((current) => !current);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onProfilePicSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.form.controls.profilePic.setValue(file);
    this.form.controls.profilePic.markAsTouched();
    this.form.controls.profilePic.updateValueAndValidity();
  }
}
