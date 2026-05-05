import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface AvatarOption {
  id: string;
  name: string;
  color: string;
  skinColor: string;
  hairColor: string;
  emoji: string;
}

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.component.html',
  styleUrls: ['./lobby.component.css']
})
export class LobbyComponent implements OnInit {

  avatarOptions: AvatarOption[] = [
    { id: 'av1', name: 'Alex',    color: '#3b6fd4', skinColor: '#FDBCB4', hairColor: '#3d2b1f', emoji: '🧑' },
    { id: 'av2', name: 'Sami',    color: '#2d9e6b', skinColor: '#D4A574', hairColor: '#1a0f00', emoji: '🧔' },
    { id: 'av3', name: 'Layla',   color: '#e04f9e', skinColor: '#FDBCB4', hairColor: '#1a0f00', emoji: '👩' },
    { id: 'av4', name: 'Nour',    color: '#9b5de5', skinColor: '#C68642', hairColor: '#000000', emoji: '👩‍🦱' },
    { id: 'av5', name: 'Cyborg',  color: '#e85d04', skinColor: '#888888', hairColor: '#222222', emoji: '🤖' },
    { id: 'av6', name: 'Jade',    color: '#00b4d8', skinColor: '#FDBCB4', hairColor: '#c8b400', emoji: '👱‍♀️' },
  ];

  selectedAvatar: AvatarOption | null = null;
  playerName = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Un avatar par défaut évite le bouton « Choisir un avatar d’abord » et les clics sans effet
    this.selectedAvatar = this.avatarOptions[0] ?? null;
    this.route.paramMap.subscribe(params => {
      const r = params.get('roomId')?.trim();
      if (r) {
        localStorage.setItem('roomId', r);
      }
    });
  }

  selectAvatar(avatar: AvatarOption) {
    this.selectedAvatar = avatar;
  }

  enterRoom(event?: Event): void {
    event?.preventDefault();
    if (!this.selectedAvatar) {
      return;
    }
    const data = {
      ...this.selectedAvatar,
      name: (this.playerName || '').trim() || this.selectedAvatar.name
    };
    localStorage.setItem('avatar', JSON.stringify(data));

    // Sibling de lobby sous `ameni` (évite des échecs de navigate absolu / base href)
    void this.router
      .navigate(['../virtual-room'], { relativeTo: this.route })
      .then((ok) => {
        if (ok) {
          return true;
        }
        return this.router.navigateByUrl('/ameni/virtual-room');
      })
      .catch((err) => {
        console.error('Navigation vers la salle 3D impossible', err);
        void this.router.navigateByUrl('/ameni/virtual-room');
      });
  }
}