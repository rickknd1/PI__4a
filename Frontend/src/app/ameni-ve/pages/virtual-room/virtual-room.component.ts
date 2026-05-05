import {
  Component, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getVemBaseUrl } from '../../../../environments/environment';

interface AvatarData { id: string; name: string; color: string; skinColor: string; hairColor: string; }
interface PlayerState { id: string; name: string; color: string; x: number; y: number; z: number; rotY: number; }
interface ChatMessage  { roomId: string; user: string; message: string; timestamp?: number; visible?: boolean; senderId?: string; }

// Bulle 3D au-dessus d'un avatar
interface ChatBubble3D {
  sprite: THREE.Sprite;
  expiresAt: number;        // timestamp de disparition
  userId: string;
}
interface SignalMessage { type: 'offer'|'answer'|'candidate'|'join'|'leave'; from: string; to?: string; payload?: any; }

@Component({
  selector: 'app-virtual-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './virtual-room.component.html',
  styleUrls: ['./virtual-room.component.css']
})
export class VirtualRoomComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer', { static: true }) container!: ElementRef;
  @ViewChild('chatBox') chatBox!: ElementRef;

  // Three.js
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  myAvatar!: THREE.Group;
  clock = new THREE.Clock();
  otherAvatars = new Map<string, THREE.Group>();

  // Contrôles
  keys: Record<string, boolean> = {};
  myId = 'user_' + Math.random().toString(36).substr(2, 9);
  avatarData!: AvatarData;

  // WebSocket
  stompClient!: Client;
  posSubscription?: StompSubscription;
  chatSubscription?: StompSubscription;
  signalSubscription?: StompSubscription;

  // Chat
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  chatOpen = true;
  connected = false;
  roomId = 'room_main';

  // Bulles 3D flottantes au-dessus des avatars
  chatBubbles = new Map<string, ChatBubble3D>(); // userId -> bulle active
  readonly BUBBLE_DURATION = 30000; // 30 secondes

  // Voix WebRTC
  micActive = false;
  localStream?: MediaStream;
  peerConnections = new Map<string, RTCPeerConnection>();
  speakingUsers = new Set<string>();
  rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  constructor(private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.avatarData = JSON.parse(localStorage.getItem('avatar') || '{}');
    if (!this.avatarData.id) {
      this.avatarData = { id: 'default', name: 'Guest', color: '#4f8ef7', skinColor: '#FDBCB4', hairColor: '#3d2b1f' };
    }
    const fromEvent = localStorage.getItem('roomId');
    if (fromEvent?.trim()) {
      this.roomId = fromEvent.trim();
    }
    this.initScene();
    this.initControls();
    this.connectWebSocket();
    this.ngZone.runOutsideAngular(() => this.animate());
  }

  // ─── SCÈNE ──────────────────────────────────────────────────────────────────

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 15, 40);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 4, 8);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.nativeElement.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 5); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048); this.scene.add(dir);
    const p1 = new THREE.PointLight(0x5533ff, 1.5, 15); p1.position.set(-5, 3, -5); this.scene.add(p1);
    const p2 = new THREE.PointLight(0xff3366, 1, 12); p2.position.set(5, 3, -3); this.scene.add(p2);

    this.buildRoom();
    this.buildFurniture();

    this.myAvatar = this.createHumanAvatar(this.avatarData.color || '#4f8ef7');
    this.myAvatar.position.set(0, 0, 2);
    this.scene.add(this.myAvatar);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildRoom() {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x16213e, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 16), wallMat);
    room.position.set(0, 3, 0); this.scene.add(room);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 16), new THREE.MeshLambertMaterial({ map: this.createFloorTexture() }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.5), new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 }));
    win.position.set(-9.9, 3, -2); win.rotation.y = Math.PI / 2; this.scene.add(win);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshBasicMaterial({ color: 0x0d1117 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 5.99; this.scene.add(ceil);

    [0x4444ff, 0xff44aa, 0x44ffaa].forEach((c, i) => {
      const led = new THREE.Mesh(new THREE.BoxGeometry(18, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: c }));
      led.position.set(0, 5.9, -4 + i * 4); this.scene.add(led);
    });
  }

  buildFurniture() {
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.12, 32), new THREE.MeshLambertMaterial({ color: 0x8B6914 }));
    tt.position.set(0, 0.86, 0); tt.castShadow = true; this.scene.add(tt);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 0.85, 16), new THREE.MeshLambertMaterial({ color: 0x5a4010 }));
    tl.position.set(0, 0.42, 0); this.scene.add(tl);

    const sb = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.08), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    sb.position.set(0, 2.5, -6.5); this.scene.add(sb);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.0), new THREE.MeshBasicMaterial({ color: 0x1a3a6a }));
    sc.position.set(0, 2.5, -6.44); this.scene.add(sc);
    [0x4488ff, 0xff6644, 0x44ff88].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.01), new THREE.MeshBasicMaterial({ color: c }));
      b.position.set(-0.9 + i * 0.9, 2.65, -6.43); this.scene.add(b);
    });
    const ss = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), new THREE.MeshLambertMaterial({ color: 0x444444 }));
    ss.position.set(0, 1.5, -6.5); this.scene.add(ss);

    [{ x: -3, z: 1.5, ry: 0.4 }, { x: -1.5, z: 3, ry: 0 }, { x: 1.5, z: 3, ry: -0.2 },
     { x: 3, z: 1, ry: -0.5 }, { x: 3, z: -1.5, ry: -1 }, { x: -3, z: -1.5, ry: 1 }]
      .forEach(p => this.scene.add(this.createChair(p.x, p.z, p.ry)));

    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    kb.position.set(-1.5, 0.93, 0.5); this.scene.add(kb);
  }

  createChair(x: number, z: number, rotY: number): THREE.Group {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: 0x2a6090 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), m); seat.position.y = 0.5; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), m); back.position.set(0, 0.9, -0.37); g.add(back);
    [[-0.35,-0.35],[-0.35,0.35],[0.35,-0.35],[0.35,0.35]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), m);
      leg.position.set(lx, 0.25, lz); g.add(leg);
    });
    g.position.set(x, 0, z); g.rotation.y = rotY; return g;
  }

  createHumanAvatar(color: string): THREE.Group {
    const g = new THREE.Group();
    const bm = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    const sm = new THREE.MeshLambertMaterial({ color: 0xFFCBA4 });
    const hm = new THREE.MeshLambertMaterial({ color: 0x3d2b1f });
    const lm = new THREE.MeshLambertMaterial({ color: 0x1a1a3e });
    const fm = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const em = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.28), bm); torso.position.y = 1.25; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), sm); head.position.y = 1.82; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 8, 0, Math.PI*2, 0, Math.PI*0.55), hm); hair.position.y = 1.86; g.add(hair);
    [-0.08, 0.08].forEach(ex => { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03,8,8), em); eye.position.set(ex, 1.84, 0.2); g.add(eye); });
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 8), sm); neck.position.y = 1.59; g.add(neck);
    const lA = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), bm); lA.position.set(-0.38, 1.2, 0); lA.rotation.z = 0.15; g.add(lA);
    const rA = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), bm); rA.position.set(0.38, 1.2, 0); rA.rotation.z = -0.15; g.add(rA);
    [[-0.41,0.92],[0.41,0.92]].forEach(([hx,hy]) => { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8), sm); hand.position.set(hx,hy,0); g.add(hand); });
    const lL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), lm); lL.position.set(-0.16, 0.58, 0); g.add(lL);
    const rL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), lm); rL.position.set(0.16, 0.58, 0); g.add(rL);
    [[-0.16,0.07],[0.16,0.07]].forEach(([fx,fz]) => { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.08,0.22), fm); foot.position.set(fx, 0.04, (fz as number)+0.04); g.add(foot); });
    const label = this.createNameLabel(this.avatarData.name || 'Guest'); label.position.y = 2.2; g.add(label);
    return g;
  }

  createNameLabel(name: string): THREE.Sprite {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.roundRect(4,4,248,56,12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'; ctx.fillText(name, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(1.2, 0.3, 1); return sp;
  }

  createFloorTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a0f0a'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#2a1f1a'; ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4,3); return tex;
  }

  // ─── CONTRÔLES ──────────────────────────────────────────────────────────────

  private _kd = (e: KeyboardEvent) => { this.keys[e.key] = true; };
  private _ku = (e: KeyboardEvent) => { delete this.keys[e.key]; };

  initControls() {
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup',   this._ku);
  }

  movePlayer() {
    const speed = 0.07; let moved = false;
    if (this.keys['z']||this.keys['w']||this.keys['ArrowUp'])    { this.myAvatar.position.z -= speed; moved = true; }
    if (this.keys['s']||this.keys['ArrowDown'])                   { this.myAvatar.position.z += speed; moved = true; }
    if (this.keys['q']||this.keys['a']||this.keys['ArrowLeft'])   { this.myAvatar.position.x -= speed; this.myAvatar.rotation.y = Math.PI/2; moved = true; }
    if (this.keys['d']||this.keys['ArrowRight'])                  { this.myAvatar.position.x += speed; this.myAvatar.rotation.y = -Math.PI/2; moved = true; }
    this.myAvatar.position.x = Math.max(-9, Math.min(9, this.myAvatar.position.x));
    this.myAvatar.position.z = Math.max(-7, Math.min(7, this.myAvatar.position.z));
    if (moved) {
      const t = this.clock.getElapsedTime() * 6;
      const lA = this.myAvatar.children[7] as THREE.Mesh;
      const rA = this.myAvatar.children[8] as THREE.Mesh;
      if (lA) lA.rotation.x = Math.sin(t) * 0.4;
      if (rA) rA.rotation.x = -Math.sin(t) * 0.4;
    }
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this.myAvatar.position.x, 0.08);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this.myAvatar.position.z + 8, 0.08);
    this.camera.lookAt(this.myAvatar.position.x, 1.5, this.myAvatar.position.z);
    if (this.connected && moved) this.sendPosition();
  }

  // ─── WEBSOCKET ──────────────────────────────────────────────────────────────

  connectWebSocket() {
    this.stompClient = new Client({
      webSocketFactory: () =>
        new SockJS(`${getVemBaseUrl().replace(/\/$/, '')}/ws`),
      reconnectDelay: 5000,

      onConnect: () => {
        this.ngZone.run(() => { this.connected = true; this.cdr.detectChanges(); });

        // Positions
        this.posSubscription = this.stompClient.subscribe('/topic/positions', (msg) => {
          const state: PlayerState = JSON.parse(msg.body);
          if (state.id !== this.myId) this.updateOtherAvatar(state);
        });

        // ── CHAT FIX : ngZone.run() déclenche la détection Angular ──
        this.chatSubscription = this.stompClient.subscribe('/topic/messages', (msg) => {
          this.ngZone.run(() => {
            const cm: ChatMessage = JSON.parse(msg.body);
            cm.timestamp = Date.now();
            cm.visible = true;
            this.chatMessages.push(cm);
            if (this.chatMessages.length > 100) this.chatMessages.shift();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollChatToBottom(), 30);

            // Afficher bulle 3D au-dessus de l'avatar émetteur
            this.showChatBubble3D(cm.senderId || '', cm.user, cm.message);

            // Masquer le message du panel après 30s
            const idx = this.chatMessages.indexOf(cm);
            setTimeout(() => {
              this.ngZone.run(() => {
                cm.visible = false;
                this.cdr.detectChanges();
              });
            }, this.BUBBLE_DURATION);
          });
        });

        // Signaling WebRTC (canal personnel)
        this.signalSubscription = this.stompClient.subscribe(
          `/topic/signal/${this.myId}`, (msg) => {
            const signal: SignalMessage = JSON.parse(msg.body);
            this.handleSignal(signal);
          }
        );

        // Canal broadcast (join/leave)
        this.stompClient.subscribe('/topic/signal/broadcast', (msg) => {
          const signal: SignalMessage = JSON.parse(msg.body);
          if (signal.from !== this.myId) this.handleSignal(signal);
        });

        this.sendPosition();
        // Annoncer sa présence pour WebRTC
        this.broadcastSignal({ type: 'join', from: this.myId });
      },

      onDisconnect: () => {
        this.ngZone.run(() => { this.connected = false; this.cdr.detectChanges(); });
      }
    });

    this.stompClient.activate();
  }

  sendPosition() {
    if (!this.stompClient?.connected) return;
    this.stompClient.publish({
      destination: '/app/position',
      body: JSON.stringify({
        id: this.myId, name: this.avatarData.name || 'Guest',
        color: this.avatarData.color || '#4f8ef7',
        x: this.myAvatar.position.x, y: this.myAvatar.position.y,
        z: this.myAvatar.position.z, rotY: this.myAvatar.rotation.y
      } as PlayerState)
    });
  }

  updateOtherAvatar(state: PlayerState) {
    if (!this.otherAvatars.has(state.id)) {
      const av = this.createHumanAvatar(state.color);
      this.scene.add(av);
      this.otherAvatars.set(state.id, av);
    }
    const av = this.otherAvatars.get(state.id)!;
    av.position.x = THREE.MathUtils.lerp(av.position.x, state.x, 0.15);
    av.position.z = THREE.MathUtils.lerp(av.position.z, state.z, 0.15);
    av.rotation.y = state.rotY;
  }

  // ─── CHAT ───────────────────────────────────────────────────────────────────

  sendChat() {
    if (!this.chatInput.trim() || !this.connected) return;
    this.stompClient.publish({
      destination: '/app/chat',
      body: JSON.stringify({
        roomId: this.roomId,
        user: this.avatarData.name || 'Guest',
        message: this.chatInput.trim(),
        senderId: this.myId          // ← pour identifier l'émetteur
      } as ChatMessage)
    });
    this.chatInput = '';
  }

  onChatKeydown(e: KeyboardEvent) {
    e.stopPropagation(); // Empêche ZQSD d'être capté par les contrôles
    if (e.key === 'Enter') this.sendChat();
  }

  scrollChatToBottom() {
    if (this.chatBox?.nativeElement) {
      this.chatBox.nativeElement.scrollTop = this.chatBox.nativeElement.scrollHeight;
    }
  }

  // ─── VOIX — WebRTC ──────────────────────────────────────────────────────────

  async toggleMic() {
    this.micActive ? this.stopMic() : await this.startMic();
  }

  async startMic() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micActive = true;
      this.cdr.detectChanges();
      // Connecter avec les peers existants
      this.otherAvatars.forEach((_, peerId) => this.createPeerConnection(peerId, true));
    } catch (err) {
      console.error('Micro refusé:', err);
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions navigateur.');
    }
  }

  stopMic() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = undefined;
    this.micActive = false;
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.speakingUsers.clear();
    this.cdr.detectChanges();
  }

  async createPeerConnection(peerId: string, isInitiator: boolean) {
    if (this.peerConnections.has(peerId)) return;
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // Ajouter pistes audio locales
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream!));
    }

    // Recevoir audio distant
    pc.ontrack = (ev) => {
      this.ngZone.run(() => {
        document.getElementById(`audio-${peerId}`)?.remove();
        const audio = document.createElement('audio');
        audio.id = `audio-${peerId}`;
        audio.srcObject = ev.streams[0];
        audio.autoplay = true;
        document.body.appendChild(audio);
        this.detectSpeaking(peerId, ev.streams[0]);
      });
    };

    // ICE candidates → signaling
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.sendSignal({ type: 'candidate', from: this.myId, to: peerId, payload: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close(); this.peerConnections.delete(peerId);
        document.getElementById(`audio-${peerId}`)?.remove();
        this.speakingUsers.delete(peerId);
      }
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ type: 'offer', from: this.myId, to: peerId, payload: offer });
    }
  }

  // Visualisation de parole sur l'avatar (anneau vert)
  detectSpeaking(peerId: string, stream: MediaStream) {
    try {
      const ctx  = new AudioContext();
      const src  = ctx.createMediaStreamSource(stream);
      const ana  = ctx.createAnalyser(); ana.fftSize = 256;
      src.connect(ana);
      const data = new Uint8Array(ana.frequencyBinCount);
      const check = () => {
        ana.getByteFrequencyData(data);
        const avg = data.reduce((a,b) => a+b, 0) / data.length;
        const isSpeaking = avg > 15;
        if (isSpeaking) this.speakingUsers.add(peerId);
        else            this.speakingUsers.delete(peerId);
        this.updateSpeakingRing(peerId, isSpeaking);
        requestAnimationFrame(check);
      };
      check();
    } catch(_) {}
  }

  updateSpeakingRing(peerId: string, on: boolean) {
    const av = this.otherAvatars.get(peerId); if (!av) return;
    const existing = av.getObjectByName('speaking-ring');
    if (on && !existing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.03, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0x44ff88 })
      );
      ring.name = 'speaking-ring'; ring.position.y = 1.82; ring.rotation.x = Math.PI/2;
      av.add(ring);
    } else if (!on && existing) {
      av.remove(existing);
    }
  }

  async handleSignal(signal: SignalMessage) {
    switch (signal.type) {
      case 'join':
        if (this.micActive) await this.createPeerConnection(signal.from, true);
        break;
      case 'offer': {
        await this.createPeerConnection(signal.from, false);
        const pc = this.peerConnections.get(signal.from)!;
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({ type: 'answer', from: this.myId, to: signal.from, payload: answer });
        break;
      }
      case 'answer': {
        const pc = this.peerConnections.get(signal.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        break;
      }
      case 'candidate': {
        const pc = this.peerConnections.get(signal.from);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
        break;
      }
      case 'leave':
        this.peerConnections.get(signal.from)?.close();
        this.peerConnections.delete(signal.from);
        document.getElementById(`audio-${signal.from}`)?.remove();
        this.speakingUsers.delete(signal.from);
        break;
    }
  }

  sendSignal(signal: SignalMessage) {
    if (!this.stompClient?.connected || !signal.to) return;
    this.stompClient.publish({ destination: `/app/signal/${signal.to}`, body: JSON.stringify(signal) });
  }

  broadcastSignal(signal: SignalMessage) {
    if (!this.stompClient?.connected) return;
    this.stompClient.publish({ destination: '/app/signal/broadcast', body: JSON.stringify(signal) });
  }

  // ─── BULLES 3D ──────────────────────────────────────────────────────────────

  showChatBubble3D(senderId: string, userName: string, message: string) {
    // Trouver l'avatar cible (myAvatar si c'est moi, sinon otherAvatars)
    const isMe = senderId === this.myId;
    const targetAvatar = isMe ? this.myAvatar : this.otherAvatars.get(senderId);
    if (!targetAvatar && !isMe) return;
    const avatar = targetAvatar || this.myAvatar;

    // Supprimer ancienne bulle de cet user
    const existing = this.chatBubbles.get(senderId || 'me');
    if (existing) {
      avatar.remove(existing.sprite);
      existing.sprite.material.map?.dispose();
      existing.sprite.material.dispose();
    }

    // Créer la texture canvas de la bulle
    const sprite = this.createBubbleSprite(userName, message);
    sprite.position.set(0, 2.6, 0); // au-dessus du label nom
    avatar.add(sprite);

    const bubble: ChatBubble3D = {
      sprite,
      expiresAt: Date.now() + this.BUBBLE_DURATION,
      userId: senderId || 'me'
    };
    this.chatBubbles.set(senderId || 'me', bubble);

    // Auto-suppression après 30s
    setTimeout(() => {
      this.removeChatBubble3D(senderId || 'me', avatar);
    }, this.BUBBLE_DURATION);
  }

  createBubbleSprite(userName: string, message: string): THREE.Sprite {
    const maxChars = 30;
    const lines = this.wrapText(message, maxChars);
    const lineH = 28;
    const padding = 18;
    const canvasW = 380;
    const canvasH = padding * 2 + lines.length * lineH + 10;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH + 20; // +20 pour la petite flèche
    const ctx = canvas.getContext('2d')!;

    // Fond bulle arrondi
    ctx.fillStyle = 'rgba(15, 15, 40, 0.92)';
    this.roundRect2D(ctx, 0, 0, canvasW, canvasH, 16);
    ctx.fill();

    // Bordure colorée
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.8)';
    ctx.lineWidth = 2.5;
    this.roundRect2D(ctx, 0, 0, canvasW, canvasH, 16);
    ctx.stroke();

    // Petite flèche en bas
    ctx.fillStyle = 'rgba(15, 15, 40, 0.92)';
    ctx.beginPath();
    ctx.moveTo(canvasW / 2 - 12, canvasH);
    ctx.lineTo(canvasW / 2, canvasH + 18);
    ctx.lineTo(canvasW / 2 + 12, canvasH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nom de l'utilisateur
    ctx.fillStyle = '#8899ff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(userName, padding, padding + 16);

    // Texte du message (multi-lignes)
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    lines.forEach((line, i) => {
      ctx.fillText(line, padding, padding + 16 + 24 + i * lineH);
    });

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);

    // Taille proportionnelle au canvas
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(aspect * 0.9, 0.9, 1);
    sprite.renderOrder = 999; // toujours visible au-dessus
    return sprite;
  }

  wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current) lines.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    if (current) lines.push(current.trim());
    return lines.slice(0, 4); // max 4 lignes
  }

  roundRect2D(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  removeChatBubble3D(userId: string, avatar: THREE.Group) {
    const bubble = this.chatBubbles.get(userId);
    if (!bubble) return;
    avatar.remove(bubble.sprite);
    bubble.sprite.material.map?.dispose();
    bubble.sprite.material.dispose();
    this.chatBubbles.delete(userId);
  }

  // ─── BOUCLE ─────────────────────────────────────────────────────────────────

  animate() {
    requestAnimationFrame(() => this.animate());
    this.movePlayer();
    this.renderer.render(this.scene, this.camera);
  }

  ngOnDestroy() {
    this.stopMic();
    if (this.connected) this.broadcastSignal({ type: 'leave', from: this.myId });
    this.stompClient?.deactivate();
    this.renderer?.dispose();
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup',   this._ku);
  }
}