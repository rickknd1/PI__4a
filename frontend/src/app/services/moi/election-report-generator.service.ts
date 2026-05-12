import { Injectable } from '@angular/core';
import { pipeline, env } from '@xenova/transformers';

export interface ElectionReportData {
  electionTitle: string;
  electionType: 'PRESIDENT' | 'BUREAU';
  startDate: Date;
  endDate: Date;
  totalVoters: number;
  totalMembers: number;
  winner: {
    name: string;
    votes: number;
    percentage: number;
  };
  candidates: Array<{
    name: string;
    votes: number;
    percentage: number;
  }>;
  clubName?: string;
}

/**
 * Service de génération de rapports d'élection avec IA (Transformers.js)
 * Utilise LaMini-Flan-T5-77M (77 MB) pour générer les analyses et commentaires
 * Modèle léger et rapide, optimisé pour la génération de texte
 */
@Injectable({
  providedIn: 'root'
})
export class ElectionReportGeneratorService {
  private generator: any = null;
  private isModelLoading = false;
  private isModelReady = false;

  constructor() {
    // Configuration pour le navigateur
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
  }

  /**
   * Charge le modèle de génération de texte
   */
  private async loadModel(): Promise<void> {
    if (this.isModelLoading || this.isModelReady) return;

    this.isModelLoading = true;
    console.log('🤖 Chargement du modèle de génération de texte...');
    console.log('📦 Modèle: Xenova/LaMini-Flan-T5-77M (77 MB - léger et rapide)');

    try {
      // Utiliser LaMini-Flan-T5-77M - modèle léger et rapide (77 MB)
      // Optimisé pour la génération de texte avec un bon équilibre qualité/taille
      this.generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
      this.isModelReady = true;
      console.log('✅ Modèle LaMini-Flan-T5-77M chargé avec succès!');
      console.log('ℹ️ Modèle léger (77 MB) prêt pour la génération de rapports');
    } catch (error) {
      console.error('❌ Erreur chargement modèle LaMini-Flan-T5-77M:', error);
      console.log('🔄 Tentative avec un modèle encore plus léger: Xenova/flan-t5-small');
      
      try {
        // Fallback vers un modèle encore plus petit
        this.generator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
        this.isModelReady = true;
        console.log('✅ Modèle flan-t5-small chargé avec succès (fallback)!');
      } catch (fallbackError) {
        console.error('❌ Erreur chargement modèle fallback:', fallbackError);
        this.isModelReady = false;
        throw new Error('Impossible de charger le modèle IA. Utilisation du template de secours.');
      }
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Génère un rapport complet d'élection avec IA
   */
  async generateElectionReport(data: ElectionReportData): Promise<string> {
    console.log('📊 Génération du rapport d\'élection avec IA...');
    
    try {
      // Charger le modèle si nécessaire
      if (!this.isModelReady) {
        await this.loadModel();
      }

      // Générer le rapport avec IA
      const report = await this.buildReportWithAI(data);
      
      console.log('✅ Rapport généré avec succès!');
      return report;
    } catch (error) {
      console.error('❌ Erreur génération avec IA, utilisation du template:', error);
      // Fallback vers template si erreur
      return this.buildReportWithTemplate(data);
    }
  }

  /**
   * Construit le rapport avec génération IA
   */
  private async buildReportWithAI(data: ElectionReportData): Promise<string> {
    let report = '';

    // En-tête (structure fixe)
    report += this.generateHeader(data);
    report += '\n\n';

    // Informations générales (structure fixe)
    report += this.generateGeneralInfo(data);
    report += '\n\n';

    // Participation avec analyse IA
    report += await this.generateParticipationWithAI(data);
    report += '\n\n';

    // Résultats (structure fixe)
    report += this.generateResultsVisual(data);
    report += '\n\n';

    // Analyse de la victoire avec IA
    report += await this.generateVictoryAnalysisWithAI(data);
    report += '\n\n';

    // Conclusion avec IA
    report += await this.generateConclusionWithAI(data);

    return report;
  }

  /**
   * Génère l'analyse de participation avec IA
   */
  private async generateParticipationWithAI(data: ElectionReportData): Promise<string> {
    const participationRate = (data.totalVoters / data.totalMembers) * 100;
    const participationLevel = this.getParticipationLevel(participationRate);

    // Construire le prompt en français pour T5
    const typeElection = data.electionType === 'PRESIDENT' ? 'présidentielle' : 'de bureau';
    const prompt = `Analysez cette participation électorale: ${data.totalVoters} membres sur ${data.totalMembers} ont voté (${participationRate.toFixed(1)}%). ` +
                   `C'est une participation ${participationLevel.toLowerCase()} pour une élection ${typeElection}. ` +
                   `Rédigez une analyse professionnelle en 2 phrases.`;

    try {
      console.log('🔄 Génération analyse participation avec IA...');
      
      // Générer le commentaire avec l'IA
      const result = await this.generator(prompt, {
        max_new_tokens: 100,
        temperature: 0.7,
        top_k: 50,
        do_sample: true
      });

      let aiComment = result[0].generated_text.trim();
      
      // Nettoyer le texte généré
      aiComment = this.cleanGeneratedText(aiComment);

      console.log('✅ Analyse participation générée:', aiComment.substring(0, 50) + '...');

      return `👥 PARTICIPATION\n` +
             `   Votants : ${data.totalVoters} / ${data.totalMembers} membres\n` +
             `   Taux    : ${participationRate.toFixed(1)}% (${participationLevel})\n\n` +
             `   📝 ${aiComment}`;
    } catch (error) {
      console.error('❌ Erreur génération IA participation:', error);
      // Fallback
      return this.generateParticipationTemplate(data);
    }
  }

  /**
   * Génère l'analyse de victoire avec IA
   */
  private async generateVictoryAnalysisWithAI(data: ElectionReportData): Promise<string> {
    const winner = data.winner;
    const secondPlace = data.candidates
      .filter(c => c.name !== winner.name)
      .sort((a, b) => b.votes - a.votes)[0];

    const marginPercentage = secondPlace ? winner.percentage - secondPlace.percentage : winner.percentage;
    const victoryType = this.getVictoryType(winner.percentage, marginPercentage);
    const victoryTypeFr = this.getVictoryTypeFrench(victoryType);

    // Construire le prompt en français pour T5
    const prompt = `Analysez cette victoire électorale: ${winner.name} a remporté avec ${winner.percentage.toFixed(1)}% des voix. ` +
                   (secondPlace ? `Deuxième: ${secondPlace.name} avec ${secondPlace.percentage.toFixed(1)}%. ` : '') +
                   `C'est une victoire ${victoryTypeFr}. Rédigez une analyse en 2 phrases.`;

    try {
      console.log('🔄 Génération analyse victoire avec IA...');
      
      // Générer l'analyse avec l'IA
      const result = await this.generator(prompt, {
        max_new_tokens: 120,
        temperature: 0.7,
        top_k: 50,
        do_sample: true
      });

      let aiAnalysis = result[0].generated_text.trim();
      
      // Nettoyer le texte généré
      aiAnalysis = this.cleanGeneratedText(aiAnalysis);

      console.log('✅ Analyse victoire générée:', aiAnalysis.substring(0, 50) + '...');

      return `🎯 ANALYSE DE LA VICTOIRE\n\n` +
             `   📝 ${aiAnalysis}`;
    } catch (error) {
      console.error('❌ Erreur génération IA victoire:', error);
      // Fallback
      return this.generateVictoryAnalysisTemplate(data);
    }
  }

  /**
   * Génère la conclusion avec IA
   */
  private async generateConclusionWithAI(data: ElectionReportData): Promise<string> {
    const participationRate = (data.totalVoters / data.totalMembers) * 100;
    const typeLabel = data.electionType === 'PRESIDENT' ? 'présidentielle' : 'de bureau';

    // Construire le prompt en français pour T5
    const prompt = `Rédigez une conclusion pour cette élection ${typeLabel}: ` +
                   `Participation ${participationRate.toFixed(1)}%, ` +
                   `vainqueur ${data.winner.name} avec ${data.winner.percentage.toFixed(1)}% des voix. ` +
                   `Conclusion professionnelle et positive en 2 phrases.`;

    try {
      console.log('🔄 Génération conclusion avec IA...');
      
      // Générer la conclusion avec l'IA
      const result = await this.generator(prompt, {
        max_new_tokens: 100,
        temperature: 0.7,
        top_k: 50,
        do_sample: true
      });

      let aiConclusion = result[0].generated_text.trim();
      
      // Nettoyer le texte généré
      aiConclusion = this.cleanGeneratedText(aiConclusion);

      console.log('✅ Conclusion générée:', aiConclusion.substring(0, 50) + '...');

      return `📝 CONCLUSION\n\n` +
             `   📝 ${aiConclusion}`;
    } catch (error) {
      console.error('❌ Erreur génération IA conclusion:', error);
      // Fallback
      return this.generateConclusionTemplate(data);
    }
  }

  /**
   * Nettoie le texte généré par l'IA
   */
  private cleanGeneratedText(text: string): string {
    // Retirer les sauts de ligne multiples
    text = text.replace(/\n+/g, ' ');
    
    // Retirer les espaces multiples
    text = text.replace(/\s+/g, ' ');
    
    // Retirer les caractères de contrôle
    text = text.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Limiter à 250 caractères pour éviter les textes trop longs
    if (text.length > 250) {
      text = text.substring(0, 250);
      // Couper à la dernière phrase complète
      const lastPeriod = text.lastIndexOf('.');
      if (lastPeriod > 100) {
        text = text.substring(0, lastPeriod + 1);
      } else {
        text += '...';
      }
    }
    
    // Retirer les phrases incomplètes à la fin
    const sentences = text.split(/[.!?]+/);
    if (sentences.length > 1 && sentences[sentences.length - 1].trim().length < 10) {
      text = sentences.slice(0, -1).join('. ') + '.';
    }
    
    // S'assurer que le texte se termine par une ponctuation
    if (text.length > 0 && !text.match(/[.!?]$/)) {
      text += '.';
    }
    
    return text.trim();
  }

  /**
   * Génère l'en-tête du rapport
   */
  private generateHeader(data: ElectionReportData): string {
    const typeLabel = data.electionType === 'PRESIDENT' ? 'Présidentielle' : 'de Bureau';
    return `📊 RAPPORT D'ÉLECTION ${typeLabel.toUpperCase()}\n` +
           `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `${data.electionTitle}`;
  }

  /**
   * Génère les informations générales
   */
  private generateGeneralInfo(data: ElectionReportData): string {
    const startDate = new Date(data.startDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const endDate = new Date(data.endDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const duration = this.calculateDuration(data.startDate, data.endDate);

    return `📅 PÉRIODE DE VOTE\n` +
           `   Début : ${startDate}\n` +
           `   Fin   : ${endDate}\n` +
           `   Durée : ${duration}`;
  }

  /**
   * Génère les résultats visuels
   */
  private generateResultsVisual(data: ElectionReportData): string {
    let results = `🏆 RÉSULTATS\n\n`;

    const sortedCandidates = [...data.candidates].sort((a, b) => b.votes - a.votes);

    sortedCandidates.forEach((candidate, index) => {
      const position = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const bar = this.generateProgressBar(candidate.percentage);
      
      results += `   ${position} ${candidate.name}\n`;
      results += `      ${candidate.votes} votes (${candidate.percentage.toFixed(1)}%)\n`;
      results += `      ${bar}\n\n`;
    });

    return results;
  }

  // ========== Méthodes utilitaires ==========

  private calculateDuration(start: Date, end: Date): string {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} jour${days > 1 ? 's' : ''} et ${hours} heure${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} heure${hours > 1 ? 's' : ''}`;
    }
  }

  private getParticipationLevel(rate: number): string {
    if (rate >= 80) return 'Excellente';
    if (rate >= 60) return 'Très bonne';
    if (rate >= 40) return 'Bonne';
    if (rate >= 20) return 'Moyenne';
    return 'Faible';
  }

  private generateProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 5);
    const empty = 20 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private getVictoryType(winnerPercentage: number, margin: number): string {
    if (winnerPercentage >= 70) return 'overwhelming';
    if (margin >= 20) return 'decisive';
    if (margin >= 10) return 'comfortable';
    if (margin >= 5) return 'clear';
    return 'narrow';
  }

