import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ElectionService } from '../../../shared/services/election.service';
import { ClubService } from '../../../services/club.service';
import { AuthService } from '../../../shared/services/auth.service';
import { LetterGeneratorService } from '../../../services/moi/letter-generator.service';
import { ElectionReportGeneratorService } from '../../../services/moi/election-report-generator.service';
import { Election, Candidate, Vote, EligibilityResult } from '../../../models/election.model';
import { SubGroup } from '../../../models/club.model';
import { ElectionStatusPipe, ElectionStatusColorPipe } from '../../../shared/pipe/election-status.pipe';

@Component({
  selector: 'app-election-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ElectionStatusPipe, ElectionStatusColorPipe],
  templateUrl: './election-detail.component.html',
  styleUrls: ['./election-detail.component.css']
})
export class ElectionDetailComponent implements OnInit {
  election: Election | null = null;
  clubId: string | null = null;
  loading = true;

  private candidatesByCommitteeCache: Array<{key: string, value: Candidate[]}> = [];

  candidateForm: FormGroup;
  voteForm: FormGroup;
  showCandidateForm = false;
  showVoteForm = false;

  applicationForm: FormGroup;
  showApplicationForm = false;
  submitting = false;
  clubSubGroups: SubGroup[] = [];

  generatingLetter = false;
  letterError: string | null = null;

  electionReport: string | null = null;
  generatingReport = false;

  showRejectionModal = false;
  rejectionForm!: FormGroup;
  rejectingCandidateId: string | null = null;
  rejectingCandidateName: string | null = null;
  isRejectingCandidate = false;

  isCEO: boolean = false;
  isAdmin: boolean = false;
  currentUserId: string = '';
  hasAlreadyApplied: boolean = false;
  votedCommittees: Set<string> = new Set();
  availableCommittees: any[] = [];
  votingMode: string = '';
  canSeeApplyButton: boolean = false;
  userCommittees: string[] = [];

