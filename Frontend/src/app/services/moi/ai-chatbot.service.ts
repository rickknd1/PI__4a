import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import knowledgeBase from '../../data/election-rules-kb.json';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  questions: string[];
  answer: string;
  keywords: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiChatbotService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$: Observable<ChatMessage[]> = this.messagesSubject.asObservable();
  
  private knowledgeBase: KnowledgeItem[] = knowledgeBase.knowledge_base;
  
  constructor() {
    // Message de bienvenue
    this.addBotMessage(
      "👋 Bonjour ! Je suis votre assistant IA réglementaire.\n\n" +
      "Je peux répondre à vos questions sur :\n" +
      "• Les types d'élection (présentielle/virtuelle)\n" +
      "• Les rôles et permissions\n" +
      "• Les conditions de candidature\n" +
      "• Le processus de vote\n" +
      "• Et bien plus !\n\n" +
      "Posez-moi une question en français naturel 😊"
    );
  }

  /**
   * Envoie un message utilisateur et génère une réponse
   */
  sendMessage(userMessage: string): void {
    if (!userMessage.trim()) return;

    // Ajouter le message utilisateur
    this.addUserMessage(userMessage);

    // Générer la réponse du bot
    setTimeout(() => {
      const response = this.generateResponse(userMessage);
      this.addBotMessage(response);
    }, 500); // Petit délai pour simuler la réflexion
  }

  /**
   * Génère une réponse basée sur la question de l'utilisateur
   */
  private generateResponse(question: string): string {
    const normalizedQuestion = this.normalizeText(question);
    
    // Rechercher la meilleure correspondance
    const bestMatch = this.findBestMatch(normalizedQuestion);
    
    if (bestMatch) {
      return bestMatch.answer;
    }
    
    // Réponse par défaut si aucune correspondance
    return this.getDefaultResponse(normalizedQuestion);
  }

  /**
   * Trouve la meilleure correspondance dans la base de connaissances
   */
  private findBestMatch(normalizedQuestion: string): KnowledgeItem | null {
    let bestMatch: KnowledgeItem | null = null;
    let highestScore = 0;

    for (const item of this.knowledgeBase) {
      const score = this.calculateMatchScore(normalizedQuestion, item);
      
      if (score > highestScore && score > 0.3) { // Seuil de confiance
        highestScore = score;
        bestMatch = item;
      }
    }

    console.log('🔍 Meilleure correspondance:', bestMatch?.id, 'Score:', highestScore);
    return bestMatch;
  }

  /**
   * Calcule le score de correspondance entre la question et un item
   */
  private calculateMatchScore(normalizedQuestion: string, item: KnowledgeItem): number {
    let score = 0;
    const questionWords = normalizedQuestion.split(' ');

    // Score basé sur les mots-clés
    for (const keyword of item.keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      
      // Correspondance exacte du mot-clé
      if (normalizedQuestion.includes(normalizedKeyword)) {
        score += 0.3;
      }
      
      // Correspondance partielle (mots individuels)
      for (const word of questionWords) {
        if (word.length > 3 && normalizedKeyword.includes(word)) {
          score += 0.1;
        }
      }
    }

    // Score basé sur les questions similaires
    for (const exampleQuestion of item.questions) {
      const normalizedExample = this.normalizeText(exampleQuestion);
      const similarity = this.calculateSimilarity(normalizedQuestion, normalizedExample);
      score += similarity * 0.5;
    }

    return Math.min(score, 1); // Limiter à 1
  }

  /**
   * Calcule la similarité entre deux textes (Jaccard similarity)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Normalise le texte pour la comparaison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
      .replace(/[^\w\s]/g, ' ') // Enlever la ponctuation
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  }

  /**
   * Réponse par défaut quand aucune correspondance n'est trouvée
   */
  private getDefaultResponse(normalizedQuestion: string): string {
    // Suggestions basées sur les mots-clés détectés
    const suggestions: string[] = [];
    
    if (normalizedQuestion.includes('election') || normalizedQuestion.includes('vote')) {
      suggestions.push('• Types d\'élection (présentielle/virtuelle)');
      suggestions.push('• Processus de vote');
    }
    
    if (normalizedQuestion.includes('role') || normalizedQuestion.includes('permission')) {
      suggestions.push('• Rôles globaux (PRESIDENT, RH, etc.)');
      suggestions.push('• Rôles de comité (RESPONSABLE, MEMBRE_COMITE)');
    }
    
    if (normalizedQuestion.includes('candidat') || normalizedQuestion.includes('postuler')) {
      suggestions.push('• Conditions de candidature');
      suggestions.push('• Élection présidentielle vs bureau');
    }
    
    if (normalizedQuestion.includes('qr') || normalizedQuestion.includes('code')) {
      suggestions.push('• Processus QR code');
      suggestions.push('• Validation des présences');
    }

    let response = "🤔 Je n'ai pas trouvé de réponse exacte à votre question.\n\n";
    
    if (suggestions.length > 0) {
      response += "Peut-être cherchez-vous des informations sur :\n" + suggestions.join('\n') + "\n\n";
    }
    
    response += "💡 **Suggestions** :\n";
    response += "• Reformulez votre question\n";
    response += "• Utilisez des mots-clés comme : élection, vote, rôle, candidature, QR code\n";
    response += "• Tapez \"aide\" pour voir les catégories disponibles";
    
    return response;
  }

  /**
   * Ajoute un message utilisateur
   */
  private addUserMessage(text: string): void {
    const message: ChatMessage = {
      id: this.generateId(),
      text,
      sender: 'user',
      timestamp: new Date()
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  /**
   * Ajoute un message du bot
   */
  private addBotMessage(text: string): void {
    const message: ChatMessage = {
      id: this.generateId(),
      text,
      sender: 'bot',
      timestamp: new Date()
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, message]);
  }

  /**
   * Génère un ID unique
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Réinitialise la conversation
   */
  resetConversation(): void {
    this.messagesSubject.next([]);
    this.addBotMessage(
      "🔄 Conversation réinitialisée.\n\n" +
      "Posez-moi une nouvelle question sur les règles d'élection !"
    );
  }

  /**
   * Obtient toutes les catégories disponibles
   */
  getCategories(): string[] {
    return [...new Set(this.knowledgeBase.map(item => item.category))];
  }

  /**
   * Obtient les items d'une catégorie
   */
  getItemsByCategory(category: string): KnowledgeItem[] {
    return this.knowledgeBase.filter(item => item.category === category);
  }
}