  /**
   * Traduit le type de victoire en français
   */
  private getVictoryTypeFrench(victoryType: string): string {
    const translations: { [key: string]: string } = {
      'overwhelming': 'écrasante',
      'decisive': 'large',
      'comfortable': 'confortable',
      'clear': 'nette',
      'narrow': 'serrée'
    };
    return translations[victoryType] || 'nette';
  }

  // ========== Templates de secours (fallback) ==========

  private buildReportWithTemplate(data: ElectionReportData): string {
    let report = '';
    report += this.generateHeader(data) + '\n\n';
    report += this.generateGeneralInfo(data) + '\n\n';
    report += this.generateParticipationTemplate(data) + '\n\n';
    report += this.generateResultsVisual(data) + '\n\n';
    report += this.generateVictoryAnalysisTemplate(data) + '\n\n';
    report += this.generateConclusionTemplate(data);
    return report;
  }

  private generateParticipationTemplate(data: ElectionReportData): string {
    const participationRate = (data.totalVoters / data.totalMembers) * 100;
    const participationLevel = this.getParticipationLevel(participationRate);
    const comment = this.getParticipationComment(participationRate, data.electionType);

    return `👥 PARTICIPATION\n` +
           `   Votants : ${data.totalVoters} / ${data.totalMembers} membres\n` +
           `   Taux    : ${participationRate.toFixed(1)}% (${participationLevel})\n\n` +
           `   ${comment}`;
  }

