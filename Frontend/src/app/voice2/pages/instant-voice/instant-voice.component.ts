import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';
import { CommitteeResponsableService } from '../../../shared/services/committee-responsable.service';
import { Voice2Channel, Voice2ChannelService } from '../../services/channel.service';
import { Voice2VoiceSignalingService } from '../../services/voice-signaling.service';
import { EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface AppUser {
  id: string;
  userId?: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  committee?: string;
  profilePhoto?: string;
}

interface AudioMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  audioData: string;
  contentType: string;
  createdAt: string;
  hidden?: boolean;
}

@Component({
  selector: 'app-voice2-instant-voice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instant-voice.component.html',
  styleUrls: ['./instant-voice.component.css'],
})
export class Voice2InstantVoiceComponent implements OnInit, OnDestroy {
  private static readonly VOICE_BUREAU_ROLES = new Set([
    'BUREAU',
    'SUPER_ADMIN',
    'PRESIDENT',
    'VICE_PRESIDENT',
    'RH',
    'SECRETAIRE_GENERALE',
    'SECRETAIRE_GENERAL',
    'TRESORIER',
    'TREASURER',
  ]);
  view: 'list' | 'detail' | 'create' = 'list';
  channels: Voice2Channel[] = [];
  selectedChannel: Voice2Channel | null = null;
  pendingDeleteChannel: Voice2Channel | null = null;

  audioHistory: AudioMessage[] = [];
  audioLoading = false;
  isSaving = false;
  error = '';
  recordingError = '';
  allUsers: AppUser[] = [];
  usersLoading = false;
  channelMembers: AppUser[] = [];
  membersLoading = false;
  selectedMemberIds: string[] = [];
  newChannelName = '';
  newChannelPrivate = false;

  pendingKickMember: AppUser | null = null;
  kickingId: string | null = null;
  showAddMemberPanel = false;
  addableUsers: AppUser[] = [];
  addableLoading = false;
  addingUserId: string | null = null;
  memberSearch = '';
  reportingAudio: AudioMessage | null = null;
  reportReason = '';
  reportDetails = '';
  reportSubmitting = false;
  reportSuccess = false;

  loading = false;
  isRecording = false;
  currentUserId = '';
  currentUserRole = '';
  currentUserName = '';
  currentUserCommittee = '';

  private readonly usersApi = apiUrl('/api/users');
  private readonly reportsApi = apiUrl('/api/voice2/reports');
  private readonly voiceChannelsApi = apiUrl('/api/voice2/channels');
  private activeAudio: HTMLAudioElement | null = null;
  playingId: string | null = null;
  private audioHistoryPoll: any = null;

