import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChannelService, Channel, AudioMessage } from '../shared/services/channel.service';
import { AuthService } from '../services/auth.service';
import { VoiceSignalingService } from '../shared/services/voice-signaling.service';
import { getGatewayBase } from '../environments/environment';

interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  committee?: string;
  profilePhoto?: string;
}

@Component({
  selector: 'app-instant-voice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instant-voice.component.html',
  styleUrl: './instant-voice.component.css',
})
export class InstantVoiceComponent implements OnInit, OnDestroy {

  view: 'list' | 'detail' | 'create' = 'list';
  channels: Channel[] = [];
  selectedChannel: Channel | null = null;

  isRecording = false;
  isSaving = false;
  recordingError = '';
  loading = false;
  error = '';
  pendingDeleteChannel: Channel | null = null;

  newChannelName = '';
  newChannelPrivate = false;
  selectedMemberIds: string[] = [];

  allUsers: AppUser[] = [];
  usersLoading = false;
  channelMembers: AppUser[] = [];
  membersLoading = false;

  audioHistory: AudioMessage[] = [];
  audioLoading = false;

  playingId: string | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private audioHistoryPoll: any = null;

  // Report
  reportingAudio: AudioMessage | null = null;
  reportReason = '';
  reportDetails = '';
  reportSubmitting = false;
  reportSuccess = false;

  openReportModal(msg: AudioMessage) {
    this.reportingAudio = msg;
    this.reportReason = '';
    this.reportDetails = '';
    this.reportSuccess = false;
  }

  closeReportModal() {
    this.reportingAudio = null;
  }

  submitReport() {
    if (!this.reportReason || !this.reportingAudio) return;
    this.reportSubmitting = true;
    this.http.post(`${getGatewayBase()}/api/reports`, {
      audioMessageId: this.reportingAudio.id,
      channelId: this.selectedChannel!.id,
      channelName: this.selectedChannel!.name,
      reportedByUserId: this.currentUserId,
      reportedByUserName: this.currentUserName,
      reportedUserId: this.reportingAudio.userId,
      reportedUserName: this.reportingAudio.userName,
      audioData: this.reportingAudio.audioData,
      contentType: this.reportingAudio.contentType,
      reason: this.reportReason,
      details: this.reportDetails
    }).subscribe({
      next: () => {
        this.reportSubmitting = false;
        this.reportSuccess = true;
        setTimeout(() => this.closeReportModal(), 1500);
      },
      error: () => { this.reportSubmitting = false; }
    });
  }

  // Kick
  pendingKickMember: AppUser | null = null;
  kickingId: string | null = null;

  // Add member
  showAddMemberPanel = false;
  addableUsers: AppUser[] = [];
  addableLoading = false;
  addingUserId: string | null = null;
  memberSearch = '';

  get filteredAddableUsers(): AppUser[] {
    const q = this.memberSearch.trim().toLowerCase();
    if (!q) return [];
    return this.addableUsers.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }

  currentUserId = '';
  currentUserRole = '';
  currentUserCommittee = '';
  currentUserName = '';

  get isMembreSimple(): boolean { return this.currentUserRole === 'MEMBRE_SIMPLE'; }

  canKick(member: AppUser): boolean {
    if (this.isMembreSimple) return false;
    if (member.id === this.currentUserId) return false;
    if (member.role === 'PRESIDENT') return false;
    if (member.role !== 'MEMBRE_SIMPLE') return this.currentUserRole === 'PRESIDENT';
    return true;
  }

  private memberOrder(member: AppUser): number {
    if (member.role === 'PRESIDENT') return 0;
    if (member.role !== 'MEMBRE_SIMPLE') return 1;
    if (member.id === this.currentUserId) return 2;
    return 3;
  }

  private sortMembers(members: AppUser[]): AppUser[] {
    return members.sort((a, b) => this.memberOrder(a) - this.memberOrder(b));
  }

