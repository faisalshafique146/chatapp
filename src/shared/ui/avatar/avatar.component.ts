import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly accentColor = input<string>('#155c48');
  readonly imageUrl = input<string | undefined>(undefined);
  readonly size = input<AvatarSize>('md');
  readonly online = input<boolean>(false);

  readonly initials = computed(() =>
    this.name()
      .split(' ')
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2)
  );
}
