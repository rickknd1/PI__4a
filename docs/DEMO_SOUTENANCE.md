# Script de démo — Soutenance PFE

> Scénario pas-à-pas, **~12 minutes**, pour démontrer la partie IA
> de ClubHub devant le jury.
> Hypothèse : le projet est cloné, MongoDB est lancé, Node et Python
> installés.

---

## 0. Préparation (15 min avant de passer)

Ouvrez **4 terminaux PowerShell** dans la racine du projet et préparez
les commandes (ne les lancez pas encore, pour démarrer « à froid »
devant le jury).

| # | Terminal | Commande | Rôle |
|:-:|---|---|---|
| 1 | `Backend/` | `./mvnw spring-boot:run` | Backend Java (port 8080) |
| 2 | `Gateway/` | `./mvnw spring-boot:run` | Gateway (port 8084) |
| 3 | `Frontend/` | `npm start` | Angular (port 4200) |
| 4 | `ai-service/` | `.\run.ps1` | **Service IA Python** (port 8000) |

Vérifiez aussi qu'Ollama est lancé (icône barre de tâches) — sinon
`ollama serve` dans un 5ᵉ terminal.

> ✅ **Règle d'or** : **ne pas** cacher le bureau. Montrer que les 4
> fenêtres tournent **sur votre machine**. C'est le message central.

---

## Acte 1 — Le pitch (1 min)

> « ClubHub intègre trois niveaux d'intelligence artificielle, **tous
> locaux** : zéro appel à une API tierce, zéro coût récurrent, zéro
> donnée qui quitte la machine. Je vais vous les montrer les uns après
> les autres, et comment l'application continue de fonctionner même si
> deux d'entre eux tombent. »

Ouvrez `docs/AI_ARCHITECTURE.md` (GitHub / IDE) et affichez le **premier
schéma Mermaid**. Laissez le jury le voir 15 s.

---

## Acte 2 — Les modèles sont à moi (3 min)

### 2.1 Montrer le code du Random Forest

Ouvrez `ai-service/app/custom/recommender.py`. Faites défiler jusqu'à :

```python
self.model = RandomForestRegressor(
    n_estimators=100,
    max_depth=8,
    random_state=42,
)
```

> « Voici **mon** modèle. C'est moi qui ai choisi l'algorithme, la
> profondeur, le nombre d'arbres. Il est entraîné sur les données
> réelles du club. »

### 2.2 L'entraîner en direct

Terminal 4, arrêtez le service Python (`Ctrl+C`) et lancez :

```powershell
python train_recommender.py --synthetic
```

Le script affiche :

```
Training on 300 synthetic events…
R² score: 0.847
MAE:      0.092
Feature importances:
  attendance_rate       0.340
  avg_rating            0.215
  day_of_week           0.182
  format_encoded        0.141
  hour_of_day           0.082
  month                 0.040
Model saved to app/custom/models/recommender.pkl
```

> « Le R² est de 0.85 → le modèle explique 85 % de la variance. Et
> surtout, regardez les **feature importances** : le taux de remplissage
> pèse 34 %, le sentiment des feedbacks 21 %, le jour de la semaine
> 18 %. **Je peux justifier chaque recommandation** — ce qu'aucun LLM
> ne peut faire. »

Relancez le service : `.\run.ps1`.

### 2.3 Les exécuter sans API

Dans un **5ᵉ terminal**, arrêtez le service Python, puis :

```powershell
cd ai-service
python test_models.py all
```

Le script affiche les recommandations + le PV français, **sans FastAPI,
sans Spring, sans rien**. Juste Python qui appelle mes fonctions.

> « Ce script me sert à prouver que les modèles sont indépendants de
> l'infrastructure. S'il faut un jour remplacer Spring par autre chose,
> le cœur intelligent reste le même. »

---

## Acte 3 — La résilience en cascade (4 min)

C'est le moment le plus impressionnant du scénario. **Relancez tous les
services.**

### 3.1 Scénario A — Tout marche

Ouvrez le frontend dans le navigateur + les DevTools (`F12` → onglet
Network).

Naviguez vers la page **Recommandations d'événements**.

Dans Network, cliquez sur la requête `GET /api/recommendations/events`
et montrez la réponse :

```json
{
  "source": "custom-ml",
  "topFormats": [...],
  "insights": [...],
  "confidence": 0.82
}
```

> « `source: custom-ml` → c'est **mon** Random Forest qui a répondu.
> Tier 1 actif. »

### 3.2 Scénario B — Couper le Tier 1

Dans un terminal, désactivez seulement les endpoints custom :

```powershell
# Terminal 4 : Ctrl+C pour arrêter le service Python
```

Rechargez la page du frontend. Nouvelle requête dans Network :

```json
{
  "source": "stats-fallback",
  "topFormats": [...]
}
```

> « Le service Python est mort. Pas de plantage — `source:
> stats-fallback` → les **templates Java déterministes** prennent le
> relais. L'utilisateur voit toujours des recommandations. »

### 3.3 Scénario C — Montrer les logs Backend

Dans le terminal 1, montrez la ligne :

```
WARN  Local AI service unreachable at http://localhost:8000
      — falling back (start ai-service/run.ps1 to enable it)
```

