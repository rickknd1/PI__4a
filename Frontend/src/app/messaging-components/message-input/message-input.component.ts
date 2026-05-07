import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

export interface MessagePayload {
  text: string;
  file?: File;
  fileType?: 'IMAGE' | 'FILE';
}

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent],
  templateUrl: './message-input.component.html',
  styleUrls: ['./message-input.component.css']
})
export class MessageInputComponent {
  messageText = '';
  showEmojiPicker = false;

  // Attachment state
  attachedFile: File | null = null;
  attachedFileType: 'IMAGE' | 'FILE' | null = null;
  imagePreviewUrl: string | null = null;
  isUploading = false;

  @Output() send = new EventEmitter<MessagePayload>();

  @ViewChild('imageInput') imageInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // ─── Emoji ────────────────────────────────────────────────────────────────

  handleEmojiSelect(event: any) {
    this.messageText += event.emoji.native || `:${event.emoji.id}:`;
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  // ─── Image picker ─────────────────────────────────────────────────────────

  triggerImagePicker() {
    this.imageInputRef.nativeElement.value = '';
    this.imageInputRef.nativeElement.click();
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.clearAttachment();
    this.attachedFile = file;
    this.attachedFileType = 'IMAGE';

    const reader = new FileReader();
    reader.onload = () => { this.imagePreviewUrl = reader.result as string; };
    reader.readAsDataURL(file);
  }

  // ─── File picker ──────────────────────────────────────────────────────────

  triggerFilePicker() {
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // If user picks an image via the file picker, treat it as IMAGE
    if (file.type.startsWith('image/')) {
      this.clearAttachment();
      this.attachedFile = file;
      this.attachedFileType = 'IMAGE';
      const reader = new FileReader();
      reader.onload = () => { this.imagePreviewUrl = reader.result as string; };
      reader.readAsDataURL(file);
    } else {
      this.clearAttachment();
      this.attachedFile = file;
      this.attachedFileType = 'FILE';
      this.imagePreviewUrl = null;
    }
  }

  clearAttachment() {
    this.attachedFile = null;
    this.attachedFileType = null;
    this.imagePreviewUrl = null;
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  get canSend(): boolean {
    return !this.isUploading && (!!this.messageText.trim() || !!this.attachedFile);
  }

  onSend() {
    if (!this.canSend) return;

    this.send.emit({
      text: this.messageText.trim(),
      file: this.attachedFile ?? undefined,
      fileType: this.attachedFileType ?? undefined
    });

    this.messageText = '';
    this.clearAttachment();
    this.showEmojiPicker = false;
  }

  handleEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
      (event.target as HTMLTextAreaElement).style.height = 'auto';
    }
  }

  adjustHeight(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}