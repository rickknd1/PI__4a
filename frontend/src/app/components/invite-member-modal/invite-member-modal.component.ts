import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { InvitationService } from '../../services/invitation.service';
import { CustomRoleService, CustomRole } from '../../services/custom-role.service';

@Component({
  selector: 'app-invite-member-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invite-member-modal.component.html',
  styleUrls: ['./invite-member-modal.component.css']
})
export class InviteMemberModalComponent implements OnInit, OnChanges {
  @Input() clubId!: string;
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() invitationSent = new EventEmitter<void>();

  inviteForm: FormGroup;
  loading = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  roles = [
    { value: 'PRESIDENT', label: 'Président' },
    { value: 'VICE_PRESIDENT', label: 'Vice-Président' },
    { value: 'SECRETAIRE_GENERALE', label: 'Secrétaire Général(e)' },
    { value: 'TRESORIER', label: 'Trésorier' },
    { value: 'RH', label: 'Responsable RH' },
    { value: 'MEMBRE_SIMPLE', label: 'Membre Simple' }
  ];

  customRoles: CustomRole[] = [];
  allRoles: any[] = [];

  constructor(
    private fb: FormBuilder,
    private invitationService: InvitationService,
    private customRoleService: CustomRoleService
  ) {
    this.inviteForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['MEMBRE_SIMPLE', Validators.required]
    });
  }

  ngOnInit() {
    this.allRoles = [...this.roles];

    if (this.clubId) {
      this.loadCustomRoles();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['clubId'] && this.clubId) {
      this.loadCustomRoles();
    }

    if (changes['show'] && this.show && this.clubId) {
      this.loadCustomRoles();
    }
  }

  loadCustomRoles() {
    if (!this.clubId) {
      this.allRoles = [...this.roles];
      return;
    }

    this.customRoleService.getRolesByClub(this.clubId).subscribe({
      next: (customRoles) => {
        this.customRoles = customRoles.filter((r: any) => r.isActive);

        this.allRoles = [
          ...this.roles,
          ...this.customRoles.map(r => ({ value: r.roleName, label: r.roleName }))
        ];
      },
      error: (err: any) => {
        console.error('❌ Erreur chargement rôles personnalisés:', err);
        this.allRoles = [...this.roles];
      }
    });
  }

  onSubmit() {
    if (this.inviteForm.valid && this.clubId) {
      this.loading = true;
      this.message = '';

      const formValue = this.inviteForm.value;
      const selectedRole = formValue.role;

      const customRole = this.customRoles.find(r => r.roleName === selectedRole);

      const inviteData = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email,
        role: selectedRole,
        clubId: this.clubId,
        ...(customRole && { customRoleId: customRole.id })
      };

      this.invitationService.inviteMember(inviteData).subscribe({
        next: (response: any) => {
          this.message = `✅ Invitation envoyée avec succès à ${formValue.email}`;
          this.messageType = 'success';
          this.loading = false;
          this.inviteForm.reset({ role: 'MEMBRE_SIMPLE' });

          setTimeout(() => {
            this.invitationSent.emit();
            this.closeModal();
          }, 2000);
        },
        error: (error: any) => {
          this.message = error.error?.message || 'Erreur lors de l\'envoi de l\'invitation';
          this.messageType = 'error';
          this.loading = false;
        }
      });
    }
  }

  closeModal() {
    this.show = false;
    this.message = '';
    this.inviteForm.reset({ role: 'MEMBRE_SIMPLE' });
    this.close.emit();
  }
}
