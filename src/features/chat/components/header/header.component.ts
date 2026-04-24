import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ConnectionState } from '../../services/chat.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
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
}