  constructor(
    private electionService: ElectionService,
    private clubService: ClubService,
    private authService: AuthService,
    private letterGenerator: LetterGeneratorService,
    private reportGenerator: ElectionReportGeneratorService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.candidateForm = this.fb.group({
      userId: ['', Validators.required],
      name: ['', Validators.required],
      manifesto: ['', Validators.required]
    });

    this.voteForm = this.fb.group({
      voterId: ['', Validators.required],
      candidateId: ['', Validators.required]
    });

    this.applicationForm = this.fb.group({
      userId: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subGroupTarget: [''],
      yearsInClub: [0, [Validators.min(0), Validators.max(10)]],
      userIdeas: [''],
      motivation: ['', Validators.required],
      manifesto: [''],
      skills: [''],
      conditionsAccepted: [false, Validators.requiredTrue]
    });

    this.rejectionForm = this.fb.group({
      rejectionReason: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const role = this.authService.getCurrentRole();
    this.isAdmin = ['PRESIDENT', 'RH', 'SECRETAIRE_GENERALE'].includes(role);
    this.isCEO = role === 'PRESIDENT';

    const currentUser = this.authService.getCurrentUser();
    this.currentUserId = currentUser?.userId || '';

    if (id) {
      this.loadElection(id);
      this.loadCurrentUser();
    }
  }

  loadElection(id: string): void {
    this.electionService.getElectionById(id).subscribe({
      next: (data) => {
        this.election = data;
        this.clubId = data.clubId;
        this.loading = false;

        this.hasAlreadyApplied = data.candidates?.some((c: any) => c.userId === this.currentUserId) || false;

        this.votedCommittees.clear();
        if (data.votes) {
          data.votes.forEach((vote: any) => {
            if (vote.voterId === this.currentUserId && vote.subGroupId) {
              this.votedCommittees.add(vote.subGroupId);
            }
          });
        }

        if (this.clubId) {
          this.loadClubSubGroups(this.clubId);
        }

        setTimeout(() => {
          if (this.currentUserId) {
            this.loadAvailableCommittees(id);
          } else {
            this.calculateCanSeeApplyButton();
          }
        }, 100);

        this.calculateCanSeeApplyButton();
        this.updateCandidatesByCommitteeCache();
      },
      error: (err: any) => {
        console.error('Erreur:', err);
        this.loading = false;
      }
    });
  }

  loadCurrentUser(): void {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser) {
      if (currentUser.userId && !this.currentUserId) {
        this.currentUserId = currentUser.userId;
      }

      this.applicationForm.patchValue({
        userId: currentUser.userId,
        name: currentUser.firstName + ' ' + currentUser.lastName,
        email: currentUser.email
      });
      this.voteForm.patchValue({
        voterId: currentUser.userId
      });
    }
  }

  loadClubSubGroups(clubId: string): void {
    this.clubService.getClubById(clubId).subscribe({
      next: (club) => {
        this.clubSubGroups = club.subGroups || [];
        this.loadUserCommittees(club);
      },
      error: (err: any) => console.error('Erreur chargement sous-groupes:', err)
    });
  }

  loadUserCommittees(club: any): void {
    if (!this.currentUserId || !club.members) return;

    const userMember = club.members.find((m: any) => m.userId === this.currentUserId);

    if (!userMember) {
      this.userCommittees = [];
      return;
    }

    this.userCommittees = [];

    if (userMember.subGroupId) {
      const subGroup = club.subGroups?.find((sg: any) => sg.id === userMember.subGroupId);
      if (subGroup) {
        this.userCommittees.push(subGroup.name);
      }
    }

    this.calculateCanSeeApplyButton();
  }

  loadAvailableCommittees(electionId: string): void {
    if (!this.currentUserId) return;

    this.electionService.getAvailableCommittees(electionId, this.currentUserId).subscribe({
      next: (result: any) => {
        this.votingMode = result.votingMode || 'ALL_CLUB_MEMBERS';
        this.availableCommittees = result.availableCommittees || [];

        this.updateCandidatesByCommitteeCache();
        this.calculateCanSeeApplyButton();
      },
      error: (err: any) => {
        console.error('❌ Erreur chargement comités disponibles:', err);
        this.availableCommittees = [];
        this.calculateCanSeeApplyButton();
      }
    });
  }

  calculateCanSeeApplyButton(): void {
    if (!this.election || !this.currentUserId) {
      this.canSeeApplyButton = false;
      return;
    }

    this.canSeeApplyButton = false;

    if (this.election.status !== 'PLANNED') return;
    if (this.hasAlreadyApplied) return;

    if (this.election.electionType === 'PRESIDENT') {
      this.canSeeApplyButton = true;
    } else if (this.election.electionType === 'BUREAU') {
      if (this.isAdmin) {
        this.canSeeApplyButton = true;
        return;
      }

      if (this.userCommittees && this.userCommittees.length > 0) {
        this.canSeeApplyButton = true;
        return;
      }

      if (this.availableCommittees && this.availableCommittees.length > 0) {
        this.canSeeApplyButton = true;
        return;
      }

      this.canSeeApplyButton = false;
    }
  }

  // ========== Gestion des candidats (CEO) ==========
  addCandidate(): void {
    if (this.candidateForm.invalid || !this.election) return;

    this.electionService.addCandidate(this.election.id!, this.candidateForm.value).subscribe({
      next: () => {
        this.loadElection(this.election!.id!);
        this.candidateForm.reset();
        this.showCandidateForm = false;
      },
      error: (err: any) => console.error('Erreur:', err)
    });
  }

  validateCandidate(candidateId: string): void {
    if (this.election) {
      this.electionService.validateCandidate(this.election.id!, candidateId).subscribe({
        next: () => this.loadElection(this.election!.id!),
        error: (err: any) => console.error('Erreur:', err)
      });
    }
  }

  rejectCandidate(candidateId: string): void {
    if (!this.election) return;

    const candidate = this.election.candidates?.find((c: any) => c.userId === candidateId);
    if (!candidate) return;

    this.rejectingCandidateId = candidateId;
    this.rejectingCandidateName = candidate.name;
    this.rejectionForm.reset();
    this.showRejectionModal = true;
  }

  submitRejection(): void {
    if (!this.rejectionForm.valid || !this.rejectingCandidateId || !this.election) return;

    this.isRejectingCandidate = true;
    const rejectionReason = this.rejectionForm.get('rejectionReason')?.value;

    this.electionService.rejectCandidate(this.election.id!, this.rejectingCandidateId, rejectionReason).subscribe({
      next: () => {
        this.isRejectingCandidate = false;
        this.showRejectionModal = false;
        this.loadElection(this.election!.id!);
      },
      error: (err: any) => {
        this.isRejectingCandidate = false;
        console.error('Erreur:', err);
        alert('Erreur lors du rejet de la candidature');
      }
    });
  }

  cancelRejection(): void {
    this.showRejectionModal = false;
    this.rejectingCandidateId = null;
    this.rejectingCandidateName = null;
    this.rejectionForm.reset();
  }

  // ========== Génération lettre de motivation IA ==========
  async generateLetterWithAI(): Promise<void> {
    const name = this.applicationForm.get('name')?.value;
    const position = this.applicationForm.get('subGroupTarget')?.value || 'Membre';
    const userIdeas = this.applicationForm.get('userIdeas')?.value || '';

    if (!name || name.trim().length === 0) {
      this.letterError = 'Veuillez renseigner votre nom';
      return;
    }

    if (!userIdeas || userIdeas.trim().length === 0) {
      this.letterError = 'Veuillez décrire vos idées et motivations dans le champ "Parlez-nous de vous"';
      return;
    }

    this.generatingLetter = true;
    this.letterError = null;

    try {
      const extractedSkills = this.extractSkillsFromText(userIdeas);

      const request = {
        candidateName: name,
        position: position,
        skills: extractedSkills,
        experiences: userIdeas,
        electionType: this.election?.electionType === 'PRESIDENT' ? 'PRESIDENT' : 'BUREAU',
        committeeName: position
      };

      const generatedLetter = await this.letterGenerator.generateMotivationLetter(request);
      const generatedProgram = this.generateProgramFromIdeas(userIdeas, position);

      this.applicationForm.patchValue({
        motivation: generatedLetter,
        manifesto: generatedProgram,
        skills: extractedSkills.join(', ')
      });

      this.generatingLetter = false;
      this.letterError = null;
    } catch (error: any) {
      console.error('❌ Erreur génération lettre:', error);
      this.generatingLetter = false;
      this.letterError = error.message || 'Erreur lors de la génération. Veuillez réessayer.';
    }
  }

  private extractSkillsFromText(text: string): string[] {
    const skills: string[] = [];
    const lowerText = text.toLowerCase();

    const commonSkills = [
      'leadership', 'communication', 'organisation', 'gestion', 'management',
      'créativité', 'innovation', 'travail d\'équipe', 'autonomie', 'rigueur',
      'planification', 'coordination', 'animation', 'négociation', 'écoute',
      'réseaux sociaux', 'marketing', 'design', 'graphisme', 'rédaction',
      'événementiel', 'logistique', 'budget', 'comptabilité', 'finance',
      'technique', 'informatique', 'web', 'développement', 'programmation'
    ];

    commonSkills.forEach(skill => {
      if (lowerText.includes(skill)) {
        skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
      }
    });

    if (skills.length === 0) {
      const words = text.split(/[\s,;.]+/);
      const meaningfulWords = words.filter(w => w.length > 4 && w.length < 20);
      skills.push(...meaningfulWords.slice(0, 3).map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ));
    }

    return skills.slice(0, 5);
  }

