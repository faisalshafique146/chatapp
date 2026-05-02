import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthShellComponent } from '../../components/auth-shell/auth-shell.component';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly isDarkMode = this.themeService.isDarkMode;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [true]
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.authService.signIn(this.form.getRawValue()).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/chat');
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        this.submitError.set(
          error.error?.message ?? error.message ?? 'Sign in failed. Please check your credentials.'
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
}