  get selectedUsers(): AppUser[] {
    return this.allUsers.filter(u => this.selectedMemberIds.includes(u.id));
  }

  get listenerCount(): number { return this.voiceService.listenerCount; }

  constructor(
    private channelService: ChannelService,
    private authService: AuthService,
    private http: HttpClient,
    public voiceService: VoiceSignalingService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.userId ?? '';
    this.currentUserRole = user?.role ?? '';
    this.authService.getMe().subscribe({
      next: (data: any) => {
        this.currentUserCommittee = data?.committee ?? '';
        this.currentUserName = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || data?.email || 'Unknown';
        if (this.currentUserRole === 'MEMBRE_SIMPLE' && this.currentUserCommittee) {
          this.channelService.syncMemberCommitteeChannel(this.currentUserId, this.currentUserCommittee).subscribe({
            next: () => this.loadChannels(), error: () => this.loadChannels()
          });
        } else {
          this.loadChannels();
        }
      },
      error: () => this.loadChannels()
    });
  }

  loadChannels() {
    this.loading = true;
    this.error = '';
    this.channelService.getAll(this.currentUserId, this.currentUserRole, this.currentUserCommittee).subscribe({
      next: (data) => {
        this.channels = data;
        this.loading = false;
        // Restore previously open channel after refresh
        const savedId = sessionStorage.getItem('selectedChannelId');
        if (savedId) {
          const ch = data.find(c => c.id === savedId);
          if (ch) this.openChannel(ch);
        }
      },
      error: () => { this.error = 'Could not load channels. Is the backend running?'; this.loading = false; }
    });
  }

  openChannel(channel: Channel) {
    sessionStorage.setItem('selectedChannelId', channel.id);
    this.selectedChannel = channel;
    this.view = 'detail';
    this.audioHistory = [];
    this.channelMembers = [];
    this.membersLoading = true;
    this.recordingError = '';
    this.showAddMemberPanel = false;
    this.addableUsers = [];
    this.pendingKickMember = null;

    this.http.get<AppUser[]>(`${getGatewayBase()}/api/users`).subscribe({
      next: (users) => {
        if (!channel.isPrivate) {
          this.channelMembers = this.sortMembers(users);
        } else {
          const memberIds = new Set(channel.memberIds ?? []);
          const kickedIds = new Set(channel.kickedMemberIds ?? []);
          this.channelMembers = this.sortMembers(users.filter(u => {
            if (u.role === 'PRESIDENT') return true;                        // always shown
            if (u.role !== 'MEMBRE_SIMPLE') return !kickedIds.has(u.id);   // non-simple unless kicked
            return memberIds.has(u.id);                                     // simple only if in memberIds
          }));
        }
        this.membersLoading = false;
      },
      error: () => { this.membersLoading = false; }
    });

    this.loadAudioHistory(channel.id);

    // Join signaling immediately so we can receive audio from anyone who starts talking
    this.voiceService.joinChannel(channel.id, this.currentUserId, this.currentUserName);
  }

  loadAudioHistory(channelId: string) {
    this.audioLoading = true;
    const url = `${getGatewayBase()}/api/voice2/channels/${channelId}/audio?role=${this.currentUserRole}`;
    this.http.get<AudioMessage[]>(url).subscribe({
      next: (msgs) => { this.audioHistory = msgs; this.audioLoading = false; },
      error: () => { this.audioLoading = false; }
    });
    this.stopAudioHistoryPoll();
    this.ngZone.runOutsideAngular(() => {
      this.audioHistoryPoll = setInterval(() => {
        this.http.get<AudioMessage[]>(url).subscribe({
          next: (msgs) => this.ngZone.run(() => { this.audioHistory = msgs; })
        });
      }, 10000);
    });
  }

  private stopAudioHistoryPoll() {
    if (this.audioHistoryPoll) {
      clearInterval(this.audioHistoryPoll);
      this.audioHistoryPoll = null;
    }
  }