  private generateProgramFromIdeas(userIdeas: string, position: string): string {
    const ideas = userIdeas.toLowerCase();
    let program = '';

    if (ideas.includes('événement') || ideas.includes('event')) {
      program += '• Organiser des événements innovants et fédérateurs\n';
    }
    if (ideas.includes('communication') || ideas.includes('réseaux sociaux')) {
      program += '• Améliorer la communication interne et externe du club\n';
    }
    if (ideas.includes('membre') || ideas.includes('recrutement')) {
      program += '• Développer l\'engagement et le recrutement des membres\n';
    }
    if (ideas.includes('partenariat') || ideas.includes('sponsor')) {
      program += '• Établir des partenariats stratégiques\n';
    }
    if (ideas.includes('innovation') || ideas.includes('digital')) {
      program += '• Moderniser les outils et processus du club\n';
    }

    if (program.length === 0) {
      program = `• Contribuer activement aux objectifs du ${position}\n`;
      program += '• Apporter mes compétences au service du club\n';
      program += '• Favoriser la cohésion et l\'esprit d\'équipe\n';
    }

    program += `• M'investir pleinement dans le développement du club`;

    return program;
  }

  submitApplication(): void {
    if (this.applicationForm.invalid) return;

    this.submitting = true;
    const applicationData = this.applicationForm.value;

    if (applicationData.skills) {
      applicationData.skills = applicationData.skills.split(',').map((s: string) => s.trim());
    } else {
      applicationData.skills = [];
    }

    this.electionService.submitCandidacy(this.election!.id!, applicationData).subscribe({
      next: (result: EligibilityResult) => {
        this.submitting = false;
        if (result.eligible) {
          alert('✅ ' + result.reasons.join('\n'));
          this.showApplicationForm = false;
          this.applicationForm.reset({ conditionsAccepted: false });
          this.loadElection(this.election!.id!);
        } else {
          alert('❌ ' + result.reasons.join('\n'));
        }
      },
      error: (err: any) => {
        this.submitting = false;
        console.error('Erreur:', err);
        alert('Erreur lors de la soumission');
      }
    });
  }

