import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthShellComponent {
  private readonly themeService = inject(ThemeService);

  readonly isDarkMode = this.themeService.isDarkMode;

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