  playAudio(msg: AudioMessage) {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
      if (this.playingId === msg.id) { this.playingId = null; return; }
    }
    const audio = new Audio(`data:${msg.contentType};base64,${msg.audioData}`);
    audio.play().catch(() => {});
    audio.onended = () => { this.playingId = null; this.activeAudio = null; };
    this.activeAudio = audio;
    this.playingId = msg.id;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  requestDeleteChannel(channel: Channel, event: Event) {
    event.stopPropagation();
    this.pendingDeleteChannel = channel;
  }

  cancelDelete() { this.pendingDeleteChannel = null; }

  confirmDelete() {
    const channel = this.pendingDeleteChannel;
    if (!channel) return;
    this.pendingDeleteChannel = null;
    const doDelete = () => {
      this.channelService.delete(channel.id).subscribe({
        next: () => { this.channels = this.channels.filter(c => c.id !== channel.id); },
        error: () => { this.error = 'Failed to delete channel.'; }
      });
    };
    if (channel.isCommitteeChannel) {
      this.authService.clearPostByName(channel.name).subscribe({
        next: () => doDelete(), error: () => doDelete()
      });
    } else {
      doDelete();
    }
  }

  goToCreate() {
    this.usersLoading = true;
    this.http.get<AppUser[]>(`${getGatewayBase()}/api/users`).subscribe({
      next: (users) => { this.allUsers = users.filter(u => u.id !== this.currentUserId); this.usersLoading = false; },
      error: () => { this.usersLoading = false; }
    });
    this.view = 'create';
  }

  onPrivacyChange() { if (!this.newChannelPrivate) this.selectedMemberIds = []; }

  toggleMember(userId: string) {
    const idx = this.selectedMemberIds.indexOf(userId);
    if (idx === -1) this.selectedMemberIds.push(userId);
    else this.selectedMemberIds.splice(idx, 1);
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMemberIds.includes(userId);
  }

  // ─── Kick ─────────────────────────────────────────────────────────────────

  requestKick(member: AppUser, event: Event) {
    event.stopPropagation();
    this.pendingKickMember = member;
  }

  cancelKick() { this.pendingKickMember = null; }

  confirmKick() {
    const member = this.pendingKickMember;
    if (!member) return;
    this.pendingKickMember = null;
    this.kickingId = member.id;
    this.channelService.removeMember(this.selectedChannel!.id, member.id).subscribe({
      next: (ch) => {
        if (this.selectedChannel) {
          this.selectedChannel.memberIds = ch.memberIds;
          this.selectedChannel.kickedMemberIds = ch.kickedMemberIds;
        }
        // Remove from visible list — kicked members no longer appear
        this.channelMembers = this.sortMembers(this.channelMembers.filter(m => m.id !== member.id));
        this.kickingId = null;
        if (this.showAddMemberPanel) this.refreshAddableUsers();
      },
      error: () => { this.kickingId = null; }
    });
  }

  // ─── Add member ───────────────────────────────────────────────────────────

  openAddMemberPanel() {
    this.showAddMemberPanel = true;
    this.refreshAddableUsers();
  }

  closeAddMemberPanel() {
    this.showAddMemberPanel = false;
    this.addableUsers = [];
    this.memberSearch = '';
  }

  private refreshAddableUsers() {
    if (!this.selectedChannel?.isPrivate) {
      this.addableUsers = [];
      return;
    }
    this.addableLoading = true;
    this.http.get<AppUser[]>(`${getGatewayBase()}/api/users`).subscribe({
      next: (users) => {
        const inChannel = new Set(this.selectedChannel?.memberIds ?? []);
        const kickedIds = new Set(this.selectedChannel?.kickedMemberIds ?? []);
        let candidates = users.filter(u => !inChannel.has(u.id) && !kickedIds.has(u.id));
        // Committee channels: only allow users with the same committee
        if (this.selectedChannel?.isCommitteeChannel) {
          const committeeName = this.selectedChannel.name;
          candidates = candidates.filter(u => u.role === 'MEMBRE_SIMPLE' && u.committee === committeeName);
        }
        this.addableUsers = candidates;
        this.addableLoading = false;
      },
      error: () => { this.addableLoading = false; }
    });
  }

