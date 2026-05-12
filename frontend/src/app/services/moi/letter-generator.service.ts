import { Injectable } from '@angular/core';
import { pipeline, env } from '@xenova/transformers';

// Force browser-only mode
if (typeof window !== 'undefined') {
  // @ts-ignore - Disable Node.js backend
  env.backends.onnx.wasm.proxy = false;
}

export interface LetterGenerationRequest {
  candidateName: string;
  position: string;
  skills: string[];
  experiences?: string;
  electionType?: string; // PRESIDENT ou BUREAU
  committeeName?: string; // Pour élection de bureau
}

/**
 * Service de génération de lettres de motivation avec IA
 * Utilise transformers.js pour générer des lettres personnalisées
 */
@Injectable({
  providedIn: 'root'
})
export class LetterGeneratorService {
  private generator: any = null;
  private isModelLoading = false;
  private isModelReady = false;

  constructor() {
    // Configuration pour éviter les problèmes de chargement
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    
    // Configuration pour le navigateur (éviter les imports Node.js)
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
    
    // Désactiver onnxruntime-node (pas disponible dans le navigateur)
    if (typeof window !== 'undefined') {
      // Mode navigateur - utiliser uniquement WASM
      env.backends.onnx.wasm.numThreads = 1;
    }
  }

  /**
   * Charge le modèle de génération de texte
   */
  private async loadModel(): Promise<void> {
    if (this.isModelLoading || this.isModelReady) return;

    this.isModelLoading = true;
    console.log('🤖 Chargement du modèle de génération de lettres...');

    try {
      // Utiliser GPT-2 (plus léger et efficace pour la génération de texte)
      this.generator = await pipeline('text-generation', 'Xenova/gpt2');
      this.isModelReady = true;
      console.log('✅ Modèle de génération chargé avec succès!');
    } catch (error) {
      console.error('❌ Erreur chargement modèle:', error);
      this.isModelReady = false;
      throw new Error('Impossible de charger le modèle IA. Veuillez réessayer.');
    } finally {
      this.isModelLoading = false;
    }
  }

  /**
   * Génère une lettre de motivation personnalisée
   */
  async generateMotivationLetter(request: LetterGenerationRequest): Promise<string> {
    console.log('📝 Génération de la lettre avec template intelligent...');
    
    // Utiliser directement le template intelligent (plus fiable que GPT-2)
    // GPT-2 n'est pas adapté pour générer du texte structuré en français
    return this.generateTemplateLetter(request);
    
    /* CODE IA DÉSACTIVÉ - GPT-2 génère du texte incohérent
    // Charger le modèle si nécessaire
    if (!this.isModelReady) {
      await this.loadModel();
    }

    try {
      // Construire le prompt pour la génération
      const prompt = this.buildPrompt(request);

      console.log('📝 Génération de la lettre en cours...');

      // Générer le texte
      const result = await this.generator(prompt, {
        max_new_tokens: 200,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
        num_return_sequences: 1
      });

      // Extraire le texte généré
      let generatedText = result[0].generated_text;

      // Nettoyer et formater le texte
      generatedText = this.cleanGeneratedText(generatedText, prompt);

      console.log('✅ Lettre générée avec succès!');

      return generatedText;
    } catch (error) {
      console.error('❌ Erreur génération lettre:', error);
      
      // Fallback: générer une lettre template
      return this.generateTemplateLetter(request);
    }
    */
  }

  /**
   * Construit le prompt pour la génération
   */
  private buildPrompt(request: LetterGenerationRequest): string {
    const { candidateName, position, skills, experiences, electionType, committeeName } = request;

    let prompt = `Lettre de motivation pour ${position}.\n\n`;
    prompt += `Madame, Monsieur,\n\n`;
    prompt += `Je me permets de vous adresser ma candidature pour le poste de ${position}`;

    if (electionType === 'BUREAU' && committeeName) {
      prompt += ` au sein du comité ${committeeName}`;
    }

    prompt += `.\n\n`;

    if (skills && skills.length > 0) {
      prompt += `Mes compétences en ${skills.slice(0, 3).join(', ')} me permettent`;
    }

    return prompt;
  }

  /**
   * Nettoie le texte généré
   */
  private cleanGeneratedText(text: string, prompt: string): string {
    // Retirer le prompt du résultat
    let cleaned = text.replace(prompt, '').trim();

    // Limiter à environ 200 mots
    const words = cleaned.split(/\s+/);
    if (words.length > 200) {
      cleaned = words.slice(0, 200).join(' ') + '...';
    }

    // Ajouter une formule de politesse si manquante
    if (!cleaned.includes('Cordialement') && !cleaned.includes('Sincèrement')) {
      cleaned += '\n\nCordialement,';
    }

    return cleaned;
  }

