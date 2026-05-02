import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, signal, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

const allowedAttachmentTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const maxAttachmentSize = 5 * 1024 * 1024;

export interface MessageSubmitPayload {
  content: string;
  imageFile: File | null;
}

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageInputComponent implements OnDestroy {
  readonly messageSubmit = output<MessageSubmitPayload>();
  readonly typingChanged = output<boolean>();

  readonly messageControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)]
  });
  readonly selectedImage = signal<File | null>(null);
  readonly selectedImageError = signal<string | null>(null);

  private typingState: boolean | null = null;
  private typingResetTimer?: ReturnType<typeof setTimeout>;

  submitMessage(): void {
    const value = this.messageControl.value.trim();
    const imageFile = this.selectedImage();

    if (!value && !imageFile) {
      return;
    }

    this.messageSubmit.emit({
      content: value,
      imageFile
    });
    this.setTyping(false);
    this.messageControl.reset('');
    this.clearAttachment();
  }

  handleMessageInput(): void {
    const hasContent = this.messageControl.value.trim().length > 0 || !!this.selectedImage();

    this.setTyping(hasContent);
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey) {
      return;
    }

    keyboardEvent.preventDefault();
    this.submitMessage();
  }

  handleImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.clearAttachment();
      return;
    }

    if (!allowedAttachmentTypes.has(file.type)) {
      this.selectedImage.set(null);
      this.selectedImageError.set('Please choose a supported image file.');
      input.value = '';
      return;
    }

    if (file.size > maxAttachmentSize) {
      this.selectedImage.set(null);
      this.selectedImageError.set('Image attachments must be 5 MB or smaller.');
      input.value = '';
      return;
    }

    this.selectedImage.set(file);
    this.selectedImageError.set(null);
  }

  removeAttachment(): void {
    this.clearAttachment();
  }

  ngOnDestroy(): void {
    this.setTyping(false);
    this.clearTypingTimer();
  }

  private clearAttachment(): void {
    this.selectedImage.set(null);
    this.selectedImageError.set(null);
  }

  private setTyping(isTyping: boolean): void {
    if (this.typingState === isTyping) {
      if (isTyping) {
        this.restartTypingTimer();
      }

      return;
    }

    this.typingState = isTyping;
    this.typingChanged.emit(isTyping);

    if (isTyping) {
      this.restartTypingTimer();
    } else {
      this.clearTypingTimer();
    }
  }

  private restartTypingTimer(): void {
    this.clearTypingTimer();
    this.typingResetTimer = setTimeout(() => {
      this.setTyping(false);
    }, 1500);
  }

  private clearTypingTimer(): void {
    if (this.typingResetTimer) {
      clearTimeout(this.typingResetTimer);
      this.typingResetTimer = undefined;
    }
  }
}
