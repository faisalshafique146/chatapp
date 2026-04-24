import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Message } from '../../../../core/models/message.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './message-bubble.component.html',
  styleUrl: './message-bubble.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubbleComponent {
  readonly message = input.required<Message>();
  readonly sender = input.required<User>();
  readonly isCurrentUser = input<boolean>(false);

  readonly accessibleStatus = computed(() => {
    switch (this.message().status) {
      case 'read':
        return 'Read';
      case 'delivered':
        return 'Delivered';
      case 'sent':
        return 'Sent';
      default:
        return 'Sending';
    }
  });
}
