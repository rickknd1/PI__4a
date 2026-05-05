import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../../services/modal.service';

import { InputFieldComponent } from '../../form/input/input-field.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { LabelComponent } from '../../form/label/label.component';
import { ModalComponent } from '../../ui/modal/modal.component';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-info-card',
  imports: [
    InputFieldComponent,
    ButtonComponent,
    LabelComponent,
    ModalComponent
],
  templateUrl: './user-info-card.component.html',
  styles: ``
})
export class UserInfoCardComponent implements OnInit {

  constructor(public modal: ModalService, private authService: AuthService) {
    const session = this.authService.getCurrentUser();
    if (session) {
      this.user.firstName = session.firstName;
      this.user.lastName = session.lastName;
      this.user.email = session.email;
      this.user.phone = session.phoneNumber ?? '';
      this.user.role = session.role;
      this.user.bio = `Member of Club Hub with the role of ${session.role.replace(/_/g, ' ').toLowerCase()}.`;
    }
  }

  ngOnInit() {
    this.authService.getMe().subscribe({
      next: (data) => { this.user.phone = data.phoneNumber ?? ''; },
      error: () => {}
    });
  }

  isOpen = false;
  openModal() { this.isOpen = true; }
  closeModal() { this.isOpen = false; }

  user = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    bio: '',
    social: {
      facebook: '',
      x: '',
      linkedin: '',
      instagram: '',
    },
  };

  handleSave() {
    console.log('Saving changes...');
    this.modal.closeModal();
  }
}
