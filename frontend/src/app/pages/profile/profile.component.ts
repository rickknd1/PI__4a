import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  
  isEditing = false;
  uploading = false;
  saving = false;

  user = {
    userId: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    role: '',
    clubId: '',
    profilePhoto: ''
  };

  editData = {
    firstName: '',
    lastName: '',
    phoneNumber: ''
  };

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    const session = this.authService.getCurrentUser();
    if (session) {
      this.user = {
        userId: session.userId,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        phoneNumber: session.phoneNumber || '',
        role: session.role,
        clubId: session.clubId ?? '',
        profilePhoto: session.profilePhoto || ''
      };
    }

    // Charger les données complètes depuis le backend
    this.authService.getMe().subscribe({
      next: (data: any) => {
        if (data) {
          this.user.firstName = data.firstName || this.user.firstName;
          this.user.lastName = data.lastName || this.user.lastName;
          this.user.phoneNumber = data.phoneNumber || this.user.phoneNumber;
          this.user.profilePhoto = data.profilePhoto || this.user.profilePhoto;
        }
      },
      error: (err) => console.error('Erreur chargement profil:', err)
    });
  }

  startEdit(): void {
    this.editData = {
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      phoneNumber: this.user.phoneNumber
    };
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  saveChanges(): void {
    this.saving = true;
    
    const updateData = {
      firstName: this.editData.firstName,
      lastName: this.editData.lastName,
      phoneNumber: this.editData.phoneNumber
    };

    this.http.put(apiUrl(`/api/users/${this.user.userId}`), updateData).subscribe({
      next: (response: any) => {
        // Mettre à jour les données locales
        this.user.firstName = this.editData.firstName;
        this.user.lastName = this.editData.lastName;
        this.user.phoneNumber = this.editData.phoneNumber;

        // ✅ Émettre le changement à tous les composants via le service
        this.authService.updateLocalProfile({
          firstName: this.editData.firstName,
          lastName: this.editData.lastName,
          phoneNumber: this.editData.phoneNumber
        });

        // ✅ Mettre à jour aussi dans le club si l'utilisateur appartient à un club
        if (this.user.clubId) {
          this.updateMemberInClub();
        }

        this.isEditing = false;
        this.saving = false;
        alert('✅ Profil mis à jour avec succès');
      },
      error: (err) => {
        console.error('Erreur mise à jour profil:', err);
        this.saving = false;
        alert('❌ Erreur lors de la mise à jour du profil');
      }
    });
  }

  // ✅ Mettre à jour les informations du membre dans le club
  private updateMemberInClub(): void {
    const memberData = {
      name: `${this.editData.firstName} ${this.editData.lastName}`.trim(),
      email: this.user.email,
      role: this.user.role
    };

    this.http.put(
      apiUrl(`/api/clubs/${this.user.clubId}/members/${this.user.userId}`),
      memberData
    ).subscribe({
      next: () => {
        console.log('✅ Membre mis à jour dans le club');
      },
      error: (err) => {
        console.error('⚠️ Erreur mise à jour membre dans club:', err);
        // Ne pas bloquer l'utilisateur si cette mise à jour échoue
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    
    // Preview immédiate
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      this.user.profilePhoto = base64;
      
      // Sauvegarder dans le backend
      this.uploading = true;
      this.authService.updateProfilePhoto(this.user.userId, base64).subscribe({
        next: (res: any) => {
          console.log('✅ Photo mise à jour');
          // ✅ Le service auth émet déjà le changement via updateProfilePhoto
          this.uploading = false;
        },
        error: (err: any) => {
          console.error('❌ Erreur sauvegarde photo:', err);
          this.uploading = false;
        }
      });
    };
    reader.readAsDataURL(file);
  }

  getRoleDisplay(): string {
    return this.user.role.replace(/_/g, ' ');
  }
}
