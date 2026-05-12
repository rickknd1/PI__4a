import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConversationService } from '../../services/Messaging/conversation.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AuthService } from "../../shared/services/auth.service";

export interface UserSimple {
    userId: string;
    fullName: string;
}

export interface SelectedParticipant {
    user: UserSimple;
    role: 'SUPERADMIN' | 'ADMIN' | 'MEMBRE';
}

@Component({
    selector: 'app-new-group-chat-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './new-group-chat-modal.component.html',
})
export class NewGroupChatModalComponent {
    private currentUserId: string = '';
    @Output() close = new EventEmitter<void>();
    @Output() conversationCreated = new EventEmitter<any>();

    currentStep = 1;
    groupName = '';
    searchTerm = '';
    searchResults: UserSimple[] = [];
    selectedParticipants: SelectedParticipant[] = [];

    loading = false;
    errorMessage = '';

    private searchSubject = new Subject<string>();

    constructor(private conversationService: ConversationService, private authService: AuthService) {
        this.currentUserId = this.authService.getCurrentUser()?.userId ?? '';

        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => this.conversationService.searchUsers(query))
        ).subscribe(results => {
            // On exclut les utilisateurs déjà sélectionnés et soi-même
            this.searchResults = results.filter(
                u => u.userId !== this.currentUserId &&
                    !this.selectedParticipants.some(p => p.user.userId === u.userId)
            );
        });
    }

    onSearchInput() {
        if (this.searchTerm.trim()) {
            this.searchSubject.next(this.searchTerm);
        } else {
            this.searchResults = [];
        }
    }

    selectUser(user: UserSimple) {
        this.selectedParticipants.push({ user, role: 'MEMBRE' });
        this.searchTerm = '';
        this.searchResults = [];
    }

    removeParticipant(userId: string) {
        this.selectedParticipants = this.selectedParticipants.filter(
            p => p.user.userId !== userId
        );
    }

    goToStep2() {
        if (!this.groupName.trim()) {
            this.errorMessage = 'Veuillez entrer un nom de groupe.';
            return;
        }
        this.errorMessage = '';
        this.currentStep = 2;
    }

    createGroup() {
        if (this.selectedParticipants.length === 0) {
            this.errorMessage = 'Ajoutez au moins un participant.';
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        const conversation = {
            nom: this.groupName,
            type: 'GROUP',
            createdByUserId: this.currentUserId
        };

        this.conversationService.createConversation(conversation).subscribe({
            next: (newConv) => {
                // ✅ Backend already added creator as SUPERADMIN
                // Only add the other selected participants
                const adds = this.selectedParticipants.map(p =>
                    this.conversationService.addParticipant(newConv.id, p.user.userId, p.role)
                );
                Promise.all(adds.map(obs => obs.toPromise())).then(() => {
                    this.loading = false;
                    this.conversationCreated.emit(newConv);
                    this.closeModal();
                }).catch(() => {
                    this.loading = false;
                    this.errorMessage = 'Groupe créé mais certains participants n\'ont pas pu être ajoutés.';
                });
            },
            error: () => {
                this.loading = false;
                this.errorMessage = 'Échec de la création du groupe.';
            }
        });
    }

    closeModal() {
        this.groupName = '';
        this.searchTerm = '';
        this.searchResults = [];
        this.selectedParticipants = [];
        this.currentStep = 1;
        this.errorMessage = '';
        this.close.emit();
    }

    /**
     * Amélioration UI pour les badges de rôle
     */
    getRoleBadgeClass(role: string): string {
        switch (role) {
            case 'SUPERADMIN': return 'text-purple-600 font-black';
            case 'ADMIN':      return 'text-indigo-600 font-black';
            default:           return 'text-slate-400 font-bold';
        }
    }
}