  // ========== Gestion des votes ==========
  castVoteForCandidate(candidateId: string, committeeName: string): void {
    if (!this.election) {
      alert('❌ Erreur: Élection non chargée');
      return;
    }

    if (!this.currentUserId) {
      alert('❌ Erreur: Utilisateur non identifié');
      return;
    }

    const vote = {
      voterId: this.currentUserId,
      candidateId: candidateId
    };

    this.electionService.castVote(this.election.id!, vote as any).subscribe({
      next: () => {
        if (this.election?.electionType === 'PRESIDENT') {
          alert('✅ Votre vote pour l\'élection présidentielle a bien été enregistré!\n\n📧 Un email de confirmation vous a été envoyé.');
        } else {
          alert('✅ Vote enregistré pour le comité ' + committeeName + '\n\n📧 Un email de confirmation vous a été envoyé.');
        }
        this.loadElection(this.election!.id!);
      },
      error: (err: any) => {
        console.error('Erreur lors du vote:', err);
        const msg = err.error || err.message || 'Erreur lors du vote';
        alert('❌ ' + msg);
      }
    });
  }

  getCandidatesByCommittee(): Array<{key: string, value: Candidate[]}> {
    return this.candidatesByCommitteeCache;
  }

  private updateCandidatesByCommitteeCache(): void {
    if (!this.election || !this.election.candidates) {
      this.candidatesByCommitteeCache = [];
      return;
    }

    const map = new Map<string, Candidate[]>();
    this.election.candidates
      .filter((c: any) => c.status === 'APPROVED')
      .forEach((candidate: any) => {
        const committee = candidate.subGroupTarget || 'Autre';
        if (!map.has(committee)) {
          map.set(committee, []);
        }
        map.get(committee)!.push(candidate);
      });

    let filteredEntries: Array<[string, Candidate[]]>;

    if (this.votingMode === 'COMMITTEE_MEMBERS_ONLY') {
      const userCommitteeNames = this.availableCommittees
        .filter((c: any) => c.canVote)
        .map((c: any) => c.committeeName);

      filteredEntries = Array.from(map.entries()).filter(([committeeName]) =>
        userCommitteeNames.includes(committeeName)
      );
    } else {
      filteredEntries = Array.from(map.entries());
    }

    this.candidatesByCommitteeCache = filteredEntries.map(([key, value]) => ({key, value}));
  }

  canVoteForCommittee(committeeName: string): boolean {
    if (!this.availableCommittees || this.availableCommittees.length === 0) return false;
    const committee = this.availableCommittees.find((c: any) => c.committeeName === committeeName);
    return committee ? committee.canVote : false;
  }

