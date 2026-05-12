import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvitationService, MemberInvitation } from '../../services/invitation.service';

@Component({
  selector: 'app-pending-invitations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pending-invitations.component.html',
  styleUrls: ['./pending-invitations.component.css']
})
export class PendingInvitationsComponent implements OnInit {
  @Input() clubId!: string;

  invitations: MemberInvitation[] = [];
  loading = true;
  showInvitations = false;

  constructor(private invitationService: InvitationService) {}

  ngOnInit() {
    if (this.clubId) {
      this.loadInvitations();
    }
  }

  loadInvitations() {
    this.loading = true;
    this.invitationService.getPendingInvitations(this.clubId).subscribe({
      next: (response: any) => {
        this.invitations = response.invitations || [];
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur chargement invitations:', error);
        this.loading = false;
      }
    });
  }

  toggleInvitations() {
    this.showInvitations = !this.showInvitations;
    if (this.showInvitations && this.invitations.length === 0) {
      this.loadInvitations();
    }
  }

  resendInvitation(invitationId: string) {
    if (confirm('Voulez-vous renvoyer cette invitation ?')) {
      this.invitationService.resendInvitation(invitationId).subscribe({
        next: () => {
          alert('✅ Invitation renvoyée avec succès');
          this.loadInvitations();
        },
        error: (error: any) => {
          alert('❌ Erreur: ' + (error.error?.message || 'Erreur lors du renvoi'));
        }
      });
    }
  }

  deleteInvitation(invitationId: string) {
    if (confirm('Voulez-vous supprimer cette invitation ?')) {
      this.invitationService.deleteInvitation(invitationId).subscribe({
        next: () => {
          alert('✅ Invitation supprimée avec succès');
          this.loadInvitations();
        },
        error: (error: any) => {
          alert('❌ Erreur: ' + (error.error?.message || 'Erreur lors de la suppression'));
        }
      });
    }
  }

  copyInvitationLink(token: string) {
    const link = `http://localhost:4200/setup-password?token=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('✅ Lien copié dans le presse-papier');
    }).catch(() => {
      alert('❌ Erreur lors de la copie du lien');
    });
  }

  getExpirationStatus(expiresAt: string): string {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffInDays = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) return 'Expiré';
    if (diffInDays === 0) return 'Expire aujourd\'hui';
    if (diffInDays === 1) return 'Expire demain';
    return `Expire dans ${diffInDays} jours`;
  }

  getExpirationClass(expiresAt: string): string {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffInDays = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 0) return 'expired';
    if (diffInDays <= 1) return 'expiring-soon';
    return 'valid';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
