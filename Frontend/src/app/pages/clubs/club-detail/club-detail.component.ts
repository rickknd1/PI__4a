import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ClubService } from '../../../services/club.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Club, Member, SubGroup, SubGroupRecommendation } from '../../../models/club.model';
import { ElectionService } from '../../../shared/services/election.service';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CustomRoleService, CustomRole } from '../../../services/custom-role.service';
import { filter } from 'rxjs/operators';
import { PermissionService } from '../../../services/permission.service';
import { RoleEventsService } from '../../../services/role-events.service';
import { CommitteeResponsableService } from '../../../services/committee-responsable.service';
import { InviteMemberModalComponent } from '../../../components/invite-member-modal/invite-member-modal.component';
import { PendingInvitationsComponent } from '../../../components/pending-invitations/pending-invitations.component';

@Component({
  selector: 'app-club-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    InviteMemberModalComponent,
    PendingInvitationsComponent
  ],
  templateUrl: './club-detail.component.html',
  styleUrls: ['./club-detail.component.css']
})
export class ClubDetailComponent implements OnInit, OnDestroy {
  club: Club | null = null;
  loading = true;
  recommendation: SubGroupRecommendation | null = null;
  clubElections: any[] = [];
  private userProfileSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private permissionsSubscription?: Subscription;
  private roleChangedSubscription?: Subscription;

  // Formulaires
  memberForm: FormGroup;
  subGroupForm: FormGroup;
  assignForm: FormGroup;

  // États d'affichage
  showSubGroupForm = false;
  showAssignForm = false;
  showInviteModal = false;

  // Pour l'édition de sous-groupe
  editingSubGroupId: string | null = null;
  editSubGroupData: { name: string; description: string } = { name: '', description: '' };

  // Pour l'édition de membre
  editingMemberId: string | null = null;
  editMemberData: { name: string; email: string; role: string } = {
    name: '',
    email: '',
    role: ''
  };

