import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, SidebarComponent, ChatWindowComponent],
  templateUrl: './chat-layout.component.html',
  styleUrl: './chat-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatLayoutComponent implements OnInit {
  private readonly chatService = inject(ChatService);

  readonly isMobile = signal(typeof window !== 'undefined' ? window.innerWidth < 900 : false);
  readonly showSidebar = signal(!(typeof window !== 'undefined' && window.innerWidth < 900));

  ngOnInit(): void {
    this.chatService.connect();

    if (!this.isMobile()) {
      this.showSidebar.set(true);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    const mobile = typeof window !== 'undefined' ? window.innerWidth < 900 : false;
    this.isMobile.set(mobile);
    this.showSidebar.set(!mobile);
  }

  handleChatSelected(): void {
    if (this.isMobile()) {
      this.showSidebar.set(false);
    }
  }

  handleBackRequested(): void {
    if (this.isMobile()) {
      this.showSidebar.set(true);
    }
  }
}