  hasVotedForCommittee(committeeName: string): boolean {
    if (!this.availableCommittees || this.availableCommittees.length === 0) return false;
    const committee = this.availableCommittees.find((c: any) => c.committeeName === committeeName);
    if (!committee) return false;
    return this.votedCommittees.has(committee.subGroupId);
  }

  hasVotedForPresident(): boolean {
    if (!this.election || !this.election.votes || !this.currentUserId) return false;
    return this.election.votes.some((vote: any) => vote.voterId === this.currentUserId);
  }

  getVotableCandidates(): Candidate[] {
    if (!this.election || !this.election.candidates) return [];

    if (!this.availableCommittees.length) {
      return this.election.candidates.filter((c: any) => c.status === 'APPROVED');
    }

    if (this.votingMode === 'COMMITTEE_MEMBERS_ONLY') {
      const votableCommittees = this.availableCommittees
        .filter((c: any) => c.canVote)
        .map((c: any) => c.committeeName);

      return this.election.candidates.filter((candidate: any) =>
        candidate.status === 'APPROVED' &&
        votableCommittees.includes(candidate.subGroupTarget)
      );
    }

    return this.election.candidates.filter((c: any) => c.status === 'APPROVED');
  }

  // ========== Gestion de l'élection ==========
  startElection(): void {
    if (this.election) {
      this.electionService.startElection(this.election.id!).subscribe({
        next: () => this.loadElection(this.election!.id!),
        error: (err: any) => console.error('Erreur:', err)
      });
    }
  }

  closeElection(): void {
    if (this.election) {
      this.electionService.closeElection(this.election.id!).subscribe({
        next: () => this.loadElection(this.election!.id!),
        error: (err: any) => console.error('Erreur:', err)
      });
    }
  }

  deleteElection(): void {
    if (!this.election || !confirm('Supprimer cette élection définitivement ?')) return;
    this.electionService.deleteElection(this.election.id!).subscribe({
      next: () => this.router.navigate(['/clubs', this.clubId]),
      error: (err: any) => console.error('Erreur:', err)
    });
  }

  // ========== Utilitaires ==========
  /**
   * @deprecated Préférer le pipe `electionStatusColor` dans les templates.
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

  getCandidateStatusColor(status: string): string {
    switch(status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getWinnerName(): string {
    if (!this.election?.results?.winnerId) return 'Aucun';
    const winner = this.election.candidates.find(
      (c: any) => c.userId === this.election?.results?.winnerId
    );
    return winner?.name || this.election.results.winnerId;
  }

  async generateElectionReport(): Promise<void> {
    if (!this.election || !this.election.results) return;

    this.generatingReport = true;

    try {
      const winner = this.election.candidates.find(
        (c: any) => c.userId === this.election?.results?.winnerId
      );

      if (!winner) {
        console.error('Gagnant non trouvé');
        this.generatingReport = false;
        return;
      }

      const results = this.election.results;
      if (!results || !results.voteCount) {
        console.error('Résultats incomplets');
        this.generatingReport = false;
        return;
      }

      const reportData = {
        electionTitle: this.election.title,
        electionType: this.election.electionType as 'PRESIDENT' | 'BUREAU',
        startDate: this.election.startDate,
        endDate: this.election.endDate,
        totalVoters: results.totalVotes,
        totalMembers: results.totalVotes,
        winner: {
          name: winner.name,
          votes: results.voteCount[winner.userId] || 0,
          percentage: ((results.voteCount[winner.userId] || 0) / results.totalVotes) * 100
        },
        candidates: this.election.candidates.map((c: any) => ({
          name: c.name,
          votes: results.voteCount[c.userId] || 0,
          percentage: ((results.voteCount[c.userId] || 0) / results.totalVotes) * 100
        }))
      };

      this.electionReport = await this.reportGenerator.generateElectionReport(reportData);
      this.generatingReport = false;
    } catch (error) {
      console.error('❌ Erreur génération rapport:', error);
      this.generatingReport = false;
      alert('Erreur lors de la génération du rapport. Le modèle IA n\'a pas pu être chargé.');
    }
  }
}
