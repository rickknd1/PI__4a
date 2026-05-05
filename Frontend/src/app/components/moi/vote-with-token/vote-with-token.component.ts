import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { getGatewayBase } from '../../../../environments/environment';

@Component({
  selector: 'app-vote-with-token',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vote-with-token.component.html',
  styleUrls: ['./vote-with-token.component.css']
})
export class VoteWithTokenComponent implements OnInit {
  electionId: string = '';
  votingToken: string = '';
  election: any = null;
  candidates: any[] = [];
  loading: boolean = true;
  error: string = '';
  voting: boolean = false;
  selectedCandidateId: string = '';

  // ✅ BUG 3: Propriétés pour le filtrage par comité
  votingMode: string = ''; // 'COMMITTEE_MEMBERS_ONLY' ou 'ALL_CLUB_MEMBERS'
  userCommittee: string = ''; // Nom du comité de l'utilisateur
  userCommitteeId: string = ''; // ID du comité de l'utilisateur
  candidatesByCommittee: Map<string, any[]> = new Map();
  // userId extrait du voting token (fiable même si le membre n'est pas connecté)
  votingUserId: string = '';

  private apiUrl = `${getGatewayBase()}/api`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.electionId = this.route.snapshot.params['id'];
    this.votingToken = this.route.snapshot.queryParams['token'];

    console.log('🗳️ Election ID:', this.electionId);
    console.log('🔑 Voting Token:', this.votingToken);

    if (!this.votingToken) {
      this.error = 'Token de vote manquant';
      this.loading = false;
      return;
    }

    this.validateToken();
  }

  validateToken() {
    this.loading = true;
    this.error = '';

    this.http.get<any>(`${this.apiUrl}/qr-tokens/voting/${this.votingToken}/validate`).subscribe({
      next: (response) => {
        console.log('✅ Validation token:', response);
        if (response.valid) {
          // ✅ BUG 3: Récupérer les infos du token (comité de l'utilisateur)
          this.getUserCommitteeFromToken();
        } else {
          this.error = response.message || 'Token invalide ou expiré';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur validation token:', err);
        this.error = 'Impossible de valider le token';
        this.loading = false;
      }
    });
  }

  /**
   * ✅ BUG 3: Récupère le comité de l'utilisateur depuis le token de vote
   */
  getUserCommitteeFromToken() {
    this.http.get<any>(`${this.apiUrl}/qr-tokens/voting/${this.votingToken}/info`).subscribe({
      next: (response) => {
        console.log('✅ Info token:', response);
        if (response.success) {
          // Extraire le userId depuis le token (fiable même sans session active)
          this.votingUserId = response.data.userId || '';
          this.userCommitteeId = response.data.subGroupId || '';
          this.userCommittee = response.data.subGroupName || '';
          console.log('👤 Votant identifié via token:', this.votingUserId, '| Comité:', this.userCommittee);
        }
        this.loadElection();
      },
      error: (err) => {
        console.error('⚠️ Erreur récupération info token:', err);
        this.loadElection();
      }
    });
  }

  loadElection() {
    this.http.get<any>(`${this.apiUrl}/elections/${this.electionId}`).subscribe({
      next: (election) => {
        console.log('✅ Élection chargée:', election);
        this.election = election;
        this.votingMode = election.votingMode || 'ALL_CLUB_MEMBERS';
        
        // ✅ BUG 3: Filtrer les candidats selon le mode de vote
        this.filterCandidates();
        
        this.loading = false;

        if (this.candidates.length === 0) {
          const type = election.electionType || '';
          this.error = type === 'BUREAU'
            ? 'Aucun candidat disponible pour votre comité'
            : 'Aucun candidat approuvé pour cette élection';
        }
      },
      error: (err) => {
        console.error('❌ Erreur chargement élection:', err);
        this.error = 'Impossible de charger l\'élection';
        this.loading = false;
      }
    });
  }

  filterCandidates() {
    const allCandidates = this.election.candidates.filter((c: any) => c.status === 'APPROVED');
    const electionType = this.election.electionType || '';

    // Élection présidentielle : tous les candidats, pas de filtrage par comité
    if (electionType !== 'BUREAU') {
      this.candidates = allCandidates;
      console.log(`🏆 Élection ${electionType}: ${this.candidates.length} candidats (tous)`);
      return;
    }

    // Élection de bureau : filtrage selon votingMode
    if (this.votingMode === 'COMMITTEE_MEMBERS_ONLY' && this.userCommittee) {
      this.candidates = allCandidates.filter((c: any) =>
        c.subGroupTarget === this.userCommittee
      );
      console.log(`🔍 Filtrage comité "${this.userCommittee}": ${this.candidates.length} candidats`);
    } else {
      // ALL_CLUB_MEMBERS ou comité inconnu : tous les candidats groupés par comité
      this.candidates = allCandidates;
      this.groupCandidatesByCommittee();
      console.log(`🌐 Bureau ALL_CLUB_MEMBERS: ${this.candidates.length} candidats`);
    }
  }

  /**
   * ✅ BUG 3: Regroupe les candidats par comité pour l'affichage
   */
  groupCandidatesByCommittee() {
    this.candidatesByCommittee.clear();
    
    this.candidates.forEach(candidate => {
      const committee = candidate.subGroupTarget || 'Autre';
      if (!this.candidatesByCommittee.has(committee)) {
        this.candidatesByCommittee.set(committee, []);
      }
      this.candidatesByCommittee.get(committee)!.push(candidate);
    });
    
    console.log('📋 Candidats groupés par comité:', Array.from(this.candidatesByCommittee.keys()));
  }

  selectCandidate(candidateId: string) {
    this.selectedCandidateId = candidateId;
  }

  vote() {
    if (!this.selectedCandidateId) {
      alert('Veuillez sélectionner un candidat');
      return;
    }

    if (!confirm('Confirmer votre vote ? Cette action est définitive.')) {
      return;
    }

    this.voting = true;

    // Priorité : userId extrait du voting token (valable même sans session)
    // Fallback : localStorage si le membre est connecté
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const voterId = this.votingUserId || currentUser.userId || currentUser.id;

    if (!voterId) {
      alert('Erreur : impossible d\'identifier le votant. Veuillez utiliser le lien reçu par email.');
      this.voting = false;
      return;
    }

    this.http.post<any>(`${this.apiUrl}/elections/${this.electionId}/vote-with-token`, {
      voterId: voterId,
      candidateId: this.selectedCandidateId,
      token: this.votingToken
    }).subscribe({
      next: (response) => {
        console.log('✅ Vote enregistré:', response);
        if (response.success) {
          // Redirection vers signin avec message de confirmation
          this.router.navigate(['/signin'], {
            queryParams: {
              message: 'Votre vote pour ' + this.election.title + ' a été enregistré avec succès. Merci de votre participation !',
              messageType: 'success'
            }
          });
        } else {
          alert('Erreur: ' + response.error);
          this.voting = false;
        }
      },
      error: (err) => {
        console.error('❌ Erreur vote:', err);
        alert('Erreur lors du vote: ' + (err.error?.error || err.message));
        this.voting = false;
      }
    });
  }
}