  constructor(
    private authService: AuthService,
    private channelService: Voice2ChannelService,
    public voiceService: Voice2VoiceSignalingService,
    private http: HttpClient,
    private ngZone: NgZone,
    private respService: CommitteeResponsableService,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = (user?.userId ?? user?.id ?? '').toString();
    this.currentUserRole = user?.role ?? '';
    this.currentUserName = user?.name ?? user?.email ?? 'User';
    this.authService.getMe().subscribe({
      next: (profile: any) => {
        this.currentUserRole = (profile?.role ?? this.currentUserRole ?? '').toString().trim().toUpperCase();
        this.currentUserCommittee = profile?.committee ?? '';
        this.currentUserName =
          `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || profile?.email || this.currentUserName;
        if (!this.isVoiceBureauRole(this.currentUserRole) && this.currentUserCommittee) {
          this.channelService
            .syncMemberCommitteeChannel(this.currentUserId, this.currentUserCommittee)
            .subscribe({ next: () => this.loadChannels(), error: () => this.loadChannels() });
          return;
        }
        this.loadChannels();
      },
      error: () => this.loadChannels(),
    });
  }

  get isMembreSimple(): boolean {
    return !this.isVoiceBureauRole(this.currentUserRole);
  }

  get listenerCount(): number {
    return this.voiceService.listenerCount;
  }

  get filteredAddableUsers(): AppUser[] {
    const q = this.memberSearch.trim().toLowerCase();
    if (!q) return [];
    return this.addableUsers.filter((u) =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
    );
  }

  get selectedUsers(): AppUser[] {
    return this.allUsers.filter((u) => this.selectedMemberIds.includes(this.userIdOf(u)));
  }

  private memberOrder(member: AppUser): number {
    if (member.role === 'PRESIDENT') return 0;
    if (this.isVoiceBureauRole(member.role)) return 1;
    if (member.id === this.currentUserId) return 2;
    return 3;
  }

  private isVoiceBureauRole(role: string | null | undefined): boolean {
    const normalized = (role ?? '').toString().trim().toUpperCase();
    return Voice2InstantVoiceComponent.VOICE_BUREAU_ROLES.has(normalized);
  }

  private sortMembers(members: AppUser[]): AppUser[] {
    return members.sort((a, b) => this.memberOrder(a) - this.memberOrder(b));
  }

  private userIdOf(user: Partial<AppUser> | any): string {
    // userId is the stable business identifier used by voice channel APIs.
    return (user?.userId ?? user?.id ?? user?._id ?? '').toString();
  }

  private normalizeUser(user: any): AppUser {
    return {
      id: this.userIdOf(user),
      userId: user?.userId,
      _id: user?._id,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'MEMBRE_SIMPLE',
      committee: user?.committee ?? '',
      profilePhoto: user?.profilePhoto ?? '',
    };
  }

  canKick(member: AppUser): boolean {
    if (member.id === this.currentUserId) return false;
    if (member.role === 'PRESIDENT') return false;

    // Bureau exec : peut kick partout sauf au-dessus de soi.
    if (this.isVoiceBureauRole(this.currentUserRole)) {
      if (this.isVoiceBureauRole(member.role)) return this.currentUserRole === 'PRESIDENT';
      return true;
    }

    // Responsable d'un comite : peut kick UNIQUEMENT dans le voice channel
    // qui correspond a son propre comite (matching sur le nom). AVANT, le
    // controle isMembreSimple bloquait tous les responsables (qui ont role
    // global = MEMBRE_SIMPLE/COMMITTEE_MEMBER) -> ils ne pouvaient pas gerer
    // leur propre channel.
    const myCommittee = this.respService.getMySubGroupName();
    if (myCommittee && this.selectedChannel?.name === myCommittee) {
      // Pas de droit sur les autres membres bureau (President deja exclu).
      if (this.isVoiceBureauRole(member.role)) return false;
      return true;
    }

    return false;
  }

  loadChannels(): void {
    this.loading = true;
    this.error = '';
    // Defaut robuste : si getMe() a echoue ou si l'user n'a pas encore charge,
    // on retombe sur le user en localStorage et un role MEMBRE_SIMPLE (le moins
    // privilegie). Le backend filtre cote serveur de toute facon.
    if (!this.currentUserId) {
      const fallback = this.authService.getCurrentUser();
      this.currentUserId = (fallback?.userId ?? fallback?.id ?? '').toString();
    }
    if (!this.currentUserRole) {
      const fallbackRole = this.authService.getCurrentRole?.() || 'MEMBRE_SIMPLE';
      this.currentUserRole = fallbackRole.toString().trim().toUpperCase();
    }
    this.channelService.getAll(this.currentUserId, this.currentUserRole).subscribe({
      next: (data) => {
        this.channels = data;
        this.loading = false;
        const savedId = sessionStorage.getItem('selectedVoice2ChannelId');
        if (savedId) {
          const ch = data.find((c) => c.id === savedId);
          if (ch) this.openChannel(ch);
        }
      },
      error: (err) => {
        const httpStatus = typeof err?.status === 'number' ? err.status : 'unknown';
        const detail = (typeof err?.error === 'string') ? err.error
                     : (err?.error?.message || err?.message || `HTTP ${httpStatus}`);
        const safeDetail = (detail && typeof detail === 'string') ? detail : `HTTP ${httpStatus}`;
        this.error = `Could not load channels (${safeDetail}). Check Eureka/Gateway/InstantVoiceManagment services.`;
        console.error('[voice2] loadChannels failed', err);
        this.loading = false;
      },
    });
  }

  openChannel(channel: Voice2Channel): void {
    sessionStorage.setItem('selectedVoice2ChannelId', channel.id);
    this.selectedChannel = channel;
    this.view = 'detail';
    this.audioHistory = [];
    this.channelMembers = [];
    this.membersLoading = true;
    this.recordingError = '';
    this.showAddMemberPanel = false;
    this.addableUsers = [];
    this.pendingKickMember = null;

    this.http.get<AppUser[]>(this.usersApi).subscribe({
      next: (users) => {
        const normalizedUsers = (users ?? []).map((u) => this.normalizeUser(u)).filter((u) => !!u.id);
        if (!channel.isPrivate) {
          this.channelMembers = this.sortMembers(normalizedUsers);
        } else {
          const memberIds = new Set(channel.memberIds ?? []);
          const kickedIds = new Set(channel.kickedMemberIds ?? []);
          this.channelMembers = this.sortMembers(
            normalizedUsers.filter((u) => {
              const uid = this.userIdOf(u);
              if (u.role === 'PRESIDENT') return true;
              if (this.isVoiceBureauRole(u.role)) return !kickedIds.has(uid);
              return memberIds.has(uid);
            }),
          );
        }
        this.membersLoading = false;
      },
      error: () => {
        // Fallback: some user-service roles/endpoints can reject full users list.
        // We still render a minimal members list so the channel remains usable.
        this.authService.getSimpleMembers().subscribe({
          next: (simpleMembers) => {
            const members = (simpleMembers ?? []).map((u: any) => this.normalizeUser(u)).filter((u: AppUser) => !!u.id);

            const withCurrentUser = this.currentUserId
              ? [
                  ...members,
                  {
                    id: this.currentUserId,
                    firstName: this.currentUserName.split(' ')[0] ?? this.currentUserName,
                    lastName: this.currentUserName.split(' ').slice(1).join(' '),
                    email: '',
                    role: this.currentUserRole,
                  } as AppUser,
                ]
              : members;

            const unique = Array.from(
              new Map(withCurrentUser.filter((m) => !!m.id).map((m) => [m.id, m])).values(),
            );

            if (!channel.isPrivate) {
              this.channelMembers = this.sortMembers(unique);
            } else {
              const memberIds = new Set(channel.memberIds ?? []);
              this.channelMembers = this.sortMembers(unique.filter((u) => memberIds.has(u.id)));
            }
            this.error = 'Members loaded in fallback mode.';
            this.membersLoading = false;
          },
          error: () => {
            this.error = 'Unable to load channel members.';
            this.membersLoading = false;
          },
        });
      },
    });

    this.loadAudioHistory(channel.id);
    this.voiceService.joinChannel(channel.id, this.currentUserId, this.currentUserName);
  }

  loadAudioHistory(channelId: string): void {
    this.audioLoading = true;
    const role = (this.currentUserRole ?? '').trim().toUpperCase();
    const url = `${this.voiceChannelsApi}/${channelId}/audio?role=${encodeURIComponent(role)}`;
    this.http.get<AudioMessage[]>(url).subscribe({
      next: (rows) => {
        this.audioHistory = this.isMembreSimple ? rows.filter((m) => !m.hidden) : rows;
        this.audioLoading = false;
      },
      error: () => {
        this.audioLoading = false;
      },
    });
    this.stopAudioHistoryPoll();
    this.ngZone.runOutsideAngular(() => {
      this.audioHistoryPoll = setInterval(() => {
        this.http.get<AudioMessage[]>(url).subscribe({
          next: (rows) =>
            this.ngZone.run(() => {
              this.audioHistory = this.isMembreSimple ? rows.filter((m) => !m.hidden) : rows;
            }),
        });
      }, 10000);
    });
  }

  async toggleRecording(): Promise<void> {
    if (!this.selectedChannel) return;
    if (this.isRecording) {
      this.isRecording = false;
      this.isSaving = true;
      this.recordingError = '';
      try {
        const blob = await this.voiceService.stopTransmitting();
        if (blob && blob.size > 0) await this.uploadAudio(blob);
      } finally {
        this.isSaving = false;
        this.loadAudioHistory(this.selectedChannel.id);
      }
      return;
    }
    this.recordingError = '';
    try {
      await this.voiceService.startTransmitting();
      this.isRecording = true;
    } catch (err: any) {
      this.recordingError =
        err?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : 'Could not access microphone. Check your device settings.';
    }
  }

  private uploadAudio(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      if (!this.selectedChannel) return resolve();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1] ?? '';
        this.http
          .post<AudioMessage>(`${this.voiceChannelsApi}/${this.selectedChannel!.id}/audio`, {
            userId: this.currentUserId,
            userName: this.currentUserName,
            audioData: base64,
            contentType: blob.type || 'audio/webm',
          })
          .subscribe({
            next: (saved) => {
              this.audioHistory.unshift(saved);
              resolve();
            },
            error: () => resolve(),
          });
      };
      reader.readAsDataURL(blob);
    });
  }

  playAudio(msg: AudioMessage): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
      if (this.playingId === msg.id) {
        this.playingId = null;
        return;
      }
    }
    const audio = new Audio(`data:${msg.contentType};base64,${msg.audioData}`);
    audio.onended = () => {
      this.playingId = null;
      this.activeAudio = null;
    };
    audio.play().catch(() => {});
    this.activeAudio = audio;
    this.playingId = msg.id;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  openReportModal(msg: AudioMessage): void {
    this.reportingAudio = msg;
    this.reportReason = '';
    this.reportDetails = '';
    this.reportSuccess = false;
  }

  closeReportModal(): void {
    this.reportingAudio = null;
  }

  submitReport(): void {
    if (!this.reportReason || !this.reportingAudio || !this.selectedChannel) return;
    this.reportSubmitting = true;
    this.http
      .post(this.reportsApi, {
        audioMessageId: this.reportingAudio.id,
        channelId: this.selectedChannel.id,
        channelName: this.selectedChannel.name,
        reportedByUserId: this.currentUserId,
        reportedByUserName: this.currentUserName,
        reportedUserId: this.reportingAudio.userId,
        reportedUserName: this.reportingAudio.userName,
        audioData: this.reportingAudio.audioData,
        contentType: this.reportingAudio.contentType,
        reason: this.reportReason,
        details: this.reportDetails,
      })
      .subscribe({
        next: () => {
          this.reportSubmitting = false;
          this.reportSuccess = true;
          setTimeout(() => this.closeReportModal(), 1500);
        },
        error: (err) => {
          this.reportSubmitting = false;
          const apiMessage = err?.error?.message || err?.error || `Report failed (HTTP ${err?.status ?? 'unknown'})`;
          this.error = typeof apiMessage === 'string' ? apiMessage : 'Report failed.';
          console.error('[voice2] submitReport failed', err);
        },
      });
  }

  requestDeleteChannel(channel: Voice2Channel, event: Event): void {
    event.stopPropagation();
    this.pendingDeleteChannel = channel;
  }

  cancelDelete(): void {
    this.pendingDeleteChannel = null;
  }

  confirmDelete(): void {
    const channel = this.pendingDeleteChannel;
    if (!channel) return;
    this.pendingDeleteChannel = null;
    const doDelete = () => {
      this.channelService.delete(channel.id).subscribe({
        next: () => {
          this.channels = this.channels.filter((c) => c.id !== channel.id);
        },
        error: () => {
          this.error = 'Failed to delete channel.';
        },
      });
    };

    if (channel.isCommitteeChannel) {
      this.authService.clearPostByName(channel.name).subscribe({
        next: () => doDelete(),
        error: () => doDelete(),
      });
    } else {
      doDelete();
    }
  }

  goToCreate(): void {
    this.usersLoading = true;
    this.error = '';
    this.selectedMemberIds = [];
    this.newChannelPrivate = false;
    this.newChannelName = '';
    this.view = 'create';
    this.http.get<AppUser[]>(this.usersApi).subscribe({
      next: (users) => {
        this.allUsers = (users ?? [])
          .map((u) => this.normalizeUser(u))
          .filter((u) => !!u.id && this.userIdOf(u) !== this.currentUserId);
        this.usersLoading = false;
      },
      error: () => {
        this.error = 'Unable to load users for channel creation.';
        this.usersLoading = false;
      },
    });
  }

  onPrivacyChange(): void {
    if (!this.newChannelPrivate) this.selectedMemberIds = [];
  }

  toggleMember(userId: string): void {
    const idx = this.selectedMemberIds.indexOf(userId);
    if (idx === -1) this.selectedMemberIds.push(userId);
    else this.selectedMemberIds.splice(idx, 1);
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMemberIds.includes(userId);
  }

  requestKick(member: AppUser, event: Event): void {
    event.stopPropagation();
    this.pendingKickMember = member;
  }

  cancelKick(): void {
    this.pendingKickMember = null;
  }

  confirmKick(): void {
    const member = this.pendingKickMember;
    if (!member || !this.selectedChannel) return;
    this.pendingKickMember = null;
    const memberId = this.userIdOf(member);
    if (!memberId) return;
    this.kickingId = memberId;
    this.channelService.removeMember(this.selectedChannel.id, memberId).subscribe({
      next: (ch) => {
        if (this.selectedChannel) {
          this.selectedChannel.memberIds = ch.memberIds;
          this.selectedChannel.kickedMemberIds = ch.kickedMemberIds;
        }
        const removedIds = new Set(
          [memberId, member.id, member.userId, member._id]
            .filter((v): v is string => !!v)
            .map((v) => v.toString()),
        );
        this.channelMembers = this.sortMembers(
          this.channelMembers.filter((m) => {
            if (m === member) return false;
            const currentIds = [m.id, m.userId, m._id]
              .filter((v): v is string => !!v)
              .map((v) => v.toString());
            return !currentIds.some((id) => removedIds.has(id));
          }),
        );
        this.kickingId = null;
        if (this.showAddMemberPanel) this.refreshAddableUsers();
      },
      error: () => {
        this.kickingId = null;
        this.error = 'Failed to remove member from channel.';
      },
    });
  }

  openAddMemberPanel(): void {
    this.showAddMemberPanel = true;
    this.refreshAddableUsers();
  }

  closeAddMemberPanel(): void {
    this.showAddMemberPanel = false;
    this.addableUsers = [];
    this.memberSearch = '';
  }

  private refreshAddableUsers(): void {
    if (!this.selectedChannel?.isPrivate) {
      this.addableUsers = [];
      return;
    }
    this.addableLoading = true;
    this.http.get<AppUser[]>(this.usersApi).subscribe({
      next: (users) => {
        const normalizedUsers = (users ?? []).map((u) => this.normalizeUser(u)).filter((u) => !!u.id);
        const inChannel = new Set(this.selectedChannel?.memberIds ?? []);
        let candidates = normalizedUsers.filter((u) => {
          const uid = this.userIdOf(u);
          return !inChannel.has(uid);
        });

        if (this.selectedChannel?.isCommitteeChannel) {
          const committeeName = this.selectedChannel.name;
          candidates = candidates.filter((u) => !this.isVoiceBureauRole(u.role) && u.committee === committeeName);
        }

        this.addableUsers = candidates;
        this.addableLoading = false;
      },
      error: () => {
        this.addableLoading = false;
      },
    });
  }

  addMemberToChannel(user: AppUser): void {
    if (!this.selectedChannel || this.addingUserId) return;
    const memberId = this.userIdOf(user);
    if (!memberId) return;
    this.addingUserId = memberId;
    this.channelService.addMember(this.selectedChannel.id, memberId).subscribe({
      next: (ch) => {
        this.channelMembers = this.sortMembers([...this.channelMembers, user]);
        this.addableUsers = this.addableUsers.filter((u) => this.userIdOf(u) !== memberId);
        if (this.selectedChannel) {
          this.selectedChannel.memberIds = ch.memberIds;
          this.selectedChannel.kickedMemberIds = ch.kickedMemberIds;
        }
        this.addingUserId = null;
        this.memberSearch = '';
      },
      error: () => {
        this.addingUserId = null;
      },
    });
  }

  createChannel(): void {
    const trimmedName = this.newChannelName.trim();
    if (!trimmedName) {
      this.error = 'Channel name is required.';
      return;
    }
    if (!this.currentUserId) {
      this.error = 'User session not found. Please re-login.';
      return;
    }
    this.loading = true;
    this.error = '';
    const nonSimpleIds = this.allUsers
      .filter((u) => this.isVoiceBureauRole(u.role))
      .map((u) => this.userIdOf(u))
      .filter((id) => !!id);
    const memberIds = [...new Set([this.currentUserId, ...this.selectedMemberIds])];
    this.channelService
      .create(
        { name: trimmedName, isPrivate: this.newChannelPrivate, memberIds: [...new Set([this.currentUserId, ...nonSimpleIds, ...memberIds])] },
        this.currentUserId,
        this.currentUserRole,
      )
      .pipe(
        catchError((err) => {
          const apiMessage =
            err?.error?.message ||
            err?.error ||
            `Create channel failed (HTTP ${err?.status ?? 'unknown'})`;
          this.error = typeof apiMessage === 'string' ? apiMessage : 'Create channel failed.';
          this.loading = false;
          console.error('[voice2] createChannel failed', err);
          return EMPTY;
        }),
      )
      .subscribe({
        next: (channel) => {
          console.log('[voice2] createChannel success', channel);
          this.channels.push(channel);
          this.view = 'list';
          this.newChannelName = '';
          this.newChannelPrivate = false;
          this.selectedMemberIds = [];
          this.loading = false;
        },
      });
  }

  goBack(): void {
    sessionStorage.removeItem('selectedVoice2ChannelId');
    this.stopAudioHistoryPoll();
    if (this.isRecording) {
      this.isRecording = false;
      this.voiceService.stopTransmitting().catch(() => {});
    }
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

  private stopAudioHistoryPoll(): void {
    if (this.audioHistoryPoll) {
      clearInterval(this.audioHistoryPoll);
      this.audioHistoryPoll = null;
    }
  }

  ngOnDestroy(): void {
    this.stopAudioHistoryPoll();
    if (this.isRecording) this.voiceService.stopTransmitting().catch(() => {});
    this.voiceService.leaveChannel();
  }
}
