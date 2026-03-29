import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../models/treasury.models';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent {
  messages: ChatMessage[] = [
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis l\'assistant IA de trésorerie ClubHub. Posez-moi des questions en langage naturel : "Quel est le taux de recouvrement ?", "Quels membres sont en retard ?", "Quel est le solde du budget ?"',
      timestamp: new Date()
    }
  ];
  input = '';
  loading = false;

  // Simulated responses (Gemini API integration pending)
  private responses: Record<string, string> = {
    'taux': 'Le taux de recouvrement actuel est de **83.3%**. 34 membres sont à jour sur 41 membres actifs.',
    'retard': '7 membres sont en retard de paiement :\n- Ali Ben Salah (120 TND, depuis 30j)\n- Omar Mansouri (120 TND, depuis 15j)\n- ...et 5 autres. Total en retard : 840 TND.',
    'budget': 'Le budget annuel 2025/2026 est consommé à **62%** (3 100 TND sur 5 000 TND). Reste 1 900 TND.',
    'depenses': 'Ce mois : 3 dépenses soumises, 1 approuvée (95 TND — restauration). 2 en attente de validation.',
    'stripe': 'Stripe est configuré en mode test. Aucun paiement réel n\'a encore été traité.',
  };

  send() {
    const text = this.input.trim();
    if (!text) return;
    this.messages.push({ role: 'user', content: text, timestamp: new Date() });
    this.input = '';
    this.loading = true;

    setTimeout(() => {
      const reply = this.getReply(text.toLowerCase());
      this.messages.push({ role: 'assistant', content: reply, timestamp: new Date() });
      this.loading = false;
    }, 800);
  }

  onEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  private getReply(text: string): string {
    for (const [key, val] of Object.entries(this.responses)) {
      if (text.includes(key)) return val;
    }
    return 'Je n\'ai pas encore de réponse précise pour cette question. L\'intégration Gemini API permettra de répondre à toutes vos requêtes financières en langage naturel.';
  }
}