  roles = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'TRESORIER', 'RH', 'MEMBRE_SIMPLE'];
  customRoles: CustomRole[] = [];
  allRoles: string[] = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'TRESORIER', 'RH', 'MEMBRE_SIMPLE', '➕ Autre (créer un nouveau rôle)'];
  isAdmin = false;

  // Modal post-création membre : message neutre + reveal optionnel du mot de passe (auto-hide 30s)
  pwdReveal: { open: boolean; visible: boolean; email: string; password: string; copied: boolean } = {
    open: false,
    visible: false,
    email: '',
    password: '',
    copied: false
  };
  private pwdRevealHideTimer: any = null;
  private pwdRevealCloseTimer: any = null;

  constructor(
    private clubService: ClubService,
    public authService: AuthService,
    private electionService: ElectionService,
    private customRoleService: CustomRoleService,
    public permissionService: PermissionService,
    public committeeResponsableService: CommitteeResponsableService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private roleEventsService: RoleEventsService
  ) {
    this.memberForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      role: ['MEMBRE_SIMPLE', Validators.required]
    });

    this.subGroupForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });

    this.assignForm = this.fb.group({
      userId: ['', Validators.required],
      subGroupId: ['', Validators.required],
      subGroupRole: ['MEMBRE_COMITE', Validators.required]
    });
  }

  ngOnInit(): void {
    // Initial check based on system role (will be refined when club loads)
    const role = this.authService.getCurrentRole();
    const ADMIN_ROLES = ['PRESIDENT', 'RH', 'SECRETAIRE_GENERALE', 'VICE_PRESIDENT'];
    this.isAdmin = ADMIN_ROLES.includes(role || '');

    console.log('🔍 ngOnInit - System role:', role, 'isAdmin (preliminary):', this.isAdmin);

    const id = this.route.snapshot.paramMap.get('id');
    console.log('🔍 ngOnInit - Club ID:', id);

    if (id) {
      this.loadClub(id);
      this.getRecommendation(id);
      this.loadClubElections(id);
      this.loadCustomRoles(id);
    }

    this.userProfileSubscription = this.authService.userProfile$.subscribe(updatedUser => {
      if (updatedUser && this.club) {
        const memberIndex = this.club.members.findIndex(m => m.userId === updatedUser.userId);
        if (memberIndex !== -1) {
          this.loadClub(this.club.id!);
        }
      }
    });

    this.permissionsSubscription = this.permissionService.permissions$.subscribe(permissions => {
      console.log('🔄 Permissions mises à jour:', permissions);
      this.cdr.detectChanges();
    });

    this.committeeResponsableService.responsableStatus$.subscribe(status => {
      console.log('🔄 Statut de responsable mis à jour:', status);
      if (status) {
        this.permissionService.loadUserPermissions();
      }
      this.cdr.detectChanges();
    });

    this.roleChangedSubscription = this.roleEventsService.roleChanged$.subscribe(() => {
      console.log('🔄 Rôles modifiés, rechargement des rôles personnalisés...');
      if (this.club?.id) {
        this.loadCustomRoles(this.club.id);
      }
    });

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url.includes('/clubs/') && this.club?.id) {
          console.log('🔄 Navigation détectée, rechargement des rôles...');
          this.loadCustomRoles(this.club.id);
          this.permissionService.loadUserPermissions();
          this.committeeResponsableService.loadResponsableStatus();
        }
      });
  }

  isResponsibleOf(subGroupId: string): boolean {
    if (!this.club) return false;
    const mySubGroupId = this.committeeResponsableService.getMySubGroupId();
    return mySubGroupId === subGroupId;
  }

  canManageSubGroup(subGroupId: string): boolean {
    return this.isAdmin;
  }

  canManageSubGroupMembers(subGroupId: string): boolean {
    if (this.isAdmin) return true;
    return this.isResponsibleOf(subGroupId);
  }

  getMyResponsibleSubGroupId(): string | null {
    return this.committeeResponsableService.getMySubGroupId();
  }

  isMemberInMySubGroup(memberId: string): boolean {
    const mySubGroupId = this.getMyResponsibleSubGroupId();
    if (!mySubGroupId || !this.club) return false;

    const member = this.club.members.find(m => m.userId === memberId);
    return member?.subGroupId === mySubGroupId;
  }

  canDeleteMember(memberId: string): boolean {
    return this.isAdmin || this.permissionService.hasPermission('DELETE_MEMBERS');
  }

  canRemoveFromSubGroup(subGroupId: string): boolean {
    if (this.isAdmin) {
      return true;
    }
    return this.isResponsibleOf(subGroupId);
  }

  getDisplayRole(member: any): string {
    if (member.role === 'PRESIDENT') {
      return 'PRESIDENT';
    }

    if (this.club?.subGroups) {
      // Check responsable first
      for (const subGroup of this.club.subGroups) {
        if (subGroup.responsableId === member.userId) {
          return `Responsable ${subGroup.name}`;
        }
      }

      // Scan all subgroups for membership (supports multiple committees)
      const memberCommittees: string[] = [];
      for (const subGroup of this.club.subGroups) {
        if (subGroup.memberIds && subGroup.memberIds.includes(member.userId)) {
          memberCommittees.push(subGroup.name);
        }
      }

      if (memberCommittees.length > 1) {
        return `Comités: ${memberCommittees.join(', ')}`;
      } else if (memberCommittees.length === 1) {
        return `Membre du comité ${memberCommittees[0]}`;
      }
    }

    return member.role;
  }

  ngOnDestroy(): void {
    this.userProfileSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.permissionsSubscription?.unsubscribe();
    this.roleChangedSubscription?.unsubscribe();
    this.clearPwdRevealTimers();
  }

  // ===== Modal "compte créé" : pas d'exposition par défaut =====

  openPwdReveal(email: string, password: string): void {
    this.clearPwdRevealTimers();
    this.pwdReveal = {
      open: true,
      visible: false,           // masqué par défaut
      email: email || '',
      password: password || '',
      copied: false
    };
  }

  togglePwdReveal(): void {
    if (!this.pwdReveal.open) return;
    this.pwdReveal.visible = !this.pwdReveal.visible;
    if (this.pwdReveal.visible) {
      // Auto-masquage après 30s pour limiter le shoulder-surfing
      if (this.pwdRevealHideTimer) clearTimeout(this.pwdRevealHideTimer);
      this.pwdRevealHideTimer = setTimeout(() => {
        this.pwdReveal.visible = false;
        this.pwdReveal.copied = false;
        this.cdr.detectChanges();
      }, 30000);
    } else if (this.pwdRevealHideTimer) {
      clearTimeout(this.pwdRevealHideTimer);
      this.pwdRevealHideTimer = null;
    }
  }

  copyPwdToClipboard(): void {
    if (!this.pwdReveal.password) return;
    const value = this.pwdReveal.password;
    const done = () => {
      this.pwdReveal.copied = true;
      setTimeout(() => {
        this.pwdReveal.copied = false;
        this.cdr.detectChanges();
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(() => done());
    } else {
      // Fallback navigateurs anciens
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      done();
    }
  }

  closePwdReveal(): void {
    this.clearPwdRevealTimers();
    this.pwdReveal = { open: false, visible: false, email: '', password: '', copied: false };
  }

  private clearPwdRevealTimers(): void {
    if (this.pwdRevealHideTimer) {
      clearTimeout(this.pwdRevealHideTimer);
      this.pwdRevealHideTimer = null;
    }
    if (this.pwdRevealCloseTimer) {
      clearTimeout(this.pwdRevealCloseTimer);
      this.pwdRevealCloseTimer = null;
    }
  }

  loadClubElections(clubId: string): void {
    this.electionService.getElectionsByClub(clubId).subscribe({
      next: (elections) => {
        this.clubElections = elections;
      },
      error: (err) => console.error('Erreur élections:', err)
    });
  }

  loadCustomRoles(clubId: string): void {
    console.log('🔍 Chargement des rôles personnalisés pour le club:', clubId);

    this.customRoleService.getRolesByClub(clubId).subscribe({
      next: (customRoles) => {
        this.customRoles = customRoles.filter(r => r.isActive);

        this.allRoles = [
          ...this.roles,
          ...this.customRoles.map(r => r.roleName),
          '➕ Autre (créer un nouveau rôle)'
        ];
        console.log('📋 allRoles APRÈS chargement:', this.allRoles);
      },
      error: (err) => {
        console.error('❌ Erreur chargement rôles personnalisés:', err);
        this.allRoles = [...this.roles, '➕ Autre (créer un nouveau rôle)'];
      }
    });
  }

  onRoleChange(event: any): void {
    const selectedRole = event.target.value;
    if (selectedRole === '➕ Autre (créer un nouveau rôle)') {
      sessionStorage.setItem('returnToClub', this.club?.id || '');
      this.memberForm.patchValue({ role: 'MEMBRE_SIMPLE' });
      this.router.navigate(['/roles']);
    }
  }

  loadClub(id: string): void {
    this.clubService.getClubById(id).subscribe({
      next: (data) => {
        this.club = data;
        this.loading = false;
        this.refreshIsAdminFromClubMembership();
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.loading = false;
      }
    });
  }

  /** Admin status = system-wide admin OR admin role inside this specific club. */
  private refreshIsAdminFromClubMembership(): void {
    const ADMIN_ROLES = ['PRESIDENT', 'RH', 'SECRETAIRE_GENERALE', 'VICE_PRESIDENT'];
    const systemRole = this.authService.getCurrentRole() || '';
    const currentUserId = this.authService.getCurrentUser()?.userId;
    let inClubRole = '';
    if (currentUserId && this.club?.members) {
      const me = this.club.members.find((m: any) => m.userId === currentUserId);
      inClubRole = me?.role || '';
    }
    this.isAdmin = ADMIN_ROLES.includes(systemRole) || ADMIN_ROLES.includes(inClubRole);
    console.log('🔍 isAdmin refreshed - system:', systemRole, 'inClub:', inClubRole, 'isAdmin:', this.isAdmin);
  }

  refreshClubMembers(): void {
    if (this.club?.id) {
      this.loadClub(this.club.id);
    }
  }

  getRecommendation(clubId: string): void {
    this.clubService.recommendRole(clubId, 'user_ahmed').subscribe({
      next: (data) => {
        this.recommendation = data;
      },
      error: (err) => console.error('Erreur recommandation:', err)
    });
  }

  // ========== Gestion des membres ==========
  debugRoles(): void {
    console.log('=== DEBUG ROLES ===');
    console.log('Club ID:', this.club?.id);
    console.log('Roles par défaut:', this.roles);
    console.log('Custom roles:', this.customRoles);
    console.log('All roles:', this.allRoles);
    console.log('==================');
  }

  addMember(): void {
    if (this.memberForm.invalid || !this.club?.id) return;

    const formValue = this.memberForm.value;
    const selectedRole = formValue.role;

    const customRole = this.customRoles.find(r => r.roleName === selectedRole);

    const newUser: any = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      email: formValue.email,
      password: formValue.password,
      role: selectedRole,
      clubId: this.club.id,
      phoneNumber: '',
      profilePhoto: '',
      active: true
    };

    if (customRole) {
      newUser.customRoleId = customRole.id;
    }

    this.authService.createUser(newUser).subscribe({
      next: (createdUser: any) => {
        const userId = createdUser.userId || createdUser.id || createdUser._id;

        if (!userId) {
          console.error('❌ User ID not found in response:', createdUser);
          alert('❌ Erreur: ID utilisateur non trouvé');
          return;
        }

        const member: Member = {
          userId: userId,
          email: createdUser.email,
          name: `${formValue.firstName} ${formValue.lastName}`.trim(),
          role: selectedRole,
          status: 'APPROVED',
          joinedDate: new Date(),
          subGroupId: null
        };

        this.clubService.addMember(this.club!.id!, member).subscribe({
          next: () => {
            this.memberForm.reset({ role: 'MEMBRE_SIMPLE' });
            this.editingMemberId = null;
            this.loadClub(this.club!.id!);
            // Pas d'alert() : ne PAS exposer le mot de passe en clair par défaut.
            // Ouvre un modal in-app avec message neutre + reveal/copie optionnels.
            this.openPwdReveal(formValue.email, formValue.password);
          },
          error: (err) => {
            console.error('Erreur ajout membre au club:', err);
            alert('❌ Erreur lors de l\'ajout du membre au club');
          }
        });
      },
      error: (err) => {
        console.error('Erreur création utilisateur:', err);
        alert(err.error?.error === 'Email déjà utilisé'
          ? '❌ Email déjà utilisé'
          : '❌ Erreur création compte');
      }
    });
  }

  approveMember(userId: string): void {
    if (!this.club) return;
    this.clubService.approveMember(this.club.id!, userId).subscribe({
      next: () => this.loadClub(this.club!.id!),
      error: (err) => console.error('Erreur:', err)
    });
  }

  rejectMember(userId: string): void {
    if (!this.club) return;
    if (confirm('Êtes-vous sûr de vouloir rejeter ce membre ?')) {
      this.clubService.rejectMember(this.club.id!, userId).subscribe({
        next: () => this.loadClub(this.club!.id!),
        error: (err) => console.error('Erreur:', err)
      });
    }
  }

  changeRole(userId: string, role: string): void {
    if (!this.club) return;
    this.clubService.changeMemberRole(this.club.id!, userId, role).subscribe({
      next: () => this.loadClub(this.club!.id!),
      error: (err) => console.error('Erreur:', err)
    });
  }

  deleteMember(userId: string): void {
    if (!this.club) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) {
      this.clubService.rejectMember(this.club.id!, userId).subscribe({
        next: () => {
          this.authService.deleteUser(userId).subscribe({
            next: () => {
              this.loadClub(this.club!.id!);
              alert('✅ Membre supprimé');
            },
            error: (err) => {
              console.error('Erreur suppression user:', err);
              this.loadClub(this.club!.id!);
              alert('✅ Membre supprimé du club');
            }
          });
        },
        error: (err) => {
          console.error('Erreur suppression du club:', err);
          alert('❌ Erreur lors de la suppression');
        }
      });
    }
  }

  // ========== Gestion des membres (modification) ==========
  startEditMember(member: any): void {
    this.editingMemberId = member.userId;
    this.editMemberData = {
      name: member.name,
      email: member.email,
      role: member.role
    };
  }

  cancelEditMember(): void {
    this.editingMemberId = null;
    this.editMemberData = { name: '', email: '', role: '' };
  }

  saveEditMember(userId: string): void {
    if (!this.club) return;

    if (!userId || userId === 'null' || userId === 'undefined') {
      alert('❌ Erreur: ID membre invalide');
      this.cancelEditMember();
      return;
    }

    const updatedMember = {
      name: this.editMemberData.name,
      email: this.editMemberData.email,
      role: this.editMemberData.role
    };

    this.clubService.updateMemberInClub(this.club.id!, userId, updatedMember).subscribe({
      next: () => {
        this.authService.updateUser(userId, updatedMember).subscribe({
          next: () => {
            this.loadClub(this.club!.id!);
            this.cancelEditMember();
            alert('✅ Membre modifié');
          },
          error: (err) => {
            console.error('Erreur update user:', err);
            this.loadClub(this.club!.id!);
            this.cancelEditMember();
            alert('✅ Membre modifié dans le club');
          }
        });
      },
      error: (err) => {
        console.error('Erreur update club:', err);
        alert('❌ Erreur lors de la modification');
      }
    });
  }

  // ========== Gestion des sous-groupes ==========
  addSubGroup(): void {
    if (this.subGroupForm.invalid || !this.club) return;

    this.clubService.addSubGroup(this.club.id!, this.subGroupForm.value).subscribe({
      next: () => {
        this.loadClub(this.club!.id!);
        this.subGroupForm.reset();
        this.showSubGroupForm = false;
      },
      error: (err) => console.error('Erreur:', err)
    });
  }

  removeSubGroup(subGroupId: string): void {
    if (!this.club) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce sous-groupe ?')) {
      this.clubService.removeSubGroup(this.club.id!, subGroupId).subscribe({
        next: () => this.loadClub(this.club!.id!),
        error: (err) => console.error('Erreur:', err)
      });
    }
  }

  startEditSubGroup(subGroup: SubGroup): void {
    this.editingSubGroupId = subGroup.id!;
    this.editSubGroupData = {
      name: subGroup.name,
      description: subGroup.description
    };
  }

  cancelEditSubGroup(): void {
    this.editingSubGroupId = null;
    this.editSubGroupData = { name: '', description: '' };
  }

  saveEditSubGroup(subGroupId: string): void {
    if (!this.club) return;

    const originalSubGroup = this.club.subGroups.find(sg => sg.id === subGroupId);

    const updatedSubGroup: SubGroup = {
      id: subGroupId,
      name: this.editSubGroupData.name,
      description: this.editSubGroupData.description,
      memberIds: originalSubGroup?.memberIds || []
    };

    this.clubService.updateSubGroup(this.club.id!, subGroupId, updatedSubGroup).subscribe({
      next: () => {
        this.loadClub(this.club!.id!);
        this.cancelEditSubGroup();
      },
      error: (err) => console.error('Erreur:', err)
    });
  }

  assignToSubGroup(): void {
    if (this.assignForm.invalid || !this.club) return;

    const { userId, subGroupId, subGroupRole } = this.assignForm.value;

    const mode = this.club.rules?.committeeMembershipMode || 'MULTIPLE_ALLOWED';

    if (mode === 'SINGLE_ONLY') {
      const existingSubGroup = this.club.subGroups.find(sg =>
        sg.id !== subGroupId && sg.memberIds.includes(userId)
      );

      if (existingSubGroup) {
        const currentSubGroupName = existingSubGroup.name;
        alert(`❌ Ce club n'autorise qu'un seul comité par membre.\n\nLe membre est déjà dans le comité "${currentSubGroupName}".\n\nVeuillez d'abord le retirer de ce comité.`);
        return;
      }
    }

    if (mode === 'MULTIPLE_ALLOWED' && subGroupRole === 'RESPONSABLE') {
      const isAlreadyResponsable = this.club.subGroups.some(sg =>
        sg.id !== subGroupId && sg.responsableId === userId
      );

      if (isAlreadyResponsable) {
        const currentResponsableSubGroup = this.club.subGroups.find(sg =>
          sg.id !== subGroupId && sg.responsableId === userId
        );
        const currentSubGroupName = currentResponsableSubGroup?.name || 'un comité';
        alert(`❌ Un membre ne peut être RESPONSABLE que d'UN SEUL comité.\n\nCe membre est déjà responsable du comité "${currentSubGroupName}".\n\nIl peut rejoindre ce comité en tant que MEMBRE_COMITE.`);
        return;
      }
    }

    if (mode === 'MULTIPLE_ALLOWED') {
      const responsableSubGroup = this.club.subGroups.find(sg =>
        sg.responsableId === userId
      );

      if (responsableSubGroup && responsableSubGroup.id !== subGroupId) {
        const responsableSubGroupName = responsableSubGroup.name;
        alert(`❌ Un responsable de comité ne peut appartenir qu'à son propre comité.\n\nCe membre est responsable du comité "${responsableSubGroupName}".\n\nPour rejoindre un autre comité, il doit d'abord quitter son rôle de responsable.`);
        return;
      }
    }

    const mySubGroupId = this.committeeResponsableService.getMySubGroupId();
    if (mySubGroupId && !this.isAdmin) {
      if (subGroupId !== mySubGroupId) {
        alert('❌ Vous ne pouvez assigner des membres que dans votre propre comité');
        return;
      }
      if (subGroupRole === 'RESPONSABLE') {
        alert('❌ Seul le président peut nommer des responsables de comité');
        return;
      }
    }

    const subGroup = this.club.subGroups.find(sg => sg.id === subGroupId);
    if (!subGroup) {
      alert('❌ Comité introuvable');
      return;
    }

    this.clubService.assignToSubGroup(this.club.id!, userId, subGroupId, subGroupRole).subscribe({
      next: () => {
        this.loadClub(this.club!.id!);
        this.assignForm.reset({ subGroupRole: 'MEMBRE_COMITE' });
        this.showAssignForm = false;

        if (subGroupRole === 'RESPONSABLE') {
          alert(`✅ Membre assigné au comité en tant que Responsable\nNouveau rôle: Responsable ${subGroup.name}`);
        } else {
          alert(`✅ Membre assigné au comité`);
        }

        const currentUserId = this.authService.getCurrentUser()?.userId;
        if (userId === currentUserId) {
          this.permissionService.loadUserPermissions();
          this.committeeResponsableService.loadResponsableStatus();
        }
      },
      error: (err) => {
        console.error('Erreur:', err);
        const errorMessage = err.error?.message || err.error || 'Erreur lors de l\'assignation';
        alert('❌ ' + errorMessage);
      }
    });
  }

  // ========== Utilitaires ==========
  getStatusColor(status: string): string {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getRoleColor(role: string): string {
    if (role === 'PRESIDENT') return 'bg-purple-100 text-purple-800';
    if (role === 'VICE_PRESIDENT') return 'bg-indigo-100 text-indigo-800';
    if (role === 'SECRETAIRE_GENERALE') return 'bg-blue-100 text-blue-800';
    if (role === 'TRESORIER') return 'bg-green-100 text-green-800';
    if (role === 'RH') return 'bg-orange-100 text-orange-800';
    if (role.startsWith('Responsable ')) return 'bg-red-100 text-red-800';
    if (role.startsWith('Membre du comité ')) return 'bg-yellow-100 text-yellow-800';
    if (role === 'MEMBRE_SIMPLE') return 'bg-gray-100 text-gray-800';
    return 'bg-cyan-100 text-cyan-800';
  }

  deleteClub(): void {
    if (this.club?.id && confirm('Êtes-vous sûr de vouloir supprimer ce club ?')) {
      this.clubService.deleteClub(this.club.id).subscribe({
        next: () => this.router.navigate(['/clubs']),
        error: (err) => console.error('Erreur:', err)
      });
    }
  }

  getMemberNameById(memberId: string): string {
    const member = this.club?.members.find(m => m.userId === memberId);
    return member?.name || memberId;
  }

  getMemberById(memberId: string): any {
    return this.club?.members.find(m => m.userId === memberId) || null;
  }

  /**
   * Role du membre DANS UN COMITE specifique. Source de verite: sg.memberRoles[userId].
   * Un user peut etre RESPONSABLE d'un comite et MEMBRE_COMITE d'un autre.
   * AVANT le template lisait m.subGroupRole (champ unique du Member) -> affichait
   * "Responsable" partout meme si l'user n'etait pas responsable de tous les comites.
   */
  getCommitteeRole(sg: any, memberId: string): string {
    return (sg?.memberRoles && sg.memberRoles[memberId]) || 'MEMBRE_COMITE';
  }

  removeMemberFromSubGroup(subGroupId: string, userId: string): void {
    if (!this.club || !confirm('Retirer ce membre du sous-groupe ?')) return;

    const mySubGroupId = this.committeeResponsableService.getMySubGroupId();
    if (mySubGroupId && !this.isAdmin) {
      if (subGroupId !== mySubGroupId) {
        alert('❌ Vous ne pouvez retirer des membres que de votre propre comité');
        return;
      }
    }

    this.clubService.removeFromSubGroup(this.club.id!, subGroupId, userId).subscribe({
      next: () => {
        this.loadClub(this.club!.id!);
        alert('✅ Membre retiré du comité');

        const currentUserId = this.authService.getCurrentUser()?.userId;
        if (userId === currentUserId) {
          this.permissionService.loadUserPermissions();
          this.committeeResponsableService.loadResponsableStatus();
        }
      },
      error: (err) => {
        console.error('Erreur:', err);
        alert('❌ Erreur lors du retrait');
      }
    });
  }

  changeSubGroupRole(subGroupId: string, userId: string, event: any): void {
    if (!this.club) return;

    const newRole = event.target.value;
    const currentUserId = this.authService.getCurrentUser()?.userId;

    if (userId === currentUserId) {
      alert('❌ Vous ne pouvez pas changer votre propre rôle');
      event.target.value = this.club.members.find(m => m.userId === userId)?.subGroupRole || 'MEMBRE_COMITE';
      return;
    }

    const mySubGroupId = this.committeeResponsableService.getMySubGroupId();
    if (mySubGroupId && !this.isAdmin) {
      if (subGroupId !== mySubGroupId) {
        alert('❌ Vous ne pouvez changer les rôles que dans votre propre comité');
        event.target.value = this.club.members.find(m => m.userId === userId)?.subGroupRole || 'MEMBRE_COMITE';
        return;
      }
    }

    const member = this.club.members.find(m => m.userId === userId);
    const subGroup = this.club.subGroups.find(sg => sg.id === subGroupId);

    if (!member || !subGroup) return;

    const action = newRole === 'RESPONSABLE' ? 'promouvoir' : 'rétrograder';
    const newRoleLabel = newRole === 'RESPONSABLE' ? 'Responsable' : 'Membre du comité';

    if (!confirm(`Voulez-vous ${action} ${member.name} en tant que ${newRoleLabel} ?`)) {
      event.target.value = member.subGroupRole || 'MEMBRE_COMITE';
      return;
    }

    this.clubService.assignToSubGroup(this.club.id!, userId, subGroupId, newRole).subscribe({
      next: () => {
        this.loadClub(this.club!.id!);

        if (newRole === 'RESPONSABLE') {
          alert(`✅ ${member.name} est maintenant Responsable du comité ${subGroup.name}`);
        } else {
          alert(`✅ ${member.name} est maintenant Membre du comité ${subGroup.name}`);
        }

        if (userId === currentUserId) {
          this.permissionService.loadUserPermissions();
          this.committeeResponsableService.loadResponsableStatus();
        }
      },
      error: (err) => {
        console.error('Erreur:', err);
        alert('❌ Erreur lors du changement de rôle');
        event.target.value = member.subGroupRole || 'MEMBRE_COMITE';
      }
    });
  }

  // ========== Gestion des invitations ==========
  openInviteModal(): void {
    this.showInviteModal = true;
  }

  closeInviteModal(): void {
    this.showInviteModal = false;
  }

  onInvitationSent(): void {
    if (this.club?.id) {
      this.loadClub(this.club.id);
    }
  }
}
