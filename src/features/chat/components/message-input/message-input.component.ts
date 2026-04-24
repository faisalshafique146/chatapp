import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './message-input.component.html',
  styleUrl: './message-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageInputComponent {
  readonly messageSubmit = output<string>();

  readonly messageControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(1000)]
  });

  submitMessage(): void {
    const value = this.messageControl.value.trim();

    if (!value) {
      return;
    }

    this.messageSubmit.emit(value);
    this.messageControl.reset('');
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey) {
      return;
    }

    keyboardEvent.preventDefault();
    this.submitMessage();
  }
}
