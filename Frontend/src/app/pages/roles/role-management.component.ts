import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../shared/services/auth.service';
import { Router } from '@angular/router';
import { RoleEventsService } from '../../services/role-events.service';
import { PermissionService } from '../../services/permission.service';
import { apiUrl } from '../../../environments/environment';

interface Permission {
  code: string;
  description: string;
  selected?: boolean;
}

interface CustomRole {
  id?: string;
  clubId: string;
  roleName: string;
  description: string;
  permissions: string[];
  isActive: boolean;
}

@Component({
  selector: 'app-role-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.css']
})
export class RoleManagementComponent implements OnInit {
  
  roles: CustomRole[] = [];
  permissions: Permission[] = [];
  loading = true;
  showCreateForm = false;
  editingRoleId: string | null = null;
  returnToClubId: string | null = null;

  newRole: CustomRole = {
    clubId: '',
    roleName: '',
    description: '',
    permissions: [],
    isActive: true
  };

  private baseUrl = apiUrl('/api/roles');

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private roleEventsService: RoleEventsService,
    private permissionService: PermissionService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user?.clubId) {
      this.newRole.clubId = user.clubId;
      this.loadPermissions();
      this.loadRoles();
    }

    // Vérifier si on vient de la page club-detail
    this.returnToClubId = sessionStorage.getItem('returnToClub');
  }

  loadPermissions(): void {
    console.log('🔍 Chargement des permissions...');
    this.http.get<Permission[]>(`${this.baseUrl}/permissions`).subscribe({
      next: (data) => {
        console.log('✅ Permissions reçues:', data);
        this.permissions = data.map(p => ({ ...p, selected: false }));
        console.log('📋 Permissions initialisées:', this.permissions);
      },
      error: (err) => console.error('Erreur chargement permissions:', err)
    });
  }

  loadRoles(): void {
    this.loading = true;
    this.http.get<CustomRole[]>(`${this.baseUrl}/club/${this.newRole.clubId}`).subscribe({
      next: (data) => {
        this.roles = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement rôles:', err);
        this.loading = false;
      }
    });
  }

  togglePermission(permission: Permission): void {
    permission.selected = !permission.selected;
  }

  createRole(): void {
    console.log('🔍 Création de rôle - Permissions:', this.permissions);
    console.log('🔍 Nom du rôle:', this.newRole.roleName);
    
    const selectedPermissions = this.permissions
      .filter(p => p.selected)
      .map(p => p.code);

    console.log('✅ Permissions sélectionnées:', selectedPermissions);

    if (!this.newRole.roleName || selectedPermissions.length === 0) {
      alert('Veuillez remplir le nom du rôle et sélectionner au moins une permission');
      return;
    }

    this.newRole.permissions = selectedPermissions;

    console.log('📤 Envoi du rôle:', this.newRole);

    this.http.post<CustomRole>(this.baseUrl, this.newRole).subscribe({
      next: () => {
        alert('✅ Rôle créé avec succès');
        this.resetForm();
        this.loadRoles();
        
        // ✅ Notifier que les rôles ont changé
        this.roleEventsService.notifyRoleChanged();
      },
      error: (err) => {
        console.error('Erreur création rôle:', err);
        alert('❌ Erreur lors de la création du rôle');
      }
    });
  }

  editRole(role: CustomRole): void {
    this.editingRoleId = role.id!;
    this.newRole = { ...role };
    this.showCreateForm = true;
    
    // Marquer les permissions sélectionnées
    this.permissions.forEach(p => {
      p.selected = role.permissions.includes(p.code);
    });
  }

  updateRole(): void {
    const selectedPermissions = this.permissions
      .filter(p => p.selected)
      .map(p => p.code);

    this.newRole.permissions = selectedPermissions;

    this.http.put<CustomRole>(`${this.baseUrl}/${this.editingRoleId}`, this.newRole).subscribe({
      next: () => {
        alert('✅ Rôle mis à jour avec succès');
        this.resetForm();
        this.loadRoles();
        
        // ✅ Notifier que les rôles ont changé
        this.roleEventsService.notifyRoleChanged();
        
        // ✅ Recharger les permissions de l'utilisateur actuel
        this.permissionService.loadUserPermissions();
      },
      error: (err) => {
        console.error('Erreur mise à jour rôle:', err);
        alert('❌ Erreur lors de la mise à jour du rôle');
      }
    });
  }

  deleteRole(id: string): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) return;

    this.http.delete(`${this.baseUrl}/${id}`).subscribe({
      next: () => {
        alert('✅ Rôle supprimé');
        this.loadRoles();
        
        // ✅ Notifier que les rôles ont changé
        this.roleEventsService.notifyRoleChanged();
        
        // ✅ Recharger les permissions de l'utilisateur actuel
        this.permissionService.loadUserPermissions();
      },
      error: (err) => {
        console.error('Erreur suppression rôle:', err);
        alert('❌ Erreur lors de la suppression');
      }
    });
  }

  openCreateForm(): void {
    this.resetForm();
    this.showCreateForm = true;
  }

  resetForm(): void {
    const clubId = this.newRole.clubId;
    this.newRole = {
      clubId: clubId,
      roleName: '',
      description: '',
      permissions: [],
      isActive: true
    };
    this.permissions.forEach(p => p.selected = false);
    this.showCreateForm = false;
    this.editingRoleId = null;
  }

  getPermissionCount(role: CustomRole): number {
    return role.permissions.length;
  }

  returnToClub(): void {
    if (this.returnToClubId) {
      sessionStorage.removeItem('returnToClub');
      this.router.navigate(['/clubs', this.returnToClubId]);
    }
  }
}
