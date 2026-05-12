import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-scan-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scan-success.component.html',
  styleUrls: ['./scan-success.component.css']
})
export class ScanSuccessComponent implements OnInit {
  memberName: string = '';
  action: string = ''; // 'validated' or 'rejected'
  clubId: string = ''; // ✅ NOUVEAU: ID du club pour retour au dashboard

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.memberName = this.route.snapshot.queryParams['memberName'] || 'Membre';
    this.action = this.route.snapshot.queryParams['action'] || 'validated';
    
    // ✅ NOUVEAU: Récupérer le clubId depuis les query params ou le localStorage
    this.clubId = this.route.snapshot.queryParams['clubId'] || '';
    if (!this.clubId) {
      // Essayer de récupérer depuis le localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      this.clubId = currentUser.clubId || '';
    }
    
    console.log('✅ Action:', this.action, 'pour', this.memberName);
    console.log('✅ ClubId:', this.clubId);
  }

  get isValidated(): boolean {
    return this.action === 'validated';
  }

  get isRejected(): boolean {
    return this.action === 'rejected';
  }

  scanAnother() {
    console.log('🔄 scanAnother() appelé - Retour à l\'application de scan QR');
    
    // ✅ SOLUTION 1: Fermer la fenêtre/onglet actuel pour retourner à l'app de scan
    // Cela fonctionne si l'app de scan ouvre un nouvel onglet/fenêtre
    if (window.opener) {
      // Si ouvert dans une nouvelle fenêtre, la fermer
      window.close();
    } else {
      // ✅ SOLUTION 2: Utiliser history.back() pour revenir en arrière
      // Cela peut ramener à l'app de scan si elle a ouvert un navigateur in-app
      const canGoBack = window.history.length > 1;
      
      if (canGoBack) {
        console.log('✅ Retour en arrière dans l\'historique');
        window.history.back();
      } else {
        // ✅ SOLUTION 3 (Fallback): Si impossible de revenir, rediriger vers le dashboard
        console.log('⚠️ Impossible de revenir en arrière, redirection vers le dashboard');
        if (this.clubId) {
          this.router.navigate(['/clubs', this.clubId]);
        } else {
          this.router.navigate(['/elections']);
        }
      }
    }
  }
}
