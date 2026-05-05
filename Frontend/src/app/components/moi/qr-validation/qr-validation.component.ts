import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { getGatewayBase } from '../../../../environments/environment';

@Component({
  selector: 'app-qr-validation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-validation.component.html',
  styleUrls: ['./qr-validation.component.css']
})
export class QrValidationComponent implements OnInit {
  token: string = '';
  member: any = null;
  loading: boolean = true;
  error: string = '';
  processing: boolean = false;
  
  // ✅ BUG 2: Permissions pour valider/rejeter
  canValidate: boolean = false;
  userRole: string = '';
  userSubGroupRole: string = '';
  userId: string = '';
  clubId: string = '';

  private apiUrl = `${getGatewayBase()}/api/qr-tokens`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.params['token'];
    console.log('🔍 Token QR reçu:', this.token);
    
    // Récupérer les infos de base de l'utilisateur
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    this.userId = currentUser.userId || currentUser.id || '';
    this.clubId = currentUser.clubId || '';
    this.userRole = currentUser.role || '';
    
    console.log('👤 Utilisateur connecté:', {
      userId: this.userId,
      clubId: this.clubId,
      userRole: this.userRole
    });
    
    // ✅ CORRECTION: Vérifier les permissions en chargeant les infos du club
    this.checkPermissionsFromClub();
  }

  /**
   * ✅ CORRECTION BUG 1: Vérifier les permissions en chargeant les infos du club
   * pour savoir si l'utilisateur est membre du comité Event
   */
  checkPermissionsFromClub() {
    if (!this.clubId || !this.userId) {
      console.error('❌ clubId ou userId manquant');
      this.error = '⚠️ Impossible de vérifier vos permissions. Veuillez vous reconnecter.';
      this.loading = false;
      return;
    }
    
    // Charger les informations du club pour vérifier le comité de l'utilisateur
    this.http.get<any>(`${getGatewayBase()}/api/clubs/${this.clubId}`).subscribe({
      next: (club) => {
        console.log('✅ Club chargé:', club.name);

        // Vérifier si l'utilisateur est responsable global
        const isGlobalAdmin = ['PRESIDENT', 'RH', 'SECRETAIRE_GENERALE'].includes(this.userRole);

        // Trouver l'utilisateur dans les membres du club
        const userMember = club.members?.find((m: any) => m.userId === this.userId);

        if (!userMember) {
          console.error('❌ Utilisateur non trouvé dans les membres du club');
          this.error = '⚠️ Vous n\'êtes pas membre de ce club.';
          this.loading = false;
          return;
        }

        console.log('👤 Membre trouvé:', {
          name: userMember.name,
          subGroupId: userMember.subGroupId,
          subGroupRole: userMember.subGroupRole
        });

        // Chercher le comité de l'utilisateur en consultant directement les subGroups
        // (plus fiable que member.subGroupId qui peut être null après réassignation)
        const userSubGroup = club.subGroups?.find((sg: any) =>
          sg.id === userMember.subGroupId ||
          sg.memberIds?.includes(this.userId) ||
          sg.responsableId === this.userId
        );
        const subGroupName = userSubGroup?.name || '';

        console.log('📋 Comité de l\'utilisateur:', subGroupName);

        // Vérifier si l'utilisateur est dans le comité Event
        const isEventMember = subGroupName.toLowerCase().includes('event') ||
                              subGroupName.toLowerCase().includes('événement');

        // L'utilisateur peut valider s'il est:
        // 1. Responsable global (PRESIDENT, RH, SECRETAIRE_GENERALE)
        // 2. Responsable ou membre du comité Event
        this.canValidate = isGlobalAdmin || isEventMember;

        console.log('🔐 Résultat permissions:', {
          isGlobalAdmin,
          isEventMember,
          subGroupName,
          canValidate: this.canValidate
        });

        if (this.canValidate) {
          this.loadMemberInfo();
        } else {
          this.error = '⚠️ Vous n\'avez pas les permissions pour valider les présences. Seuls les responsables/membres du comité Event peuvent le faire.';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement club:', err);
        this.error = '⚠️ Impossible de vérifier vos permissions. Erreur de chargement du club.';
        this.loading = false;
      }
    });
  }

  /**
   * ✅ BUG 2: Méthode pour retourner au tableau de bord du club
   */
  goBackToDashboard() {
    console.log('🏠 Retour au tableau de bord');
    
    if (this.clubId) {
      console.log('✅ Navigation vers le club:', this.clubId);
      this.router.navigate(['/clubs', this.clubId]);
    } else {
      console.log('✅ Navigation vers les élections');
      this.router.navigate(['/elections']);
    }
  }

  loadMemberInfo() {
    this.loading = true;
    this.error = '';

    this.http.get<any>(`${this.apiUrl}/${this.token}`).subscribe({
      next: (response) => {
        console.log('✅ Réponse API:', response);
        if (response.success) {
          this.member = response.data;
          this.loading = false;
        } else {
          this.error = response.message || 'Token QR invalide';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur API:', err);
        this.error = 'Impossible de charger les informations du membre';
        this.loading = false;
      }
    });
  }

  validatePresence() {
    if (this.processing) return;
    
    // ✅ BUG 2: Vérifier les permissions
    if (!this.canValidate) {
      alert('❌ Vous n\'avez pas les permissions pour valider les présences.');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const validatedBy = currentUser.userId || currentUser.id;

    if (!validatedBy) {
      alert('Erreur: Impossible d\'identifier le responsable. Veuillez vous reconnecter.');
      return;
    }

    if (!confirm(`Confirmer la validation de présence pour ${this.member.name} ?`)) {
      return;
    }

    this.processing = true;

    this.http.post<any>(`${this.apiUrl}/${this.token}/validate`, {
      validatedBy: validatedBy
    }).subscribe({
      next: (response) => {
        console.log('✅ Validation réussie:', response);
        if (response.success) {
          // ✅ NOUVEAU: Récupérer le clubId depuis le localStorage
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
          const clubId = currentUser.clubId || '';
          
          this.router.navigate(['/elections/scan/success'], {
            queryParams: {
              memberName: response.memberName,
              action: 'validated',
              clubId: clubId // ✅ AJOUTÉ: Passer le clubId
            }
          });
        } else {
          alert('Erreur: ' + response.message);
          this.processing = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur validation:', err);
        alert('Erreur lors de la validation: ' + (err.error?.message || err.message));
        this.processing = false;
      }
    });
  }

  rejectPresence() {
    if (this.processing) return;
    
    // ✅ BUG 2: Vérifier les permissions
    if (!this.canValidate) {
      alert('❌ Vous n\'avez pas les permissions pour rejeter les présences.');
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const validatedBy = currentUser.userId || currentUser.id;

    if (!validatedBy) {
      alert('Erreur: Impossible d\'identifier le responsable. Veuillez vous reconnecter.');
      return;
    }

    const reason = prompt('Raison du rejet (optionnel):');
    
    if (!confirm(`Confirmer le rejet de présence pour ${this.member.name} ?`)) {
      return;
    }

    this.processing = true;

    this.http.post<any>(`${this.apiUrl}/${this.token}/reject`, {
      validatedBy: validatedBy,
      reason: reason || 'Non spécifiée'
    }).subscribe({
      next: (response) => {
        console.log('✅ Rejet réussi:', response);
        if (response.success) {
          // ✅ NOUVEAU: Récupérer le clubId depuis le localStorage
          const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
          const clubId = currentUser.clubId || '';
          
          this.router.navigate(['/elections/scan/success'], {
            queryParams: {
              memberName: response.memberName,
              action: 'rejected',
              clubId: clubId // ✅ AJOUTÉ: Passer le clubId
            }
          });
        } else {
          alert('Erreur: ' + response.message);
          this.processing = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur rejet:', err);
        alert('Erreur lors du rejet: ' + (err.error?.message || err.message));
        this.processing = false;
      }
    });
  }
}
