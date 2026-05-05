import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { apiUrl, getVemBaseUrl } from '../../../../environments/environment';

declare var JitsiMeetExternalAPI: any;

@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-room.component.html'
})
export class MeetingRoomComponent implements OnInit {

  event: any;
  eventId!: string;

  api: any;

  // 💬 CHAT
  messages: any[] = [];

  // 🎙️ RECORDING
  mediaRecorder: any;
  audioChunks: any[] = [];
  isRecording = false;

  // ⚠️ CONSENTEMENT RECORD
  showRecordConsent = false;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('id')!;

    this.http.get(apiUrl(`/api/virtual-events/${this.eventId}`))
      .subscribe((event: any) => {
        this.event = event;
        this.initJitsi(event.meetingLink);
      });
  }

  // 🎥 JITSI
  initJitsi(link: string) {
    const roomName = link.split('/').pop();
    const domain = 'meet.jit.si';

    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: document.querySelector('#jitsi-container')
    };

    this.api = new JitsiMeetExternalAPI(domain, options);

    // 💬 LISTEN CHAT
    this.api.addListener('incomingMessage', (msg: any) => {
      this.messages.push({
        from: msg.from,
        text: msg.message
      });
    });
  }

  // 💬 SEND MESSAGE
  sendMessage(text: string) {
    if (!text.trim()) return;

    this.api.executeCommand('sendChatMessage', text);

    this.messages.push({
      from: 'Me',
      text: text
    });
  }

  // ✅ OUVRIR MESSAGE AVANT RECORD
  askRecordConsent() {
    this.showRecordConsent = true;
  }

  // ✅ UTILISATEUR ACCEPTE
  acceptRecording() {
    this.showRecordConsent = false;
    this.startRecording();
  }

  // ❌ UTILISATEUR REFUSE
  refuseRecording() {
    this.showRecordConsent = false;
    this.leaveMeeting();
  }

  // 🎙️ START RECORD
  startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: any) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      alert('🎙️ Enregistrement démarré');

    }).catch(error => {
      console.error('Erreur microphone:', error);
      alert('Impossible d’accéder au microphone');
    });
  }

  // ⏹ STOP RECORD
  stopRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.stop();

    this.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.createRecord(audioBlob);
    };

    this.isRecording = false;
  }

  // 📡 CREATE RECORD
  createRecord(audioBlob: Blob) {
    const payload = {
      fileUrl: 'temp',
      gdprConsent: true,
      virtualEvent: { id: this.eventId }
    };

    this.http.post<any>(apiUrl('/api/records'), payload)
      .subscribe(record => {
        this.sendToTranscription(record.id, audioBlob);
      });
  }

  // 🧠 SEND TO WHISPER
  sendToTranscription(recordId: string, audioBlob: Blob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    this.http.post(
      apiUrl(`/api/transcriptions/${recordId}?language=auto`),
      formData
    ).subscribe(() => {
      alert('🧠 Transcription terminée !');
    });
  }

  // 🚪 QUITTER MEETING
  leaveMeeting() {
    if (this.api) {
      this.api.dispose();
    }

    this.router.navigate(['/ameni/events']);
  }
}