import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectionService } from '../../../shared/services/election.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Election } from '../../../models/election.model';
import { ElectionStatusPipe, ElectionStatusColorPipe } from '../../../shared/pipe/election-status.pipe';

@Component({
  selector: 'app-election-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ElectionStatusPipe, ElectionStatusColorPipe],
  templateUrl: './election-list.component.html',
  styleUrls: ['./election-list.component.css']
})
export class ElectionListComponent implements OnInit {
  elections: Election[] = [];
  loading = true;

  /** Visible aux roles privilegies pour creer/editer/supprimer une election. */
  isAdmin = false;
  /** True si l'utilisateur est un membre simple (filtres status appliques). */
  isSimpleMember = false;
  /** Statuts toujours caches aux MEMBRE_SIMPLE. */
  private readonly HIDDEN_STATUSES_FOR_MEMBERS = ['CLOSED', 'CANCELLED'];

  constructor(
    private electionService: ElectionService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const role = (this.authService.getCurrentRole() ?? '').toUpperCase();
    this.isSimpleMember = role === 'MEMBRE_SIMPLE' || role === '' || role === 'COMMITTEE_MEMBER';
    this.isAdmin = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'RH', 'TRESORIER'].includes(role);

    this.loadElections();
  }

  loadElections(): void {
    // Multi-tenant: on ne charge QUE les elections du club de l'utilisateur.
    // AVANT, getAllElections() retournait toutes les elections de toutes les
    // tables — un membre du club A pouvait voir les elections du club B.
    const clubId = this.authService.getCurrentClubId();

    const source$ = clubId
      ? this.electionService.getElectionsByClub(clubId)
      : this.electionService.getAllElections();

    source$.subscribe({
      next: (data) => {
        let filtered = data || [];

        // Pour les membres simples, on cache les elections terminees/annulees.
        // Garde uniquement PLANNED et OPEN (les seules ou ils peuvent agir :
        // candidater pour PLANNED, voter pour OPEN).
        if (this.isSimpleMember) {
          filtered = filtered.filter(e => !this.HIDDEN_STATUSES_FOR_MEMBERS.includes(e.status));
        }

        this.elections = filtered;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Erreur:', err);
        this.loading = false;
      }
    });
  }

  deleteElection(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette élection ?')) {
      this.electionService.deleteElection(id).subscribe({
        next: () => {
          this.elections = this.elections.filter(e => e.id !== id);
        },
        error: (err: any) => console.error('Erreur:', err)
      });
    }
  }

  /**
   * @deprecated Utiliser le pipe `electionStatusColor` directement dans le template.
   */
  getStatusColor(status: string): string {
    switch(status) {
      case 'PLANNED': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'OPEN': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'CLOSED': return 'bg-green-100 text-green-800 border border-green-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  }

  /**
   * @deprecated Utiliser le pipe `electionStatus` directement dans le template.
   */
  getStatusText(status: string): string {
    switch(status) {
      case 'PLANNED': return 'Planifiée';
      case 'OPEN': return 'Ouverte';
      case 'CLOSED': return 'Clôturée';
      case 'CANCELLED': return 'Annulée';
      default: return status;
    }
  }
}
