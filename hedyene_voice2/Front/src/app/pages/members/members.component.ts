import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ChannelService } from '../../shared/services/channel.service';

interface SimpleMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  committee: string;
  committeeInput: string;
  saving: boolean;
  saved: boolean;
}

@Component({
  selector: 'app-members',
  imports: [CommonModule, FormsModule],
  templateUrl: './members.component.html',
})
export class MembersComponent implements OnInit {
  members: SimpleMember[] = [];
  loading = true;
  error = '';

  constructor(private authService: AuthService, private channelService: ChannelService) {}

  ngOnInit() {
    this.authService.getSimpleMembers().subscribe({
      next: (data) => {
        this.members = data.map((m: any) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          email: m.email,
          phoneNumber: m.phoneNumber,
          committee: m.committee ?? '',
          committeeInput: m.committee ?? '',
          saving: false,
          saved: false,
        }));
        this.loading = false;
        // Sync every member: remove from wrong committee channels, add to correct one
        this.members
          .filter(m => m.committee)
          .forEach(m => this.channelService.syncMemberCommitteeChannel(m.id, m.committee).subscribe());
      },
      error: () => {
        this.error = 'Failed to load members.';
        this.loading = false;
      },
    });
  }

  saveCommittee(member: SimpleMember) {
    if (!member.committeeInput.trim()) return;
    member.saving = true;
    member.saved = false;
    const newCommittee = member.committeeInput.trim();
    this.authService.assignPost(member.id, newCommittee).subscribe({
      next: (updated: any) => {
        member.committee = updated.committee ?? newCommittee;
        // Sync: removes from all wrong committee channels, adds to new one
        this.channelService.syncMemberCommitteeChannel(member.id, member.committee).subscribe();
        member.saving = false;
        member.saved = true;
        setTimeout(() => (member.saved = false), 2000);
      },
      error: () => {
        member.saving = false;
      },
    });
  }
}
