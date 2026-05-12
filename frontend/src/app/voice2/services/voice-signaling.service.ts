import { Injectable } from '@angular/core';
import { getGatewayBase } from '../../../environments/environment';

interface PeerState {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
  audioEl?: HTMLAudioElement;
}

@Injectable({ providedIn: 'root' })
export class Voice2VoiceSignalingService {
  private getWsBase(): string {
    const gateway = getGatewayBase().replace(/\/$/, '');
    return gateway.startsWith('https://')
      ? gateway.replace('https://', 'wss://')
      : gateway.replace('http://', 'ws://');
  }

  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];

  private channelId = '';
  private userId = '';
  private userName = '';
  private isTransmitting = false;
  private speakerNames = new Map<string, string>();
  private connectedUsers = new Set<string>();

  private inboundPeers = new Map<string, PeerState>();
  private outboundPeers = new Map<string, PeerState>();

  private readonly iceConfig: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  get isConnected(): boolean {
    return this.ws !== null;
  }

  get isRecording(): boolean {
    return this.isTransmitting;
  }

  joinChannel(channelId: string, userId: string, userName = ''): void {
    if (this.ws) this.leaveChannel();
    this.channelId = channelId;
    this.userId = userId;
    this.userName = userName;
    this.connectedUsers.clear();
    this.speakerNames.clear();

    this.ws = new WebSocket(`${this.getWsBase()}/ws/voice2/voice`);

    this.ws.onopen = () => {
      this.send({ type: 'JOIN', channelId, fromUserId: userId });
    };

    this.ws.onmessage = (evt) => {
      try {
        this.handleMessage(JSON.parse(evt.data));
      } catch (e) {
        console.error('Voice WS parse error', e);
      }
    };

    this.ws.onerror = (e) => console.error('Voice WS error', e);
    this.ws.onclose = () => this.closeAllPeers();
  }

  leaveChannel(): void {
    if (this.isTransmitting) this.stopMic();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'LEAVE', channelId: this.channelId, fromUserId: this.userId });
    }
    this.ws?.close();
    this.ws = null;
    this.closeAllPeers();
    this.connectedUsers.clear();
  }

  async startTransmitting(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.isTransmitting = true;
    this.audioChunks = [];

    this.mediaRecorder = new MediaRecorder(this.localStream);
    this.mediaRecorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) this.audioChunks.push(evt.data);
    };
    this.mediaRecorder.start(100);

    for (const peerId of this.connectedUsers) {
      this.createOutboundOffer(peerId);
    }
  }

  stopTransmitting(): Promise<Blob | null> {
    this.isTransmitting = false;
    this.outboundPeers.forEach((state) => state.pc.close());
    this.outboundPeers.clear();

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.stopMic();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = this.audioChunks.length > 0 ? new Blob(this.audioChunks, { type: mimeType }) : null;
        this.audioChunks = [];
        this.stopMic();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  get listenerCount(): number {
    return this.outboundPeers.size;
  }

  get currentSpeakers(): string[] {
    return Array.from(this.speakerNames.values());
  }

  private stopMic(): void {
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.mediaRecorder = null;
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: any): void {
    switch (msg.type as string) {
      case 'PEERS':
        (msg.data as string[]).forEach((id) => this.connectedUsers.add(id));
        break;
      case 'JOINED':
        if (msg.fromUserId !== this.userId) {
          this.connectedUsers.add(msg.fromUserId);
          if (this.isTransmitting) this.createOutboundOffer(msg.fromUserId);
        }
        break;
      case 'LEFT':
        this.connectedUsers.delete(msg.fromUserId);
        this.speakerNames.delete(msg.fromUserId);
        this.closeInboundPeer(msg.fromUserId);
        this.closeOutboundPeer(msg.fromUserId);
        break;
      case 'OFFER':
        if (!msg.targetUserId || msg.targetUserId === this.userId) {
          this.handleInboundOffer(msg.fromUserId, msg.fromUserName ?? msg.fromUserId, msg.data);
        }
        break;
      case 'ANSWER':
        if (!msg.targetUserId || msg.targetUserId === this.userId) {
          this.handleOutboundAnswer(msg.fromUserId, msg.data);
        }
        break;
      case 'ICE':
        if (!msg.targetUserId || msg.targetUserId === this.userId) {
          this.handleIce(msg.fromUserId, msg.data);
        }
        break;
    }
  }

  private async createOutboundOffer(peerId: string): Promise<void> {
    if (this.outboundPeers.has(peerId) || !this.localStream) return;

    const pc = new RTCPeerConnection(this.iceConfig);
    this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.send({
          type: 'ICE',
          channelId: this.channelId,
          fromUserId: this.userId,
          targetUserId: peerId,
          data: evt.candidate.toJSON(),
        });
      }
    };

    const state: PeerState = { pc, pendingCandidates: [] };
    this.outboundPeers.set(peerId, state);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send({
      type: 'OFFER',
      channelId: this.channelId,
      fromUserId: this.userId,
      fromUserName: this.userName,
      targetUserId: peerId,
      data: { type: offer.type, sdp: offer.sdp },
    });
  }

  private async handleInboundOffer(fromId: string, fromName: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.speakerNames.set(fromId, fromName);
    this.closeInboundPeer(fromId);

    const pc = new RTCPeerConnection(this.iceConfig);
    const audioEl = new Audio();
    audioEl.autoplay = true;

    pc.ontrack = (evt) => {
      if (evt.streams[0]) audioEl.srcObject = evt.streams[0];
    };

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.send({
          type: 'ICE',
          channelId: this.channelId,
          fromUserId: this.userId,
          targetUserId: fromId,
          data: evt.candidate.toJSON(),
        });
      }
    };

    const state: PeerState = { pc, pendingCandidates: [], audioEl };
    this.inboundPeers.set(fromId, state);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (const candidate of state.pendingCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    state.pendingCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.send({
      type: 'ANSWER',
      channelId: this.channelId,
      fromUserId: this.userId,
      targetUserId: fromId,
      data: { type: answer.type, sdp: answer.sdp },
    });
  }

  private async handleOutboundAnswer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const state = this.outboundPeers.get(fromId);
    if (!state) return;

    await state.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (const candidate of state.pendingCandidates) {
      await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    state.pendingCandidates = [];
  }

  private async handleIce(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const state = this.inboundPeers.get(fromId) ?? this.outboundPeers.get(fromId);
    if (!state) return;

    if (state.pc.remoteDescription) {
      await state.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      state.pendingCandidates.push(candidate);
    }
  }

  private closeInboundPeer(peerId: string): void {
    const state = this.inboundPeers.get(peerId);
    if (!state) return;
    state.pc.close();
    if (state.audioEl) {
      state.audioEl.srcObject = null;
      state.audioEl.remove();
    }
    this.inboundPeers.delete(peerId);
    this.speakerNames.delete(peerId);
  }

  private closeOutboundPeer(peerId: string): void {
    const state = this.outboundPeers.get(peerId);
    if (!state) return;
    state.pc.close();
    this.outboundPeers.delete(peerId);
  }

  private closeAllPeers(): void {
    this.inboundPeers.forEach((state) => {
      state.pc.close();
      if (state.audioEl) {
        state.audioEl.srcObject = null;
        state.audioEl.remove();
      }
    });
    this.inboundPeers.clear();
    this.outboundPeers.forEach((state) => state.pc.close());
    this.outboundPeers.clear();
  }
}
