import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ClubService } from '../../../services/club.service';
import { CommitteeMembershipMode } from '../../../models/club.model';

@Component({
  selector: 'app-club-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './club-form.component.html',
  styleUrls: ['./club-form.component.css']
})
export class ClubFormComponent implements OnInit {
  clubForm: FormGroup;
  isEditMode = false;
  clubId: string | null = null;
  loading = false;
  categories = ['Sport', 'Culture', 'Tech', 'Art', 'Musique', 'Science', 'Entrepreneuriat'];
  
  // ✅ Options pour le mode d'appartenance aux comités
  membershipModes = [
    { 
      value: CommitteeMembershipMode.MULTIPLE_ALLOWED, 
      label: '✅ Plusieurs comités autorisés',
      description: 'Un membre peut appartenir à plusieurs comités. MAIS: un membre ne peut être RESPONSABLE que d\'un seul comité, et un RESPONSABLE ne peut appartenir qu\'à son propre comité.'
    },
    { 
      value: CommitteeMembershipMode.SINGLE_ONLY, 
      label: '🔒 Un seul comité par membre',
      description: 'Un membre ne peut appartenir qu\'à un seul comité à la fois, peu importe son rôle (recommandé pour petits clubs)'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private clubService: ClubService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.clubForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      category: ['', Validators.required],
      visibility: ['PUBLIC'],
      logoUrl: [''],
      colorPalette: ['#3B82F6'],
      committeeMembershipMode: [CommitteeMembershipMode.MULTIPLE_ALLOWED]  // ✅ Par défaut: plusieurs comités autorisés
    });
  }

  ngOnInit(): void {
    this.clubId = this.route.snapshot.paramMap.get('id');
    if (this.clubId) {
      this.isEditMode = true;
      this.loadClub();
    }
  }

  loadClub(): void {
    this.clubService.getClubById(this.clubId!).subscribe({
      next: (club) => {
        this.clubForm.patchValue({
          name: club.name,
          description: club.description,
          category: club.category,
          visibility: club.visibility,
          logoUrl: club.logoUrl,
          colorPalette: club.colorPalette,
          committeeMembershipMode: club.rules?.committeeMembershipMode || CommitteeMembershipMode.MULTIPLE_ALLOWED
        });
      },
      error: (err) => console.error('Erreur:', err)
    });
  }

  onSubmit(): void {
    if (this.clubForm.invalid) return;
    
    this.loading = true;
    
    // ✅ Créer un objet avec SEULEMENT les champs modifiables
    const clubData: any = {
        name: this.clubForm.get('name')?.value,
        description: this.clubForm.get('description')?.value,
        category: this.clubForm.get('category')?.value,
        visibility: this.clubForm.get('visibility')?.value,
        logoUrl: this.clubForm.get('logoUrl')?.value,
        colorPalette: this.clubForm.get('colorPalette')?.value,
        rules: {
            about: '',
            rules: [],
            requiresApproval: true,
            committeeMembershipMode: this.clubForm.get('committeeMembershipMode')?.value
        }
    };
    
    // Supprimer les champs undefined
    Object.keys(clubData).forEach(key => {
        if (clubData[key] === undefined || clubData[key] === null) {
            delete clubData[key];
        }
    });

    if (this.isEditMode) {
        this.clubService.updateClub(this.clubId!, clubData).subscribe({
            next: () => {
                this.router.navigate(['/clubs', this.clubId]);
            },
            error: (err) => {
                console.error('Erreur:', err);
                this.loading = false;
            }
        });
    } else {
        this.clubService.createClub(this.clubForm.value).subscribe({
            next: () => {
                this.router.navigate(['/clubs']);
            },
            error: (err) => {
                console.error('Erreur:', err);
                this.loading = false;
            }
        });
    }
}
}