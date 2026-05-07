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

@Component({
    selector: 'app-new-private-chat-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './new-private-chat-modal.component.html'
})
export class NewPrivateChatModalComponent {
    private currentUserId: string = '';

    @Output() close = new EventEmitter<void>();
    @Output() conversationCreated = new EventEmitter<any>();

    searchTerm = '';
    searchResults: UserSimple[] = [];
    selectedUser: UserSimple | null = null;
    loading = false;
    errorMessage = '';

    private searchSubject = new Subject<string>();

    constructor(private conversationService: ConversationService, private authService: AuthService) {
        this.currentUserId = this.authService.getCurrentUser()?.userId ?? '';
        this.setupSearch();
    }

    private setupSearch() {
        this.searchSubject.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(query => this.conversationService.searchUsers(query))
        ).subscribe(results => {
            // On masque l'utilisateur actuel des résultats
            this.searchResults = results.filter(u => u.userId !== this.currentUserId);
        });
    }

    onSearchInput() {
        if (this.searchTerm.trim().length >= 2) {
            this.searchSubject.next(this.searchTerm);
        } else {
            this.searchResults = [];
        }
    }

    selectUser(user: UserSimple) {
        this.selectedUser = user;
        this.searchTerm = user.fullName;
        this.searchResults = [];
    }

    createConversation() {
        if (!this.selectedUser) return;

        this.loading = true;
        this.errorMessage = '';

        this.conversationService.createPrivate(this.currentUserId, this.selectedUser.userId)
            .subscribe({
                next: (newConv) => {
                    this.loading = false;
                    this.conversationCreated.emit(newConv);
                    this.closeModal();
                },
                error: (err) => {
                    this.loading = false;
                    this.errorMessage = err.status === 400
                        ? 'Utilisateur introuvable.'
                        : 'Une erreur est survenue lors de la création.';
                }
            });
    }

    closeModal() {
        this.searchTerm = '';
        this.searchResults = [];
        this.selectedUser = null;
        this.errorMessage = '';
        this.close.emit();
    }
}