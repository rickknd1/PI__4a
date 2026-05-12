import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

@Component({
  selector: 'app-transformers-diagnostic',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="diagnostic-container">
      <div class="diagnostic-header">
        <h2>🧪 Diagnostic Transformers.js</h2>
        <button (click)="runDiagnostic()" [disabled]="isRunning" class="btn-primary">
          {{ isRunning ? '⏳ Test en cours...' : '🚀 Lancer le diagnostic' }}
        </button>
        <button (click)="clearLogs()" class="btn-secondary">🗑️ Effacer</button>
      </div>

      <div class="logs-container">
        <div *ngFor="let log of logs" [class]="'log-entry log-' + log.type">
          <span class="log-time">{{ log.timestamp | date:'HH:mm:ss' }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>

      <div *ngIf="summary" class="summary-container" [class.success]="summary.success">
        <h3>{{ summary.success ? '✅ Résumé' : '❌ Résumé' }}</h3>
        <p>{{ summary.message }}</p>
        <div *ngIf="summary.details" class="summary-details">
          <p *ngFor="let detail of summary.details">{{ detail }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .diagnostic-container {
      max-width: 900px;
      margin: 20px auto;
      padding: 20px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .diagnostic-header {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e0e0e0;
    }

    .diagnostic-header h2 {
      flex: 1;
      margin: 0;
      color: #333;
    }

    .btn-primary, .btn-secondary {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s;
    }

    .btn-primary {
      background: #4CAF50;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #45a049;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f44336;
      color: white;
    }

    .btn-secondary:hover {
      background: #da190b;
    }

    .logs-container {
      background: #1e1e1e;
      color: #00ff00;
      padding: 15px;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      max-height: 500px;
      overflow-y: auto;
      margin-bottom: 20px;
    }

    .log-entry {
      margin: 5px 0;
      padding: 5px;
      border-left: 3px solid transparent;
    }

    .log-time {
      color: #888;
      margin-right: 10px;
    }

    .log-info {
      border-left-color: #2196F3;
      color: #00ff00;
    }

    .log-success {
      border-left-color: #4CAF50;
      color: #4CAF50;
      font-weight: bold;
    }

    .log-error {
      border-left-color: #f44336;
      color: #ff6b6b;
      font-weight: bold;
    }

    .log-warning {
      border-left-color: #ff9800;
      color: #ffa726;
    }

    .summary-container {
      padding: 20px;
      border-radius: 5px;
      background: #fff3cd;
      border: 2px solid #ffc107;
    }

    .summary-container.success {
      background: #d4edda;
      border-color: #28a745;
    }

    .summary-container h3 {
      margin: 0 0 10px 0;
      color: #333;
    }

    .summary-details {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(0,0,0,0.1);
    }

    .summary-details p {
      margin: 5px 0;
      font-size: 14px;
    }
  `]
})
export class TransformersDiagnosticComponent {
  logs: LogEntry[] = [];
  isRunning = false;
  summary: { success: boolean; message: string; details?: string[] } | null = null;

  private log(message: string, type: LogEntry['type'] = 'info'): void {
    this.logs.push({
      timestamp: new Date(),
      message,
      type
    });
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  clearLogs(): void {
    this.logs = [];
    this.summary = null;
  }

  async runDiagnostic(): Promise<void> {
    this.isRunning = true;
    this.clearLogs();
    
    this.log('🚀 Démarrage du diagnostic transformers.js', 'info');
    this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

    try {
      // Test 1: Import du module
      this.log('📦 Test 1: Import du module...', 'info');
      const { pipeline, env } = await import('@xenova/transformers');
      this.log('✅ Module importé avec succès', 'success');

      // Test 2: Configuration
      this.log('⚙️ Test 2: Configuration...', 'info');
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
      
      this.log(`  allowLocalModels: ${env.allowLocalModels}`, 'info');
      this.log(`  allowRemoteModels: ${env.allowRemoteModels}`, 'info');
      this.log('✅ Configuration appliquée', 'success');

      // Test 3: Chargement du modèle
      this.log('🤖 Test 3: Chargement du modèle...', 'info');
      this.log('⏳ Téléchargement en cours (30-60s)...', 'warning');
      
      const startTime = Date.now();
      const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      this.log(`✅ Modèle chargé en ${loadTime}s`, 'success');

      // Test 4: Inférence
      this.log('🧪 Test 4: Génération d\'embedding...', 'info');
      const testText = 'Bonjour, ceci est un test';
      const output = await embedder(testText, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data as Float32Array);
      
      this.log(`✅ Embedding généré: ${embedding.length} dimensions`, 'success');
      this.log(`  Premiers éléments: [${embedding.slice(0, 5).map(x => x.toFixed(4)).join(', ')}...]`, 'info');

      // Test 5: Similarité
      this.log('🔍 Test 5: Calcul de similarité...', 'info');
      const text1 = 'Comment voter ?';
      const text2 = 'Quel est le processus de vote ?';
      
      const emb1 = await embedder(text1, { pooling: 'mean', normalize: true });
      const emb2 = await embedder(text2, { pooling: 'mean', normalize: true });
      
      const arr1 = Array.from(emb1.data as Float32Array);
      const arr2 = Array.from(emb2.data as Float32Array);
      
      let dotProduct = 0;
      for (let i = 0; i < arr1.length; i++) {
        dotProduct += arr1[i] * arr2[i];
      }
      
      this.log(`  "${text1}" vs "${text2}"`, 'info');
      this.log(`✅ Similarité: ${(dotProduct * 100).toFixed(2)}%`, 'success');

      // Résumé
      this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'success');
      this.log('🎉 TOUS LES TESTS RÉUSSIS !', 'success');
      
      this.summary = {
        success: true,
        message: 'Transformers.js fonctionne parfaitement !',
        details: [
          '✅ Module chargé correctement',
          `✅ Modèle chargé en ${loadTime}s`,
          `✅ Embeddings générés (${embedding.length} dimensions)`,
          '✅ Calcul de similarité fonctionnel',
          '✅ Prêt pour l\'intégration dans le chatbot'
        ]
      };

    } catch (error: any) {
      this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'error');
      this.log('❌ ERREUR DÉTECTÉE', 'error');
      this.log(`Type: ${error.name}`, 'error');
      this.log(`Message: ${error.message}`, 'error');
      
      if (error.stack) {
        this.log('Stack trace:', 'error');
        const stackLines = error.stack.split('\n').slice(0, 5);
        stackLines.forEach((line: string) => this.log(line, 'error'));
      }

      // Diagnostic
      this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'warning');
      this.log('🔍 DIAGNOSTIC:', 'warning');
      
      const details: string[] = [];
      
      if (error.message?.includes('CORS')) {
        this.log('⚠️ Problème CORS détecté', 'warning');
        this.log('💡 Solution: Le CDN est configuré, vérifiez les en-têtes HTTP', 'info');
        details.push('❌ Erreur CORS - Problème de configuration serveur');
        details.push('💡 Vérifiez que le serveur autorise les requêtes cross-origin');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        this.log('⚠️ Problème de réseau détecté', 'warning');
        this.log('💡 Solution: Vérifiez votre connexion internet', 'info');
        details.push('❌ Erreur réseau - Pas de connexion internet');
        details.push('💡 Vérifiez votre connexion et réessayez');
      } else if (error.message?.includes('404')) {
        this.log('⚠️ Modèle non trouvé (404)', 'warning');
        this.log('💡 Solution: Le modèle n\'existe pas ou le nom est incorrect', 'info');
        details.push('❌ Modèle non trouvé (404)');
        details.push('💡 Vérifiez le nom du modèle: Xenova/all-MiniLM-L6-v2');
      } else if (error.message?.includes('memory') || error.message?.includes('allocation')) {
        this.log('⚠️ Problème de mémoire', 'warning');
        this.log('💡 Solution: Fermez d\'autres onglets ou utilisez un modèle plus léger', 'info');
        details.push('❌ Mémoire insuffisante');
        details.push('💡 Fermez d\'autres onglets et réessayez');
      } else {
        this.log('⚠️ Erreur inconnue', 'warning');
        this.log('💡 Copiez l\'erreur complète pour diagnostic', 'info');
        details.push('❌ Erreur inconnue: ' + error.message);
        details.push('💡 Contactez le support avec les logs complets');
      }

      this.summary = {
        success: false,
        message: 'Le diagnostic a échoué',
        details
      };
    } finally {
      this.isRunning = false;
    }
  }
}