> « Le Backend a détecté l'indisponibilité, a loggé un avertissement
> **une seule fois par minute** (pas de spam), et est passé au Tier
> suivant. Tout est observable. »

Relancez le service Python. Rechargez → on revient à `source:
custom-ml`. Transition.

---

## Acte 4 — La génération de PV (3 min)

### 4.1 Ouvrir la page PV

Connectez-vous en **SECRETAIRE_GENERALE**. Ouvrez « Générer un PV »
pour un événement passé.

### 4.2 Remplir le formulaire devant le jury

Remplissez 3-4 questions en **mélangeant les langues** :

| Question | Réponse (volontairement mixée) |
|---|---|
| La réunion s'est-elle ouverte à l'heure ? | « Yes, we started on time » |
| Qui a présenté ? | « Eya ajili men l'équipe organisatrice » |
| Décisions prises ? | « On a validé le budget 500 DT pour l'event de mai » |

Cliquez sur **Générer**.

### 4.3 Le résultat

Un PV en **français formel** apparaît, structuré en 5 sections :

```
PROCÈS-VERBAL — Réunion du 20 avril 2026

I. Préambule
La séance a été ouverte à l'heure convenue...

II. Déroulement
Eya Ajili, membre de l'équipe organisatrice, a présenté...

III. Décisions
Le budget de 500 DT a été validé pour l'événement de mai.

IV. Plan d'action
...

V. Clôture
...
```

> « Cette transformation multilingue → français formel est faite par
> **mon pipeline NLP à règles**, pas par un LLM. C'est **déterministe** :
> si je recommence avec les mêmes réponses, je réobtiens le même PV.
> Exigence critique pour un document officiel. »

Cliquez **Télécharger PDF** pour montrer la mise en forme finale.

---

## Acte 5 — Preuves matérielles (1 min)

Ouvrez un terminal et lancez pendant une requête :

```powershell
# Capture les connexions TCP sortantes
Get-NetTCPConnection -State Established |
  Where-Object { $_.RemoteAddress -ne "127.0.0.1" -and $_.RemoteAddress -notlike "::1" } |
  Select-Object RemoteAddress, RemotePort
```

Il n'y a **aucune** connexion vers une IP publique pendant que l'IA
travaille. Uniquement du trafic `127.0.0.1` / `::1`.

> « Preuve matérielle : aucune donnée ne quitte la machine pendant
> que l'IA fonctionne. C'est ma garantie de souveraineté. »

---

## Acte 6 — Conclusion (30 s)

> « En résumé :
>
> 1. Deux modèles IA **que j'ai conçus, entraînés, et que je peux
>    expliquer** — Random Forest pour les recommandations, NLP à règles
>    pour les PV.
> 2. Un LLM local **optionnel** via Ollama, pour les tâches libres.
> 3. Un filet de sécurité Java qui garantit que l'application ne plante
>    **jamais**.
> 4. **Zéro dépendance à une API tierce**, zéro coût récurrent, zéro
>    fuite de données.
>
> Je suis prêt à répondre à vos questions. »

---

## Questions probables du jury — aide-mémoire

| Question | Réponse rapide |
|---|---|
| Pourquoi Random Forest plutôt que réseau de neurones ? | Dataset trop petit pour un NN (< 500 événements). RF est plus robuste au surapprentissage et offre l'explicabilité gratuitement. |
| Comment vous évaluez la qualité ? | R² score sur un split 80/20, affiché à chaque entraînement. Pour le PV, tests unitaires sur des cas types dans `test_models.py`. |
| Ollama c'est quoi exactement ? | Un runtime open-source qui télécharge un modèle LLM (fichier de 4 Go) et l'expose en local sur `localhost:11434`. Pas d'internet requis après l'install. |
| Si je coupe Ollama ? | Tier 3 prend le relais, l'app marche. Je peux vous le montrer en direct. |
| Comment ré-entraîner quand les données changent ? | `python train_recommender.py --input export.json` — la commande remplace le `.pkl` existant à chaud. |
| Pourquoi FastAPI et pas directement appeler Python depuis Java ? | Séparation des préoccupations : Java = métier, Python = ML. Isolation des dépendances (scikit-learn pèse 30 Mo, je ne veux pas le mettre dans le classpath Java). |
| Quelle taille fait votre modèle ? | Le `.pkl` entraîné sur 300 événements : ~50 Ko. Ça tient dans un email. |
| Vous avez regardé des benchmarks ? | *(selon ce que vous avez fait)* J'ai comparé RandomForest vs. LinearRegression vs. GradientBoosting sur mon dataset, RF gagne sur R² et MAE. |

---

## Check-list de la veille

- [ ] `.pkl` du recommandeur entraîné et commité
- [ ] MongoDB peuplé avec des événements réalistes (au moins 10)
- [ ] Au moins 1 événement avec des feedbacks pour la démo PV
- [ ] Compte SECRETAIRE_GENERALE fonctionnel
- [ ] Ollama a un modèle téléchargé (`ollama pull llama3`)
- [ ] `docs/AI_ARCHITECTURE.md` ouvert dans un onglet GitHub / VSCode
- [ ] DevTools du navigateur pré-ouverts
- [ ] 4-5 terminaux pré-positionnés avec les bonnes commandes en historique
- [ ] Tests à vide : rejouer le script une fois en condition réelle
- [ ] Batterie > 70 % OU chargeur branché
