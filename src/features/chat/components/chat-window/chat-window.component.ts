import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { HeaderComponent } from '../header/header.component';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';
import { MessageInputComponent } from '../message-input/message-input.component';
import { Message } from '../../../../core/models/message.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [HeaderComponent, MessageBubbleComponent, MessageInputComponent],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWindowComponent {
  private readonly chatService = inject(ChatService);
  private readonly themeService = inject(ThemeService);
  private readonly messageViewport = viewChild<ElementRef<HTMLDivElement>>('messageViewport');

  readonly currentUser = this.chatService.currentUser;
  readonly room = this.chatService.currentRoom;
  readonly messages = this.chatService.currentMessages;
  readonly contact = this.chatService.currentContact;
  readonly typingUser = this.chatService.typingUser;
  readonly connectionState = this.chatService.connectionState;
  readonly isDarkMode = this.themeService.isDarkMode;
  readonly showBackButton = input<boolean>(false);
  readonly backRequested = output<void>();
  readonly logoutRequested = output<void>();

  readonly headerSubtitle = computed(() => {
    const typingUser = this.typingUser();

    if (typingUser) {
      return `${typingUser.name} is typing...`;
    }

    const contact = this.contact();

    if (!contact) {
      return 'Choose a chat to start talking';
    }

    switch (contact.presence) {
      case 'online':
        return contact.statusMessage || 'Online now';
      case 'away':
        return 'Away right now';
      default:
        return 'Offline';
    }
  });

  constructor() {
    effect(() => {
      const viewport = this.messageViewport()?.nativeElement;
      const latestMessageId = this.messages().at(-1)?.id;

      if (!viewport || !latestMessageId) {
        return;
      }

      queueMicrotask(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    });
  }

  sendMessage(content: string, imageFile: File | null = null): void {
    this.chatService.sendMessage(content, imageFile);
  }

  isCurrentUserMessage(message: Message): boolean {
    return message.senderId === this.currentUser().id;
  }

  resolveSender(message: Message): User {
    return this.isCurrentUserMessage(message) ? this.currentUser() : this.contact() ?? this.currentUser();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
