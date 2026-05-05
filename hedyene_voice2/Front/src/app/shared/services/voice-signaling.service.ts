import { Injectable } from '@angular/core';

interface PeerState {
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
  audioEl?: HTMLAudioElement; // only on inbound (listener) side
}

@Injectable({ providedIn: 'root' })
export class VoiceSignalingService {

  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];

  private channelId = '';
  private userId = '';
  private userName = '';
  private isTransmitting = false;
  private speakerNames = new Map<string, string>(); // fromUserId → displayName

  // Users currently connected to the channel's signaling WS
  private connectedUsers = new Set<string>();

  // inbound: remote speaker sent us an offer → we listen to them
  private inboundPeers = new Map<string, PeerState>();
  // outbound: we sent an offer → they listen to us
  private outboundPeers = new Map<string, PeerState>();

  private readonly iceConfig: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  get isConnected(): boolean { return this.ws !== null; }
  get isRecording(): boolean { return this.isTransmitting; }

  /** Call when entering a channel — joins signaling passively (no mic). */
  joinChannel(channelId: string, userId: string, userName = ''): void {
    if (this.ws) this.leaveChannel(); // clean up any previous session

    this.channelId = channelId;
    this.userId = userId;
    this.userName = userName;
    this.connectedUsers.clear();
    this.speakerNames.clear();

    this.ws = new WebSocket('ws://localhost:8080/ws/voice');

    this.ws.onopen = () => {
      this.send({ type: 'JOIN', channelId, fromUserId: userId });
    };

    this.ws.onmessage = (evt) => {
      try { this.handleMessage(JSON.parse(evt.data)); }
      catch (e) { console.error('WS parse error', e); }
    };

    this.ws.onerror = (e) => console.error('Voice WS error', e);
    this.ws.onclose = () => {
      this.closeAllPeers();
    };
  }

  /** Call when leaving the channel detail view. */
  leaveChannel(): void {
    if (this.isTransmitting) {
      this.stopMic();
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'LEAVE', channelId: this.channelId, fromUserId: this.userId });
    }
    this.ws?.close();
    this.ws = null;
    this.closeAllPeers();
    this.connectedUsers.clear();
  }

  /** Start capturing mic and transmitting to all connected users. */
  async startTransmitting(): Promise<void> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.isTransmitting = true;
    this.audioChunks = [];

    this.mediaRecorder = new MediaRecorder(this.localStream);
    this.mediaRecorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) this.audioChunks.push(evt.data);
    };
    this.mediaRecorder.start(100);

    // Push audio to every user already in the channel
    for (const peerId of this.connectedUsers) {
      this.createOutboundOffer(peerId);
    }
  }

  /** Stop mic, close outbound connections, return recorded blob. */
  stopTransmitting(): Promise<Blob | null> {
    this.isTransmitting = false;

    // Close outbound peers (stop sending our audio)
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
        const blob = this.audioChunks.length > 0
          ? new Blob(this.audioChunks, { type: mimeType })
          : null;
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

  // ─── Private helpers ───────────────────────────────────────────────────────

  private stopMic(): void {
    this.localStream?.getTracks().forEach(t => t.stop());
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
        // List of users already in the channel
        (msg.data as string[]).forEach(id => this.connectedUsers.add(id));
        break;

      case 'JOINED':
        if (msg.fromUserId !== this.userId) {
          this.connectedUsers.add(msg.fromUserId);
          // If we are transmitting, push our audio to the new joiner
          if (this.isTransmitting) {
            this.createOutboundOffer(msg.fromUserId);
          }
        }
        break;

      case 'LEFT':
        this.connectedUsers.delete(msg.fromUserId);
        this.speakerNames.delete(msg.fromUserId);
        this.closeInboundPeer(msg.fromUserId);
        this.closeOutboundPeer(msg.fromUserId);
        break;

      case 'OFFER':
        // A speaker is sending us their audio
        if (!msg.targetUserId || msg.targetUserId === this.userId) {
          this.handleInboundOffer(msg.fromUserId, msg.fromUserName ?? msg.fromUserId, msg.data);
        }
        break;

      case 'ANSWER':
        // A listener answered our outbound offer
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

  // Speaker creates outbound offer to a listener
  private async createOutboundOffer(peerId: string): Promise<void> {
    if (this.outboundPeers.has(peerId) || !this.localStream) return;

    const pc = new RTCPeerConnection(this.iceConfig);
    this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.send({
          type: 'ICE', channelId: this.channelId,
          fromUserId: this.userId, targetUserId: peerId,
          data: evt.candidate.toJSON()
        });
      }
    };

    const state: PeerState = { pc, pendingCandidates: [] };
    this.outboundPeers.set(peerId, state);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.send({
      type: 'OFFER', channelId: this.channelId,
      fromUserId: this.userId, fromUserName: this.userName,
      targetUserId: peerId,
      data: { type: offer.type, sdp: offer.sdp }
    });
  }

  // Listener receives inbound offer from a speaker → auto-answer, play audio
  private async handleInboundOffer(fromId: string, fromName: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.speakerNames.set(fromId, fromName);
    // Close any existing inbound connection from this speaker (re-connect)
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
          type: 'ICE', channelId: this.channelId,
          fromUserId: this.userId, targetUserId: fromId,
          data: evt.candidate.toJSON()
        });
      }
    };

    const state: PeerState = { pc, pendingCandidates: [], audioEl };
    this.inboundPeers.set(fromId, state);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (const c of state.pendingCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    }
    state.pendingCandidates = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.send({
      type: 'ANSWER', channelId: this.channelId,
      fromUserId: this.userId, targetUserId: fromId,
      data: { type: answer.type, sdp: answer.sdp }
    });
  }

  private async handleOutboundAnswer(fromId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const state = this.outboundPeers.get(fromId);
    if (!state) return;
    await state.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (const c of state.pendingCandidates) {
      await state.pc.addIceCandidate(new RTCIceCandidate(c));
    }
    state.pendingCandidates = [];
  }

  private async handleIce(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
    // Check inbound first, then outbound
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
    if (state.audioEl) { state.audioEl.srcObject = null; state.audioEl.remove(); }
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
    this.inboundPeers.forEach((s) => {
      s.pc.close();
      if (s.audioEl) { s.audioEl.srcObject = null; s.audioEl.remove(); }
    });
    this.inboundPeers.clear();
    this.outboundPeers.forEach((s) => s.pc.close());
    this.outboundPeers.clear();
  }
}
