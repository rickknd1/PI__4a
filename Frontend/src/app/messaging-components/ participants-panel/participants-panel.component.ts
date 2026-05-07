import {Component, Input, Output, EventEmitter, OnInit, NgZone, ChangeDetectorRef} from '@angular/core';
import { ConversationParticipant, ParticipantService } from '../../services/Messaging/participant.service';
import { ConversationService } from '../../services/Messaging/conversation.service';
import { SupabaseService } from '../../services/Messaging/supabase.service';
import { FormsModule } from "@angular/forms";
import { AddParticipantFormComponent } from "./add-participant-form.component";
import { CommonModule } from '@angular/common';

export type SidebarView = 'MENU' | 'MEMBERS' | 'EDIT_PHOTO' | 'EDIT_NAME' | 'USER_DETAILS';

@Component({
    selector: 'app-participants-panel',
    standalone: true,
    imports: [CommonModule, FormsModule, AddParticipantFormComponent],
    templateUrl: './participants-panel.component.html',
})
export class ParticipantsPanelComponent implements OnInit {
    @Input() conversationId!: string;
    @Input() currentUserId!: string;
    @Input() isGroup: boolean = false;
    @Input() groupName: string = 'dev';

    @Output() groupNameChanged = new EventEmitter<string>();
    @Output() groupPhotoChanged = new EventEmitter<string>();

    currentView: SidebarView = 'MENU';
    participants: ConversationParticipant[] = [];
    selectedParticipant: ConversationParticipant | null = null;
    showAddModal = false;

    newName: string = '';
    imagePreview: string | ArrayBuffer | null = null;
    selectedFile: File | null = null;
    isUploadingPhoto = false;

    constructor(
        private participantService: ParticipantService,
        private conversationService: ConversationService,
        private supabaseService: SupabaseService,
        private ngZone: NgZone,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.loadParticipants();
        this.newName = this.groupName;
    }

    setView(view: SidebarView) {
        this.currentView = view;
        if (view !== 'USER_DETAILS') this.selectedParticipant = null;
        if (view !== 'EDIT_PHOTO') {
            this.imagePreview = null;
            this.selectedFile = null;
        }
    }

    get currentParticipant() {
        return this.participants.find(p => p.userId === this.currentUserId);
    }

    get isAdmin() {
        return ['ADMIN', 'SUPERADMIN'].includes(this.currentParticipant?.role ?? '');
    }

    updateGroupName() {
        if (!this.newName.trim()) return;
        this.conversationService.updateName(this.conversationId, this.newName).subscribe({
            next: () => {
                this.groupName = this.newName;
                this.groupNameChanged.emit(this.newName);
                this.setView('MENU');
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Failed to update name', err)
        });
    }

    async saveGroupPhoto() {
        if (!this.selectedFile) return;
        this.isUploadingPhoto = true;

        try {
            console.log('1. Starting upload...');
            const photoUrl = await this.supabaseService.uploadGroupPhoto(
                this.conversationId,
                this.selectedFile
            );
            console.log('2. Supabase upload done, photoUrl:', photoUrl);

            this.conversationService.updatePhotoUrl(this.conversationId, photoUrl).subscribe({
                next: (res) => {
                    console.log('3. Spring PATCH success:', res);
                    this.selectedFile = null;
                    this.isUploadingPhoto = false;
                    this.imagePreview = null;
                    this.currentView = 'MENU';
                    this.cdr.markForCheck();
                    this.cdr.detectChanges();
                    setTimeout(() => {
                        this.groupPhotoChanged.emit(photoUrl);
                    }, 100);
                },
                error: (err) => {
                    console.error('3. Spring PATCH failed:', err.status, err.error);
                    this.ngZone.run(() => {
                        this.isUploadingPhoto = false;
                    });
                }
            });
        } catch (err) {
            console.error('2. Supabase upload failed:', err);
            this.ngZone.run(() => {
                this.isUploadingPhoto = false;
            });
        }
    }

    removeParticipant(userId: string): void {
        if (confirm(`Voulez-vous retirer ${userId} ?`)) {
            this.participantService.removeParticipant(this.conversationId, userId).subscribe({
                next: () => {
                    this.loadParticipants();
                    this.setView('MEMBERS');
                },
                error: (err) => console.error(err)
            });
        }
    }

    loadParticipants(): void {
        this.participantService.getParticipants(this.conversationId).subscribe({
            next: (data) => { this.participants = data; },
            error: () => {}
        });
    }

    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.compressImage(file).then(compressed => {
                this.selectedFile = compressed;
                const reader = new FileReader();
                reader.onload = () => { this.imagePreview = reader.result; };
                reader.readAsDataURL(compressed);
            });
        }
    }

    private compressImage(file: File): Promise<File> {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const maxSize = 800;
                let { width, height } = img;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    URL.revokeObjectURL(url);
                    resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.8);
            };

            img.src = url;
        });
    }

    onParticipantAdded() {
        this.showAddModal = false;
        this.loadParticipants();
    }

    viewUserDetails(participant: ConversationParticipant): void {
        this.selectedParticipant = participant;
        this.setView('USER_DETAILS');
    }

    getRoleBadgeClass(role: string): string {
        const baseClasses = "text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest mt-0.5 block w-fit border";
        switch (role?.toUpperCase()) {
            case 'SUPERADMIN': return `${baseClasses} bg-purple-50 text-purple-600 border-purple-100`;
            case 'ADMIN': return `${baseClasses} bg-indigo-50 text-indigo-600 border-indigo-100`;
            default: return `${baseClasses} bg-slate-50 text-slate-500 border-slate-100`;
        }
    }
}