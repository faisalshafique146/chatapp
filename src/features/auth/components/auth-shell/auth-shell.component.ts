import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  templateUrl: './auth-shell.component.html',
  styleUrl: './auth-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthShellComponent {
}
