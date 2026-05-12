import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { pipeline, env } from '@xenova/transformers';
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
  embedding?: number[]; // ✅ NOUVEAU: Embedding du texte
}

/**
 * Service IA avancé utilisant transformers.js pour la compréhension du langage naturel
 * Utilise le modèle Xenova/all-MiniLM-L6-v2 pour générer des embeddings
 */
@Injectable({
  providedIn: 'root'
})
export class AiChatbotAdvancedService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$: Observable<ChatMessage[]> = this.messagesSubject.asObservable();
  
  private knowledgeBase: KnowledgeItem[] = knowledgeBase.knowledge_base;
  private embedder: any = null;
  private isModelLoading = false;
  private isModelReady = false;
  private embeddingsCache = new Map<string, number[]>();

  constructor() {
    // ✅ CONFIGURATION CRITIQUE: Forcer l'utilisation de HuggingFace CDN
    // Ne PAS utiliser les modèles locaux (évite le 404 sur /models/...)
    env.allowLocalModels = false;  // ← IMPORTANT: false pour éviter le serveur local
    env.allowRemoteModels = true;  // ← IMPORTANT: true pour télécharger depuis HuggingFace
    
    // Configuration du CDN pour les fichiers WASM
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
    
    console.log('🔧 Configuration transformers.js:', {
      allowLocalModels: env.allowLocalModels,
      allowRemoteModels: env.allowRemoteModels,
      wasmPaths: env.backends.onnx.wasm.wasmPaths
    });
    
    // Message de bienvenue
    this.addBotMessage(
      "👋 Bonjour ! Je suis votre assistant IA réglementaire avancé.\n\n" +
      "🧠 J'utilise l'intelligence artificielle (transformers.js) pour mieux comprendre vos questions.\n\n" +
      "Je peux répondre à vos questions sur :\n" +
      "• Les types d'élection (présentielle/virtuelle)\n" +
      "• Les rôles et permissions\n" +
      "• Les conditions de candidature\n" +
      "• Le processus de vote\n" +
      "• Et bien plus !\n\n" +
      "⏳ Chargement du modèle IA en cours...\n" +
      "Posez-moi une question en français naturel 😊"
    );
    
    // Charger le modèle en arrière-plan
    this.loadModel();
  }

  /**
   * Charge le modèle d'embeddings
   */
  private async loadModel(): Promise<void> {
    if (this.isModelLoading || this.isModelReady) return;
    
    this.isModelLoading = true;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 CHARGEMENT DU MODÈLE TRANSFORMERS.JS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Modèle:', 'Xenova/all-MiniLM-L6-v2');
    console.log('🌐 Configuration:', { 
      allowLocalModels: env.allowLocalModels, 
      allowRemoteModels: env.allowRemoteModels,
      wasmPaths: env.backends.onnx.wasm.wasmPaths
    });
    console.log('⏳ Téléchargement en cours (cela peut prendre 30-60 secondes)...');
    console.log('');
    
    try {
      const startTime = Date.now();
      
      // ✅ CORRECTION: Utiliser le modèle depuis HuggingFace
      console.log('📥 Téléchargement depuis HuggingFace...');
      console.log('🌐 URL: https://huggingface.co/Xenova/all-MiniLM-L6-v2');
      
      // Avec allowLocalModels=false, le modèle sera automatiquement téléchargé depuis HuggingFace
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      this.isModelReady = true;
      this.isModelLoading = false;
      
      console.log('✅ Modèle chargé avec succès en ' + loadTime + 's !');
      console.log('');
      
      // Pré-calculer les embeddings de la base de connaissances
      console.log('🔄 Pré-calcul des embeddings de la base de connaissances...');
      await this.precomputeEmbeddings();
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎉 SYSTÈME IA PRÊT !');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      // Notifier l'utilisateur
      this.addBotMessage(
        "✅ Modèle IA chargé avec succès !\n\n" +
        "🧠 **Temps de chargement:** " + loadTime + "s\n" +
        "📊 **Base de connaissances:** " + this.knowledgeBase.length + " items\n\n" +
        "Je suis maintenant prêt à répondre à vos questions avec une meilleure compréhension. 🚀"
      );
    } catch (error: any) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ ERREUR LORS DU CHARGEMENT DU MODÈLE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Type d\'erreur:', error.name);
      console.error('Message:', error.message);
      console.log('');
      
      if (error.stack) {
        console.error('Stack trace complète:');
        console.error(error.stack);
        console.log('');
      }
      
      // Diagnostic détaillé
      console.log('🔍 DIAGNOSTIC AUTOMATIQUE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      let errorType = 'INCONNUE';
      let solution = '';
      
      if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
        errorType = 'CORS (Cross-Origin Resource Sharing)';
        solution = '1. Vérifiez que le CDN est accessible\n' +
                  '2. Essayez de désactiver les extensions de navigateur\n' +
                  '3. Utilisez un autre navigateur (Chrome recommandé)';
        console.error('🚫 ERREUR CORS détectée');
      } else if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        errorType = 'RÉSEAU';
        solution = '1. Vérifiez votre connexion internet\n' +
                  '2. Vérifiez que vous pouvez accéder à https://huggingface.co\n' +
                  '3. Désactivez temporairement votre VPN/proxy';
        console.error('🌐 ERREUR RÉSEAU détectée');
      } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        errorType = 'MODÈLE NON TROUVÉ (404)';
        solution = '1. Le modèle n\'existe pas ou a été déplacé\n' +
                  '2. Vérifiez le nom: Xenova/all-MiniLM-L6-v2\n' +
                  '3. Essayez un autre modèle';
        console.error('📦 MODÈLE NON TROUVÉ (404)');
      } else if (error.message?.includes('memory') || error.message?.includes('allocation') || error.message?.includes('out of memory')) {
        errorType = 'MÉMOIRE INSUFFISANTE';
        solution = '1. Fermez d\'autres onglets du navigateur\n' +
                  '2. Redémarrez le navigateur\n' +
                  '3. Utilisez un modèle plus léger';
        console.error('💾 ERREUR MÉMOIRE détectée');
      } else if (error.message?.includes('wasm') || error.message?.includes('WebAssembly')) {
        errorType = 'WEBASSEMBLY';
        solution = '1. Votre navigateur ne supporte pas WebAssembly\n' +
                  '2. Mettez à jour votre navigateur\n' +
                  '3. Utilisez Chrome, Firefox ou Edge récent';
        console.error('⚙️ ERREUR WEBASSEMBLY détectée');
      }
      
      console.error('Type d\'erreur identifié:', errorType);
      console.log('');
      console.log('💡 SOLUTIONS RECOMMANDÉES:');
      console.log(solution || 'Aucune solution automatique disponible');
      console.log('');
      console.log('📋 ACTIONS À EFFECTUER:');
      console.log('1. Ouvrez la console (F12) et copiez cette erreur complète');
      console.log('2. Vérifiez votre connexion internet');
      console.log('3. Essayez de recharger la page (Ctrl+F5)');
      console.log('4. Si le problème persiste, passez en mode "simple" dans ai-chatbot-config.ts');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      this.isModelLoading = false;
      
      // Fallback vers l'algorithme simple
      this.addBotMessage(
        "⚠️ Le modèle IA n'a pas pu être chargé.\n\n" +
        "**Type d'erreur:** " + errorType + "\n" +
        "**Message:** " + error.message + "\n\n" +
        "🔄 **Fallback automatique:** Je vais utiliser un algorithme de correspondance simple.\n\n" +
        "💡 **Solutions:**\n" +
        (solution ? solution.split('\n').map(s => '• ' + s).join('\n') : '• Rechargez la page\n• Vérifiez votre connexion') + "\n\n" +
        "Les réponses seront moins précises mais fonctionnelles. 😊"
      );
    }
  }

  /**
   * Pré-calcule les embeddings de toutes les questions de la base de connaissances
   */
  private async precomputeEmbeddings(): Promise<void> {
    console.log('🔄 Pré-calcul des embeddings...');
    
    for (const item of this.knowledgeBase) {
      // Combiner toutes les questions et mots-clés pour créer un texte représentatif
      const text = [...item.questions, ...item.keywords].join(' ');
      item.embedding = await this.getEmbedding(text);
    }
    
    console.log('✅ Embeddings pré-calculés pour', this.knowledgeBase.length, 'items');
  }

  /**
   * Génère l'embedding d'un texte
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // Vérifier le cache
    if (this.embeddingsCache.has(text)) {
      return this.embeddingsCache.get(text)!;
    }
    
    if (!this.embedder) {
      return [];
    }
    
    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      // ✅ CORRECTION: Convertir explicitement en number[]
      const embedding: number[] = Array.from(output.data as Float32Array);
      
      // Mettre en cache
      this.embeddingsCache.set(text, embedding);
      
      return embedding;
    } catch (error) {
      console.error('❌ Erreur génération embedding:', error);
      return [];
    }
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Envoie un message utilisateur et génère une réponse
   */
  sendMessage(userMessage: string): void {
    if (!userMessage.trim()) return;

    // Ajouter le message utilisateur
    this.addUserMessage(userMessage);

    // Générer la réponse du bot
    setTimeout(async () => {
      const response = await this.generateResponse(userMessage);
      this.addBotMessage(response);
    }, 500);
  }

  /**
   * Génère une réponse basée sur la question de l'utilisateur
   */
  private async generateResponse(question: string): Promise<string> {
    // Si le modèle est prêt, utiliser les embeddings
    if (this.isModelReady && this.embedder) {
      return await this.generateResponseWithEmbeddings(question);
    }
    
    // Sinon, utiliser l'algorithme simple (fallback)
    return this.generateResponseSimple(question);
  }

  /**
   * Génère une réponse en utilisant les embeddings (méthode avancée)
   */
  private async generateResponseWithEmbeddings(question: string): Promise<string> {
    console.log('🧠 Utilisation des embeddings pour:', question);
    
    // Générer l'embedding de la question
    const questionEmbedding = await this.getEmbedding(question);
    
    if (questionEmbedding.length === 0) {
      return this.generateResponseSimple(question);
    }
    
    // Calculer la similarité avec chaque item de la base de connaissances
    let bestMatch: KnowledgeItem | null = null;
    let highestSimilarity = 0;
    
    for (const item of this.knowledgeBase) {
      if (!item.embedding || item.embedding.length === 0) {
        continue;
      }
      
      const similarity = this.cosineSimilarity(questionEmbedding, item.embedding);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = item;
      }
    }
    
    console.log('🔍 Meilleure correspondance (embeddings):', bestMatch?.id, 'Similarité:', highestSimilarity.toFixed(3));
    
    // Seuil de confiance plus bas car les embeddings sont plus précis
    if (bestMatch && highestSimilarity > 0.5) {
      return bestMatch.answer;
    }
    
    // Réponse par défaut
    return this.getDefaultResponse(question);
  }

  /**
   * Génère une réponse avec l'algorithme simple (fallback)
   */
  private generateResponseSimple(question: string): string {
    const normalizedQuestion = this.normalizeText(question);
    const bestMatch = this.findBestMatchSimple(normalizedQuestion);
    
    if (bestMatch) {
      return bestMatch.answer;
    }
    
    return this.getDefaultResponse(question);
  }

  /**
   * Trouve la meilleure correspondance avec l'algorithme simple
   */
  private findBestMatchSimple(normalizedQuestion: string): KnowledgeItem | null {
    let bestMatch: KnowledgeItem | null = null;
    let highestScore = 0;

    for (const item of this.knowledgeBase) {
      const score = this.calculateMatchScore(normalizedQuestion, item);
      
      if (score > highestScore && score > 0.3) {
        highestScore = score;
        bestMatch = item;
      }
    }

    console.log('🔍 Meilleure correspondance (simple):', bestMatch?.id, 'Score:', highestScore.toFixed(3));
    return bestMatch;
  }

  /**
   * Calcule le score de correspondance (algorithme simple)
   */
  private calculateMatchScore(normalizedQuestion: string, item: KnowledgeItem): number {
    let score = 0;
    const questionWords = normalizedQuestion.split(' ');

    // Score basé sur les mots-clés
    for (const keyword of item.keywords) {
      const normalizedKeyword = this.normalizeText(keyword);
      
      if (normalizedQuestion.includes(normalizedKeyword)) {
        score += 0.3;
      }
      
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

    return Math.min(score, 1);
  }

  /**
   * Calcule la similarité entre deux textes (Jaccard)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Normalise le texte
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Réponse par défaut
   */
  private getDefaultResponse(normalizedQuestion: string): string {
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
      (this.isModelReady 
        ? "🧠 Modèle IA prêt ! Posez-moi une nouvelle question."
        : "Posez-moi une nouvelle question sur les règles d'élection !")
    );
  }

  /**
   * Obtient le statut du modèle
   */
  getModelStatus(): { loading: boolean; ready: boolean } {
    return {
      loading: this.isModelLoading,
      ready: this.isModelReady
    };
  }
}
