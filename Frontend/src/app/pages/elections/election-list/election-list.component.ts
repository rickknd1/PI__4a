import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ElectionService } from '../../../shared/services/election.service';
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

  constructor(private electionService: ElectionService) {}

  ngOnInit(): void {
    this.loadElections();
  }

  loadElections(): void {
    this.electionService.getAllElections().subscribe({
      next: (data) => {
        this.elections = data;
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
   * Conservé pour compatibilité avec les anciens templates.
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
   * Conservé pour compatibilité.
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
