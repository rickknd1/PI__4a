import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../models/treasury.models';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuthService } from '../../../shared/services/auth.service';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent implements OnInit {
  messages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis l\'assistant IA Tresorerie de ClubHub (Gemini AI). Posez-moi vos questions sur les cotisations, depenses, budgets, predictions ou anomalies.',
      timestamp: new Date()
    }
  ];
  input = '';
  loading = false;
  clubId: number | string = 1;
  aiAvailable = false;

  suggestions = [
    'Quel est le taux de recouvrement ?',
    'Quels membres sont en retard ?',
    'Quel est l\'etat du budget ?',
    'Y a-t-il des anomalies ?',
    'Predictions pour les 3 prochains mois ?',
    'Combien de depenses en attente ?'
  ];

  constructor(private api: TreasuryApiService, private auth: AuthService) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.api.getAiStatus(this.clubId).subscribe({
      next: (status: any) => { this.aiAvailable = status.aiAvailable ?? status.geminiAvailable ?? true; },
      error: () => { this.aiAvailable = false; }
    });
  }

  send(text?: string) {
    const message = (text || this.input).trim();
    if (!message) return;
    this.messages.push({ role: 'user', content: message, timestamp: new Date() });
    this.input = '';
    this.loading = true;

    this.api.chatAi(this.clubId, message).subscribe({
      next: (response) => {
        this.messages.push({ role: 'assistant', content: response.reply, timestamp: new Date() });
        this.loading = false;
      },
      error: () => {
        this.messages.push({ role: 'assistant', content: this.getFallback(message.toLowerCase()), timestamp: new Date() });
        this.loading = false;
      }
    });
  }

  onEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  private getFallback(text: string): string {
    if (text.includes('taux') || text.includes('recouvrement'))
      return 'Le taux de recouvrement est affiche sur le Dashboard. Il represente le % des cotisations payees vs total attendu. [Fallback local]';
    if (text.includes('retard'))
      return 'Consultez la page Cotisations > onglet Paiements et filtrez par statut LATE pour voir les membres en retard. [Fallback local]';
    if (text.includes('budget'))
      return 'Le budget est suivi en temps reel dans la section Budget avec des alertes a 50%, 75%, 90% et 100%. [Fallback local]';
    if (text.includes('anomalie'))
      return 'Consultez la page Detection d\'Anomalies pour voir les transactions suspectes detectees par Z-Score. [Fallback local]';
    if (text.includes('prediction'))
      return 'Les predictions sont disponibles dans la page Predictions IA, basees sur regression lineaire + Gemini. [Fallback local]';
    return 'Je suis l\'assistant tresorerie de ClubHub. Posez-moi une question sur les cotisations, depenses, budget ou rapports. [Fallback - backend non disponible]';
  }
}
