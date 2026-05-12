// add-participant-form.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ParticipantService } from '../../services/Messaging/participant.service';
import {FormsModule} from "@angular/forms";
import {NgIf} from "@angular/common";

@Component({
    selector: 'app-add-participant-form',
    imports: [
        FormsModule,
        NgIf
    ],
    template: `
        <input type="text" [(ngModel)]="userId"
               placeholder="User ID..."
               class="w-full px-4 py-3 border border-gray-300 rounded-xl mb-2 focus:outline-none focus:border-blue-500"/>

        <select [(ngModel)]="role"
                class="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:border-blue-500">
            <option value="MEMBRE">Membre</option>
            <option value="ADMIN">Admin</option>
        </select>

        <div *ngIf="error" class="text-red-500 text-sm mb-3 p-2 bg-red-50 rounded-lg">{{ error }}</div>

        <div class="flex gap-3">
            <button (click)="cancelled.emit()"
                    class="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
            </button>
            <button (click)="submit()" [disabled]="!userId || loading"
                    class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition">
                {{ loading ? 'Adding...' : 'Add' }}
            </button>
        </div>
    `
})
export class AddParticipantFormComponent {
    @Input() conversationId!: string;
    @Output() added = new EventEmitter<void>();
    @Output() cancelled = new EventEmitter<void>();

    userId = '';
    role: 'MEMBRE' | 'ADMIN' = 'MEMBRE';
    loading = false;
    error = '';

    constructor(private participantService: ParticipantService) {}

    submit(): void {
        this.loading = true;
        this.participantService.addParticipant(this.conversationId, {
            conversationId: this.conversationId,
            userId: this.userId,
            role: this.role
        }).subscribe({
            next: () => { this.loading = false; this.added.emit(); },
            error: () => { this.error = 'User not found or already in conversation'; this.loading = false; }
        });
    }
}