/**
 * Configuration du chatbot IA
 * 
 * Permet de choisir entre:
 * - 'simple': Algorithme de similarité basique (rapide, léger, pas de dépendances)
 * - 'advanced': Transformers.js avec embeddings (plus précis, nécessite téléchargement du modèle)
 */
export const CHATBOT_CONFIG = {
  // Mode: 'simple' ou 'advanced'
  mode: 'advanced' as 'simple' | 'advanced',
  
  // Configuration pour le mode advanced
  advanced: {
    model: 'Xenova/all-MiniLM-L6-v2', // Modèle léger et performant
    similarityThreshold: 0.5, // Seuil de confiance (0-1)
    precomputeEmbeddings: true // Pré-calculer les embeddings au démarrage
  },
  
  // Configuration pour le mode simple
  simple: {
    similarityThreshold: 0.3 // Seuil de confiance (0-1)
  }
};
