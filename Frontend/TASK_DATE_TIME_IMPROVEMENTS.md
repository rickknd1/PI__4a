# Améliorations du champ "Due Date" - Event Tasks

## ✅ Modifications apportées

### 1. Interface utilisateur (HTML)
- **Date Picker** : Champ `<input type="date">` avec calendrier graphique natif
- **Time Picker** : Champ `<input type="time">` pour sélectionner l'heure (format 24h)
- **Layout** : Grille 2 colonnes (Date | Time) pour une meilleure UX
- **Validation visuelle** : 
  - Attribut `[min]` sur le date picker pour empêcher les dates passées
  - Message d'aide si date sans heure
  - Message d'erreur si date dans le passé

### 2. Logique TypeScript

#### Propriétés ajoutées
```typescript
newTask: Partial<Task> & { dueTime?: string }
```
- `dueTime` : Champ temporaire pour stocker l'heure séparément (non envoyé au backend)

#### Méthodes ajoutées/modifiées

**`minDate` (getter)**
- Retourne la date du jour au format ISO
- Utilisé pour l'attribut `[min]` du date picker

**`dueDateError` (getter)**
- Valide que la date sélectionnée n'est pas dans le passé
- Affiche un message d'erreur approprié

**`saveTask()` (modifiée)**
- Combine `dueDate` + `dueTime` en un seul ISO string
- Format : `YYYY-MM-DDTHH:mm:00.000Z`
- Si pas d'heure : utilise `23:59` par défaut (fin de journée)
- Supprime le champ temporaire `dueTime` avant l'envoi au backend

**`openForm()` (modifiée)**
- Lors de l'édition : sépare le `dueDate` ISO en date et heure
- Remplit automatiquement les deux champs séparés

**`getDueDateLabel()` (améliorée)**
- Détecte si une heure est présente dans le `dueDate`
- Affiche l'heure au format `HH:MM AM/PM` si disponible
- Exemples :
  - "Due today at 2:30 PM"
  - "Overdue by 2d at 9:00 AM"
  - "Due tomorrow at 11:45 AM"

### 3. Interface Task (task.interface.ts)
```typescript
dueTime?: string; // Temporary field for UI date/time picker (not stored in backend)
```
- Ajout du champ optionnel `dueTime` pour le typage TypeScript
- Commentaire explicite : champ UI uniquement, non persisté

## 🎯 Comportement final

### Création de tâche
1. L'utilisateur clique sur le date picker → calendrier s'ouvre
2. L'utilisateur sélectionne une date
3. L'utilisateur clique sur le time picker → sélecteur d'heure s'ouvre
4. L'utilisateur choisit l'heure (ex: 14:30)
5. Au clic sur "Assign Task" :
   - Date + Time sont combinés : `2026-04-28T14:30:00.000Z`
   - Envoyé au backend dans le champ `dueDate`

### Édition de tâche
1. Le formulaire s'ouvre avec une tâche existante
2. Si `dueDate` contient une heure :
   - Date picker affiche : `2026-04-28`
   - Time picker affiche : `14:30`
3. L'utilisateur peut modifier date et/ou heure
4. Sauvegarde : même logique de combinaison

### Affichage dans la liste
- Tâches avec heure : "Due tomorrow at 2:30 PM"
- Tâches sans heure : "Due tomorrow"
- Tâches en retard avec heure : "Overdue by 2d at 9:00 AM"

## 🔒 Validation

### Règles implémentées
1. ✅ Date minimale = aujourd'hui (pas de dates passées)
2. ✅ Message d'erreur si date < aujourd'hui
3. ✅ Suggestion d'ajouter une heure si date sans heure
4. ✅ Validation incluse dans `isFormValid`

### Messages utilisateur
- **Erreur** : "Due date cannot be in the past"
- **Info** : "💡 Add a time for better task scheduling"

## 📱 Compatibilité

### Navigateurs modernes
- Chrome/Edge : Date picker + Time picker natifs
- Firefox : Date picker + Time picker natifs
- Safari : Date picker + Time picker natifs

### Fallback
- Les navigateurs anciens affichent un champ texte standard
- Format attendu : `YYYY-MM-DD` et `HH:MM`

## 🚀 Avantages

1. **UX améliorée** : Pas de saisie manuelle, moins d'erreurs
2. **Validation native** : Le navigateur empêche les formats invalides
3. **Précision** : Heure exacte pour les deadlines importantes
4. **Flexibilité** : Heure optionnelle (défaut = fin de journée)
5. **Rétrocompatibilité** : Les tâches existantes sans heure fonctionnent toujours

## 📝 Notes techniques

- Le backend reçoit toujours un seul champ `dueDate` (ISO 8601)
- Le champ `dueTime` est purement UI (jamais envoyé au backend)
- La combinaison date+time se fait côté frontend avant l'envoi
- Le parsing date/time se fait à l'ouverture du formulaire d'édition
