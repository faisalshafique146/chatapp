import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal, output } from '@angular/core';
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
export class MessageInputComponent {
  readonly messageSubmit = output<MessageSubmitPayload>();

  readonly messageControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)]
  });
  readonly selectedImage = signal<File | null>(null);
  readonly selectedImageError = signal<string | null>(null);

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
    this.messageControl.reset('');
    this.clearAttachment();
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

  private clearAttachment(): void {
    this.selectedImage.set(null);
    this.selectedImageError.set(null);
  }
}