  private generateVictoryAnalysisTemplate(data: ElectionReportData): string {
    const winner = data.winner;
    const secondPlace = data.candidates
      .filter(c => c.name !== winner.name)
      .sort((a, b) => b.votes - a.votes)[0];
    const marginPercentage = secondPlace ? winner.percentage - secondPlace.percentage : winner.percentage;
    const victoryType = this.getVictoryType(winner.percentage, marginPercentage);
    const analysis = this.getVictoryAnalysis(winner, secondPlace, victoryType, data.electionType);

    return `🎯 ANALYSE DE LA VICTOIRE\n\n   ${analysis}`;
  }

  private generateConclusionTemplate(data: ElectionReportData): string {
    const conclusion = this.generateConclusionText(data);
    return `📝 CONCLUSION\n\n   ${conclusion}`;
  }

  private getParticipationComment(rate: number, type: string): string {
    const typeLabel = type === 'PRESIDENT' ? 'présidentielle' : 'de bureau';
    if (rate >= 80) {
      return `La mobilisation pour cette élection ${typeLabel} a été exceptionnelle, témoignant d'un fort engagement des membres du club.`;
    } else if (rate >= 60) {
      return `Cette élection ${typeLabel} a suscité un intérêt marqué auprès des membres, avec une participation très satisfaisante.`;
    } else if (rate >= 40) {
      return `La participation à cette élection ${typeLabel} est correcte, bien que des efforts de mobilisation supplémentaires auraient pu être bénéfiques.`;
    } else {
      return `Le taux de participation à cette élection ${typeLabel} est modéré. Il serait pertinent d'analyser les raisons de cette mobilisation limitée.`;
    }
  }

  private getVictoryAnalysis(winner: any, secondPlace: any, victoryType: string, electionType: string): string {
    const typeLabel = electionType === 'PRESIDENT' ? 'la présidence' : 'ce poste';
    if (victoryType === 'overwhelming') {
      return `${winner.name} remporte ${typeLabel} avec une victoire écrasante de ${winner.percentage.toFixed(1)}%. Ce résultat sans appel démontre un soutien massif des membres.`;
    } else if (victoryType === 'narrow') {
      return `${winner.name} remporte ${typeLabel} de justesse avec ${winner.percentage.toFixed(1)}% des voix. L'écart serré invite à une gouvernance inclusive.`;
    } else {
      return `${winner.name} s'impose avec ${winner.percentage.toFixed(1)}% des voix, une victoire nette qui confère une légitimité solide.`;
    }
  }

  private generateConclusionText(data: ElectionReportData): string {
    const typeLabel = data.electionType === 'PRESIDENT' ? 'présidentielle' : 'de bureau';
    return `Cette élection ${typeLabel} s'est déroulée dans le respect des procédures démocratiques du club. ` +
           `${data.winner.name} dispose désormais de la légitimité nécessaire pour exercer ses fonctions.`;
  }
}
