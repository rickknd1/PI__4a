import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { ClubService } from '../../shared/services/club.service';
import { CommitteeResponsableService } from '../../shared/services/committee-responsable.service';
import { Club, Member, SubGroup } from '../../models/club.model';

/**
 * Page dediee aux RESPONSABLES de comite.
 *
 * Pourquoi cette page : un responsable n'a pas besoin de voir l'admin global
 * du club (Mon Club). Il a juste besoin de gerer SON comite — ajouter,
 * retirer, changer le role d'un membre dans son comite. AVANT, le responsable
 * passait par /clubs/:id qui exposait la totalite de l'admin du club
 * (sub-groups multiples, settings, elections, members liste globale...).
 * Maintenant l'item "Mon Comite" du sidebar pointe ici, avec un scope reduit.
 *
 * Source de verite : sg.memberRoles[userId] (RESPONSABLE | MEMBRE_COMITE) +
 * sg.memberIds. Idem que club-detail mais filtre sur 1 seul comite.
 */
@Component({
  selector: 'app-my-committee',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
    <h1 class="text-2xl font-semibold mb-1">Mon Comité</h1>
    <p class="text-sm text-gray-500 mb-6">Gestion des membres de votre comité</p>

    <div *ngIf="loading" class="text-center py-10 text-gray-500">Chargement…</div>

    <div *ngIf="!loading && !committee" class="text-center py-10">
      <p class="text-gray-600">Vous n'êtes responsable d'aucun comité.</p>
      <p class="text-xs text-gray-400 mt-2">Contactez le président de votre club si c'est une erreur.</p>
    </div>

    <ng-container *ngIf="!loading && committee">
      <!-- En-tete comite -->
      <div class="border border-gray-200 rounded-xl p-4 mb-6 bg-gray-50">
        <div class="flex items-baseline gap-3">
          <h2 class="text-xl font-semibold text-blue-700">{{ committee.name }}</h2>
          <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {{ committee.memberIds.length }} membre(s)
          </span>
        </div>
        <p class="text-sm text-gray-600 mt-1">{{ committee.description || 'Pas de description' }}</p>
      </div>

      <!-- Bouton ajout -->
      <div class="flex justify-end mb-3">
        <button (click)="toggleAddForm()"
                class="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          {{ showAddForm ? 'Annuler' : '+ Ajouter un membre' }}
        </button>
      </div>

      <!-- Formulaire ajout : selecteur parmi membres du club non encore dans le comite -->
      <div *ngIf="showAddForm" class="border border-blue-200 rounded-xl p-4 mb-4 bg-blue-50/40">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="block text-xs font-medium text-gray-600 mb-1">Choisir un membre du club</label>
            <select [(ngModel)]="newMemberUserId" class="w-full rounded-lg border px-3 py-2 text-sm">
              <option value="">— Selectionner —</option>
              <option *ngFor="let m of availableClubMembers" [value]="m.userId">
                {{ m.name }} ({{ m.email }})
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Role dans le comite</label>
            <select [(ngModel)]="newMemberRole" class="w-full rounded-lg border px-3 py-2 text-sm">
              <option value="MEMBRE_COMITE">Membre du comite</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end mt-3">
          <button (click)="addMember()"
                  [disabled]="!newMemberUserId || saving"
                  class="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {{ saving ? '...' : 'Ajouter' }}
          </button>
        </div>
      </div>

      <!-- Tableau membres -->
      <div *ngIf="committee.memberIds.length === 0" class="text-center py-8 text-sm text-gray-400 italic">
        Aucun membre dans votre comite. Ajoutez-en !
      </div>

      <div *ngIf="committee.memberIds.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-gray-500 text-xs uppercase tracking-wide">
              <th class="text-left py-2 px-3">Nom</th>
              <th class="text-left py-2 px-3">Email</th>
              <th class="text-left py-2 px-3">Role club</th>
              <th class="text-left py-2 px-3">Role comite</th>
              <th class="text-right py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let memberId of committee.memberIds"
                class="border-b border-gray-100 hover:bg-gray-50">
              <ng-container *ngIf="getMember(memberId) as m">
                <td class="py-2 px-3 font-medium">{{ m.name }}</td>
                <td class="py-2 px-3 text-gray-600">{{ m.email }}</td>
                <td class="py-2 px-3">
                  <span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{{ m.role }}</span>
                </td>
                <td class="py-2 px-3">
                  <span *ngIf="committeeRole(memberId) === 'RESPONSABLE'"
                        class="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">👑 Responsable</span>
                  <span *ngIf="committeeRole(memberId) !== 'RESPONSABLE'"
                        class="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">📋 Membre</span>
                </td>
                <td class="py-2 px-3 text-right">
                  <button *ngIf="memberId !== currentUserId && committeeRole(memberId) !== 'RESPONSABLE'"
                          (click)="removeMember(memberId)"
                          class="text-red-600 hover:underline text-xs">Retirer</button>
                  <span *ngIf="memberId === currentUserId" class="text-xs text-gray-400 italic">Vous</span>
                </td>
              </ng-container>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>
  </div>
  `,
})
export class MyCommitteeComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  club: Club | null = null;
  committee: SubGroup | null = null;
  currentUserId = '';
  /** Membres du club non encore dans ce comite — proposes a l'ajout. */
  availableClubMembers: Member[] = [];
  showAddForm = false;
  newMemberUserId = '';
  newMemberRole: string = 'MEMBRE_COMITE';

  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private clubService: ClubService,
    private respService: CommitteeResponsableService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.auth.getCurrentUser()?.userId ?? '';
    // S'abonne au statut responsable (peut etre encore en chargement) pour
    // recharger des qu'on connait le subGroupId.
    this.sub = this.respService.responsableStatus$.subscribe(status => {
      if (!status) return;
      if (!status.isResponsable || !status.subGroupId) {
        this.committee = null;
        this.loading = false;
        return;
      }
      this.loadClub(status.subGroupId);
    });
    // Force un refetch initial au cas ou rien n'est encore en cache.
    this.respService.loadResponsableStatus();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadClub(subGroupId: string): void {
    const clubId = this.auth.getCurrentUser()?.clubId;
    if (!clubId) { this.loading = false; return; }
    this.clubService.getClubById(clubId).subscribe({
      next: club => {
        this.club = club;
        this.committee = club.subGroups.find(sg => sg.id === subGroupId) || null;
        this.recomputeAvailable();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private recomputeAvailable(): void {
    if (!this.club || !this.committee) { this.availableClubMembers = []; return; }
    const inCommittee = new Set(this.committee.memberIds);
    this.availableClubMembers = this.club.members.filter(m =>
      m.status === 'APPROVED' && !inCommittee.has(m.userId)
    );
  }

  getMember(userId: string): Member | undefined {
    return this.club?.members.find(m => m.userId === userId);
  }

  committeeRole(userId: string): string {
    return (this.committee?.memberRoles && this.committee.memberRoles[userId]) || 'MEMBRE_COMITE';
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.newMemberUserId = '';
      this.newMemberRole = 'MEMBRE_COMITE';
    }
  }

  addMember(): void {
    if (!this.newMemberUserId || !this.club || !this.committee?.id) return;
    this.saving = true;
    this.clubService.assignToSubGroup(
      this.club.id!, this.newMemberUserId, this.committee.id, this.newMemberRole,
    ).subscribe({
      next: updated => {
        this.club = updated;
        this.committee = updated.subGroups.find(sg => sg.id === this.committee?.id) || null;
        this.recomputeAvailable();
        this.toggleAddForm();
        this.saving = false;
      },
      error: () => { this.saving = false; alert('❌ Erreur lors de l\'ajout'); }
    });
  }

  removeMember(userId: string): void {
    if (!this.club || !this.committee?.id) return;
    if (!confirm('Retirer ce membre du comite ?')) return;
    this.clubService.removeFromSubGroup(this.club.id!, this.committee.id, userId).subscribe({
      next: updated => {
        this.club = updated;
        this.committee = updated.subGroups.find(sg => sg.id === this.committee?.id) || null;
        this.recomputeAvailable();
      },
      error: () => alert('❌ Erreur lors du retrait')
    });
  }
}
