import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, LegacyUser } from '../../../shared/services/auth.service';
import { ClubService } from '../../../services/club.service';
import { Member } from '../../../models/club.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-list.component.html'
})
export class UserListComponent implements OnInit {
  users: LegacyUser[] = [];
  loading = true;
  showForm = false;
  userForm: FormGroup;
  currentUser: LegacyUser | null = null;
  successMessage = '';
  errorMessage = '';
  clubName: string = '';  // ← AJOUTER

  roles = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'TRESORIER', 'RH', 'MEMBRE_SIMPLE'];

  constructor(
    private authService: AuthService,
    private clubService: ClubService,
    private fb: FormBuilder
  ) {
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      role: ['MEMBRE_SIMPLE', Validators.required]
    });
  }

  ngOnInit(): void {
    // Refresh le user state depuis le backend pour avoir le clubId a jour
    // (le president peut avoir ete relie a un nouveau club apres son login).
    this.authService.refreshSession().subscribe({
      next: () => this.initWithFreshUser(),
      error: () => this.initWithFreshUser() // fallback sur le state local
    });
  }

  private initWithFreshUser(): void {
    const authUser = this.authService.getCurrentUser();

    if (authUser) {
      // Récupérer le nom du club via clubService
      if (authUser.clubId) {
        this.clubService.getClubById(authUser.clubId).subscribe({
          next: (club) => {
            this.clubName = club.name;
          },
          error: () => {
            this.clubName = '';
          }
        });
      }
      
      // Construire currentUser à partir de AuthResponse
      this.currentUser = {
        id: authUser.userId,
        name: `${authUser.firstName} ${authUser.lastName}`,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        email: authUser.email,
        role: authUser.role,
        clubId: authUser.clubId,
        clubName: authUser.clubName || '',  // ← Peut être vide
        active: true
      };
    }
    
    this.loadUsers();
  }

  loadUsers(): void {
    this.authService.getUsersByClub().subscribe({
      next: (data: LegacyUser[]) => {
        this.users = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  addUser(): void {
    if (this.userForm.invalid || !this.currentUser) return;
  
    const formValue = this.userForm.value;
    
    // Créer l'utilisateur avec firstName et lastName
    const newUser: LegacyUser = {
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      name: `${formValue.firstName} ${formValue.lastName}`,
      email: formValue.email,
      password: formValue.password,
      role: formValue.role,
      clubId: this.currentUser.clubId,
      clubName: this.clubName,  // ← Utiliser clubName récupéré
      active: true
    };
  
    // ÉTAPE 1 — Créer le compte user
    this.authService.createUser(newUser).subscribe({
      next: (createdUser: LegacyUser) => {
  
        // ÉTAPE 2 — Ajouter dans club.members avec status APPROVED
        const memberData: Member = {
          userId: createdUser.id || '',
          email: createdUser.email,
          name: createdUser.name || `${createdUser.firstName} ${createdUser.lastName}`,
          role: createdUser.role,
          status: 'APPROVED',
          joinedDate: new Date(),
          subGroupId: null
        };
  
        this.clubService.addMember(this.currentUser!.clubId ?? '', memberData).subscribe({
          next: () => {
            this.successMessage = `✅ "${newUser.name}" créé et ajouté au club !`;
            this.errorMessage = '';
            this.loadUsers();
            this.userForm.reset({ role: 'MEMBRE_SIMPLE', firstName: '', lastName: '' });
            this.showForm = false;
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: () => {
            this.successMessage = `✅ "${newUser.name}" créé (ajout club échoué)`;
            this.loadUsers();
            this.userForm.reset({ role: 'MEMBRE_SIMPLE', firstName: '', lastName: '' });
            this.showForm = false;
          }
        });
      },
      error: (err: any) => {
        this.errorMessage = err.error?.error || 'Erreur lors de la création';
        this.successMessage = '';
      }
    });
  }

  deleteUser(id: string, name: string): void {
    if (confirm(`Supprimer "${name}" ?`)) {
      this.authService.deleteUser(id).subscribe({
        next: () => {
          this.successMessage = 'Membre supprimé';
          this.loadUsers();
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: (err) => {
          this.errorMessage = 'Erreur lors de la suppression';
          console.error(err);
        }
      });
    }
  }

  getRoleColor(role: string): string {
    switch(role) {
      case 'CEO': return 'bg-purple-100 text-purple-800';
      case 'SECRETARY': return 'bg-blue-100 text-blue-800';
      case 'TREASURER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
}