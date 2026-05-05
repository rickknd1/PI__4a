# Migration des URLs en dur vers le Gateway

## 📋 Résumé des modifications

Tous les appels HTTP en dur vers les services backend ont été remplacés par des appels via le **Gateway (port 8084)**.

## 🔄 URLs remplacées

### Frontend/src/app/instant-voice/instant-voice.component.ts

| Avant | Après | Service |
|-------|-------|---------|
| `http://localhost:8081/api/users` | `${getGatewayBase()}/api/users` | user-service |
| `http://localhost:8082/api/channels/${id}/audio` | `${getGatewayBase()}/api/voice2/channels/${id}/audio` | instant-voice-management |
| `http://localhost:8080/api/reports` | `${getGatewayBase()}/api/reports` | reports service |

### hedyene_voice2/Front/src/app/instant-voice/instant-voice.component.ts

Mêmes modifications que ci-dessus (fichier dupliqué).

## 📦 Import ajouté

```typescript
import { getGatewayBase } from '../environments/environment';
```

## 🎯 Avantages

1. **Centralisation** : Tous les appels passent par le Gateway
2. **Flexibilité** : Changement d'adresse IP/port sans modifier le code
3. **Sécurité** : Authentification JWT gérée au niveau du Gateway
4. **Scalabilité** : Load balancing via Eureka
5. **Maintenance** : Un seul point d'entrée pour les routes

## 🔧 Fonctionnement

La fonction `getGatewayBase()` détecte automatiquement :
- **localhost** → `http://localhost:8084`
- **IP distante** → `http://{ip}:8084`

## 📝 Endpoints utilisés

### Via Gateway (port 8084)

- `GET /api/users` → user-service (port 8081)
- `GET /api/voice2/channels/{id}/audio` → instant-voice-management (port 8082)
- `POST /api/voice2/channels/{id}/audio` → instant-voice-management (port 8082)
- `POST /api/reports` → reports service (port 8080)

## ✅ Vérification

Toutes les URLs en dur ont été supprimées :
```bash
grep -r "http://localhost" Frontend/src/app/instant-voice/
# Résultat : aucune correspondance
```

## 🚀 Prochaines étapes

1. Redémarrer l'application Angular
2. Vérifier que les appels passent par le Gateway dans les DevTools
3. Tester les fonctionnalités voice2 (notifications, audio, etc.)