  addMemberToChannel(user: AppUser) {
    if (this.addingUserId) return;
    this.addingUserId = user.id;
    this.channelService.addMember(this.selectedChannel!.id, user.id).subscribe({
      next: (ch) => {
        this.channelMembers = this.sortMembers([...this.channelMembers, user]);
        this.addableUsers = this.addableUsers.filter(u => u.id !== user.id);
        if (this.selectedChannel) {
          this.selectedChannel.memberIds = ch.memberIds;
          this.selectedChannel.kickedMemberIds = ch.kickedMemberIds;
        }
        this.addingUserId = null;
        this.memberSearch = '';
      },
      error: () => { this.addingUserId = null; }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  goBack() {
    sessionStorage.removeItem('selectedChannelId');
    this.stopAudioHistoryPoll();
    if (this.isRecording) this.cancelRecordingQuietly();
    this.voiceService.leaveChannel();
    this.activeAudio?.pause();
    this.activeAudio = null;
    this.playingId = null;
    this.view = 'list';
    this.selectedChannel = null;
    this.audioHistory = [];
    this.showAddMemberPanel = false;
    this.addableUsers = [];
    this.memberSearch = '';
    this.pendingKickMember = null;
    this.error = '';
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.isRecording = false;
      this.isSaving = true;
      this.recordingError = '';
      try {
        const blob = await this.voiceService.stopTransmitting();
        if (blob && blob.size > 0) await this.uploadAudio(blob);
      } finally {
        this.isSaving = false;
        this.loadAudioHistory(this.selectedChannel!.id);
      }
    } else {
      this.recordingError = '';
      try {
        await this.voiceService.startTransmitting();
        this.isRecording = true;
      } catch (err: any) {
        this.recordingError = err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : 'Could not access microphone. Check your device settings.';
      }
    }
  }

  private cancelRecordingQuietly() {
    this.isRecording = false;
    this.voiceService.stopTransmitting().catch(() => {});
  }

  private uploadAudio(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        this.http.post<AudioMessage>(
          `${getGatewayBase()}/api/voice2/channels/${this.selectedChannel!.id}/audio`,
          { userId: this.currentUserId, userName: this.currentUserName, audioData: base64, contentType: blob.type || 'audio/webm' }
        ).subscribe({
          next: (saved) => { this.audioHistory.unshift(saved); resolve(); },
          error: () => resolve()
        });
      };
      reader.readAsDataURL(blob);
    });
  }

  ngOnDestroy() {
    this.stopAudioHistoryPoll();
    if (this.isRecording) this.cancelRecordingQuietly();
    this.voiceService.leaveChannel();
  }

  createChannel() {
    if (!this.newChannelName.trim()) return;
    this.loading = true;

    // All non-simple users are members by default
    const nonSimpleIds = this.allUsers
      .filter(u => u.role !== 'MEMBRE_SIMPLE')
      .map(u => u.id);

    const memberIds = [...new Set([
      this.currentUserId,
      ...nonSimpleIds,
      ...this.selectedMemberIds
    ])];

    this.channelService.create(
      { name: this.newChannelName.trim(), isPrivate: this.newChannelPrivate, memberIds },
      this.currentUserId, this.currentUserRole
    ).subscribe({
      next: (channel) => { this.channels.push(channel); this.resetForm(); },
      error: () => { this.error = 'Failed to create channel.'; this.loading = false; }
    });
  }

  private resetForm() {
    this.newChannelName = '';
    this.newChannelPrivate = false;
    this.selectedMemberIds = [];
    this.allUsers = [];
    this.loading = false;
    this.view = 'list';
  }
}
