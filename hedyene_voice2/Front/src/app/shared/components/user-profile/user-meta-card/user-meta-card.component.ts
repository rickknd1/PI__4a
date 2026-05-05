import { Component, OnInit } from '@angular/core';
import { InputFieldComponent } from './../../form/input/input-field.component';
import { ModalComponent } from '../../ui/modal/modal.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../services/auth.service';
import { SupabaseService } from '../../../../services/supabase.service';

@Component({
  selector: 'app-user-meta-card',
  imports: [
    ModalComponent,
    InputFieldComponent,
    ButtonComponent,
    CommonModule
  ],
  templateUrl: './user-meta-card.component.html',
  styles: ``
})
export class UserMetaCardComponent implements OnInit {

  isOpen = false;
  uploading = false;

  user = {
    firstName: '',
    lastName: '',
    role: '',
    location: '',
    avatar: '',
    social: { facebook: '', x: '', linkedin: '', instagram: '' },
    email: '',
    phone: '',
    bio: '',
  };

  constructor(
    private authService: AuthService,
    private supabaseService: SupabaseService
  ) {
    const session = this.authService.getCurrentUser();
    if (session) {
      this.user.firstName = session.firstName;
      this.user.lastName  = session.lastName;
      this.user.email     = session.email;
      this.user.phone     = session.phoneNumber ?? '';
      this.user.role      = session.role;
      this.user.avatar    = session.profilePhoto ?? '';
    }
  }

  ngOnInit(): void {
    this.authService.getMe().subscribe({
      next: (data: any) => {
        console.log('✅ getMe:', data);
        if (data.profilePhoto) {
          this.user.avatar = data.profilePhoto;
          const session = this.authService.getCurrentUser();
          if (session) {
            session.profilePhoto = data.profilePhoto;
            localStorage.setItem('user', JSON.stringify(session));
          }
        }
      },
      error: (err: any) => console.error('❌ getMe error:', err)
    });
  }

  openModal()  { this.isOpen = true; }
  closeModal() { this.isOpen = false; }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const session = this.authService.getCurrentUser();
    const userId = session?.userId ?? 'unknown';

    // ── 1. Preview IMMÉDIATE via FileReader (avant upload) ──────────
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.user.avatar = e.target.result; // affiche immédiatement
    };
    reader.readAsDataURL(file);

    // ── 2. Upload vers Supabase en arrière-plan ─────────────────────
    this.uploading = true;
    try {
      const url = await this.supabaseService.uploadAvatar(file, userId);
      console.log('✅ Supabase URL:', url);

      // Remplace le base64 par l'URL Supabase
      this.user.avatar = url;

      // ── 3. Sauvegarde dans MongoDB ──────────────────────────────
      this.authService.updateProfilePhoto(userId, url).subscribe({
        next: (res: any) => {
          console.log('✅ Photo sauvegardée dans MongoDB:', res);
          if (session) {
            session.profilePhoto = url;
            localStorage.setItem('user', JSON.stringify(session));
          }
        },
        error: (err: any) => console.error('❌ Erreur sauvegarde photo:', err)
      });

    } catch (err) {
      console.error('❌ Upload Supabase failed:', err);
      // En cas d'erreur Supabase, on garde quand même la preview locale
    } finally {
      this.uploading = false;
    }
  }

  handleSave() {
    this.closeModal();
  }
}