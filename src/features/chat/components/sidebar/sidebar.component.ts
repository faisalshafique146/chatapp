import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [DatePipe, AvatarComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly chatService = inject(ChatService);

  readonly roomPreviews = this.chatService.roomPreviews;
  readonly currentRoomId = this.chatService.currentRoomId;
  readonly chatSelected = output<void>();

  selectRoom(roomId: string): void {
    this.chatService.selectRoom(roomId);
    this.chatSelected.emit();
  }
}
