import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ClubService } from '../../../services/club.service';
import { Club } from '../../../models/club.model';

@Component({
  selector: 'app-club-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './club-list.component.html',
  styleUrls: ['./club-list.component.css']
})
export class ClubListComponent implements OnInit {
  clubs: Club[] = [];
  loading = true;

  constructor(private clubService: ClubService) {}

  ngOnInit(): void {
    this.loadClubs();
  }

  loadClubs(): void {
    this.clubService.getAllClubs().subscribe({
      next: (data) => {
        this.clubs = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur:', err);
        this.loading = false;
      }
    });
  }

  deleteClub(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce club ?')) {
      this.clubService.deleteClub(id).subscribe({
        next: () => {
          this.clubs = this.clubs.filter(club => club.id !== id);
        },
        error: (err) => console.error('Erreur suppression:', err)
      });
    }
  }
}