  /**
   * Génère une lettre template intelligente et personnalisée
   */
  private generateTemplateLetter(request: LetterGenerationRequest): string {
    const { candidateName, position, skills, experiences, electionType, committeeName } = request;

    let letter = `Madame, Monsieur,\n\n`;

    // Introduction personnalisée selon le type d'élection
    if (electionType === 'PRESIDENT') {
      letter += `Je me permets de vous adresser ma candidature pour le poste de Président(e) de notre club. `;
      letter += `Convaincu(e) que notre club a un potentiel immense, je souhaite m'investir pleinement pour porter une vision ambitieuse et fédératrice.\n\n`;
    } else {
      letter += `Je me permets de vous adresser ma candidature pour le poste de ${position}`;
      if (committeeName && committeeName !== position) {
        letter += ` au sein du comité ${committeeName}`;
      }
      letter += `. Passionné(e) par la vie associative et désireux(se) de contribuer activement au développement de notre club, je suis convaincu(e) que mon profil correspond parfaitement aux attentes de ce poste.\n\n`;
    }

    // Paragraphe sur les compétences (personnalisé)
    if (skills && skills.length > 0) {
      if (skills.length === 1) {
        letter += `Ma compétence en ${skills[0]} me permet d'apporter une réelle valeur ajoutée à l'équipe. `;
      } else if (skills.length === 2) {
        letter += `Mes compétences en ${skills[0]} et ${skills[1]} me permettent d'apporter une réelle valeur ajoutée à l'équipe. `;
      } else {
        const lastSkill = skills[skills.length - 1];
        const otherSkills = skills.slice(0, -1).join(', ');
        letter += `Mes compétences en ${otherSkills} et ${lastSkill} me permettent d'apporter une réelle valeur ajoutée à l'équipe. `;
      }
    }

    // Paragraphe sur les expériences (très personnalisé)
    if (experiences && experiences.trim()) {
      // Analyser les expériences pour créer un paragraphe cohérent
      const exp = experiences.toLowerCase();
      
      if (exp.includes('an') || exp.includes('année') || exp.includes('mois')) {
        // Mention de durée d'expérience
        letter += `Fort(e) de mon expérience `;
        if (exp.includes('2 ans')) letter += `de 2 ans `;
        else if (exp.includes('3 ans')) letter += `de 3 ans `;
        else if (exp.includes('1 an')) letter += `d'un an `;
        
        if (exp.includes('communication')) letter += `en communication, `;
        else if (exp.includes('événement')) letter += `dans l'organisation d'événements, `;
        else if (exp.includes('gestion')) letter += `en gestion, `;
        else if (exp.includes('management')) letter += `en management, `;
        else letter += `dans le domaine associatif, `;
        
        letter += `je dispose des qualités nécessaires pour mener à bien les missions qui me seront confiées. `;
      } else {
        // Pas de durée spécifique, utiliser le texte directement
        letter += `Mon parcours, notamment ${this.extractKeyExperience(experiences)}, m'a permis de développer les qualités nécessaires pour réussir dans ce rôle. `;
      }
    } else {
      letter += `Je dispose des qualités nécessaires pour mener à bien les missions qui me seront confiées. `;
    }

    // Qualités personnelles
    letter += `Ma motivation, mon sens de l'organisation et mon esprit d'équipe sont des atouts que je souhaite mettre au service du club.\n\n`;

    // Conclusion selon le type d'élection
    if (electionType === 'PRESIDENT') {
      letter += `En tant que Président(e), je m'engage à porter une vision ambitieuse pour notre club, à fédérer les membres autour de projets communs et à représenter dignement nos valeurs. `;
      letter += `Je souhaite créer une dynamique positive où chaque membre pourra s'épanouir et contribuer au succès collectif.\n\n`;
    } else {
      letter += `Je m'engage à m'investir pleinement dans ce rôle et à contribuer activement aux objectifs du comité. `;
      letter += `Mon objectif est de travailler en étroite collaboration avec l'équipe pour faire avancer nos projets communs.\n\n`;
    }

    // Formule de politesse
    letter += `Je reste à votre disposition pour tout complément d'information et serais ravi(e) de pouvoir échanger avec vous sur ma candidature.\n\n`;
    letter += `Cordialement,\n${candidateName}`;

    return letter;
  }

  /**
   * Extrait l'expérience clé du texte utilisateur
   */
  private extractKeyExperience(experiences: string): string {
    const exp = experiences.trim();
    
    // Prendre la première phrase ou les 100 premiers caractères
    const firstSentence = exp.split(/[.!?]/)[0];
    if (firstSentence.length > 0 && firstSentence.length < 150) {
      return firstSentence.trim();
    }
    
    // Sinon, prendre les 100 premiers caractères
    if (exp.length > 100) {
      return exp.substring(0, 100).trim() + '...';
    }
    
    return exp;
  }

  /**
   * Vérifie si le modèle est prêt
   */
  isReady(): boolean {
    return this.isModelReady;
  }

  /**
   * Vérifie si le modèle est en cours de chargement
   */
  isLoading(): boolean {
    return this.isModelLoading;
  }

  /**
   * Obtient le statut du modèle
   */
  getStatus(): { loading: boolean; ready: boolean } {
    return {
      loading: this.isModelLoading,
      ready: this.isModelReady
    };
  }
}
