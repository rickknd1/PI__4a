import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-qr-scan-instructions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="instructions-container">
  <div class="instructions-card">
    <div class="icon">📱</div>
    <h1>Scanner un QR Code</h1>
    
    <div class="steps">
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <h3>Ouvrez l'application caméra de votre téléphone</h3>
          <p>Utilisez l'application caméra native ou une application de scan QR</p>
        </div>
      </div>
      
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <h3>Pointez la caméra vers le QR Code</h3>
          <p>Assurez-vous que le QR Code est bien éclairé et centré</p>
        </div>
      </div>
      
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <h3>Cliquez sur le lien qui s'affiche</h3>
          <p>Votre téléphone détectera automatiquement le QR Code</p>
        </div>
      </div>
    </div>
    
    <div class="actions">
      <button class="btn-primary" (click)="closeAndScan()">
        ✅ J'ai compris, fermer cette page
      </button>
      <button *ngIf="clubId" class="btn-secondary" [routerLink]="['/clubs', clubId]">
        🏠 Retour au tableau de bord
      </button>
      <button *ngIf="!clubId" class="btn-secondary" routerLink="/dashboard">
        🏠 Retour au tableau de bord
      </button>
    </div>
  </div>
</div>
  `,
  styles: [`
.instructions-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.instructions-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.icon {
  font-size: 60px;
  text-align: center;
  margin-bottom: 20px;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
}

.steps {
  margin: 30px 0;
}

.step {
  display: flex;
  align-items: flex-start;
  margin-bottom: 25px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.step-number {
  background: #667eea;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  flex-shrink: 0;
}

.step-content h3 {
  color: #333;
  margin: 0 0 8px 0;
  font-size: 18px;
}

.step-content p {
  color: #666;
  margin: 0;
  font-size: 14px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 30px;
}

.btn-primary, .btn-secondary {
  padding: 14px 24px;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  width: 100%;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5a6fd8;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #f8f9fa;
  color: #666;
  border: 2px solid #e9ecef;
}

.btn-secondary:hover {
  background: #e9ecef;
  transform: translateY(-2px);
}
  `]
})
export class QrScanInstructionsComponent implements OnInit {
  clubId: string = '';

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Récupérer le clubId depuis les query params d'abord
    this.clubId = this.route.snapshot.queryParams['clubId'] || '';
    
    // Sinon, récupérer depuis le localStorage
    if (!this.clubId) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      this.clubId = currentUser.clubId || '';
    }
    
    console.log('📱 Instructions scan - ClubId:', this.clubId);
  }

  closeAndScan() {
    // Fermer la page/onglet ou retourner en arrière
    // pour permettre à l'utilisateur de scanner un nouveau QR code
    try {
      window.close();
      console.log('✅ Fermeture de l\'onglet pour scan');
    } catch (e) {
      console.log('⚠️ Impossible de fermer, retour en arrière');
      if (window.history.length > 1) {
        window.history.back();
      }
    }
  }
}