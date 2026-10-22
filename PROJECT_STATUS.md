# Todo4Columns — État des lieux

> Analyse réalisée le 22/10/2026 sur le commit `5cac822` (branche `master`, dépôt https://github.com/sylldevlearning/Todo4Columns).
> Source : lecture complète du code et de la configuration. **L'app n'a pas été testée sur un appareil réel lors de cette analyse** (aucun téléphone ni émulateur disponible) : seuls la compilation du bundle Android, `expo-doctor` (21/21) et `tsc --noEmit` ont été vérifiés.

---

## 1. Résumé

Todo4Columns est une application mobile de gestion de tâches basée sur la **matrice d'Eisenhower** (« MATRICE » dans l'en-tête). L'utilisateur range chaque tâche dans l'une des quatre catégories urgent/important, affichées sous forme de quatre colonnes défilant horizontalement. Il peut cocher une tâche comme terminée, la supprimer, et lui associer un compte à rebours en minutes qui déclenche une alerte à son expiration. Les données sont stockées localement sur le téléphone, sans compte ni synchronisation.

---

## 2. Stack technique

| Élément | Valeur |
|---|---|
| Expo SDK | **57** (`expo` 57.0.31) |
| React Native | **0.86.3** (nouvelle architecture, désormais obligatoire) |
| React | **19.2.3** |
| TypeScript | **Oui** (`typescript` 6.0.3, `strict: true`), un seul fichier `App.tsx` |
| Navigation | **Aucune** (un seul écran, pas de React Navigation ni d'Expo Router) |
| Gestion d'état | `useState` / `useRef` locaux dans le composant `App`, sans contexte, Redux ou Zustand |
| Stockage | **AsyncStorage** (clé unique `TASKS_4COLS`, JSON) |
| Tests / lint | Aucun (ni Jest, ni ESLint, ni Prettier) |

### Dépendances (`package.json`, versions installées)

| Paquet | Version | Utilisé dans le code ? |
|---|---|---|
| `expo` | 57.0.31 | Oui (`index.js` → `registerRootComponent`) |
| `react` | 19.2.3 | Oui |
| `react-native` | 0.86.3 | Oui |
| `@react-native-async-storage/async-storage` | 2.2.0 | Oui (persistance) |
| `expo-constants` | 57.0.22 | Oui (`Constants.statusBarHeight`) |
| `expo-splash-screen` | 57.0.10 | Oui, via le plugin de config dans `app.json` |
| `expo-notifications` | 57.0.23 | **Non**, jamais importé |
| `expo-screen-orientation` | 57.0.3 | **Non**, jamais importé |
| `expo-status-bar` | 57.0.1 | **Non**, jamais importé |

Dev : `typescript` 6.0.3, `@types/react` 19.2.18, `@babel/core` 7.29.7.

---

## 3. Arborescence

```
Todo4Columns/
├── App.tsx              # Toute l'application : types, logique, UI et styles (575 lignes)
├── index.js             # Point d'entrée : enregistre App via registerRootComponent
├── app.json             # Configuration Expo (nom, version, icône, package Android, splash)
├── eas.json             # Profils de build/soumission EAS
├── package.json         # Dépendances et scripts (start / android / ios / web)
├── package-lock.json    # Verrouillage npm
├── tsconfig.json        # Config TypeScript (étend expo/tsconfig.base)
├── .gitignore           # Ignore node_modules, .expo, builds, clés de signature…
└── assets/
    ├── icon.png             # Icône de l'app (matrice 4 cases, fond sombre), 1,2 Mo
    ├── adaptive-icon.png    # Image Expo par défaut, non référencée dans app.json
    ├── splash-icon.png      # Image Expo par défaut (identique à adaptive-icon.png)
    └── favicon.png          # Favicon web
```

Aucun dossier `src/`, `components/` ou `screens/` : tout le code applicatif est dans `App.tsx`.

---

## 4. Fonctionnalités existantes

L'app comporte **un seul écran**, de haut en bas :

**En-tête**
- Titre « MATRICE » et sous-titre « eiseinoeur ».

**Zone de création**
- Choix de la catégorie via 4 boutons : `U-I`, `NU-I`, `U-NI`, `NU-NI` (U-I sélectionné par défaut).
- Saisie du titre dans un champ texte « Nouvelle tâche… ».
- Bouton **AJOUTER** : crée la tâche dans la catégorie choisie. Un titre vide (ou fait uniquement d'espaces) est ignoré sans message.

**Quatre colonnes (défilement horizontal, chacune défilable verticalement)**
- « Urgent + Important » (UI)
- « Important + Non-urgent » (INU)
- « Urgent + Déléguer » (UDI)
- « Ni Urgent ni Important » (NDNI)

Pour chaque tâche, l'utilisateur peut :
- **Cocher / décocher** (⬜️ / ✅) : le texte d'une tâche terminée est barré, grisé et en italique.
- **Lancer un minuteur** (⏱️) : une fenêtre superposée demande une durée en minutes (entier > 0, sinon alerte « Durée invalide »). Le temps restant s'affiche sous la tâche au format `MM:SS`. À l'expiration, une alerte « Temps écoulé » s'affiche et le minuteur est retiré. Relancer le minuteur remplace l'ancien.
- **Supprimer** (✕) : une confirmation est demandée (« Annuler » / « SUPPRIMER »).

**Persistance**
- Les tâches sont rechargées au démarrage et sauvegardées à chaque changement. Un minuteur en cours survit à la fermeture de l'app (date de fin stockée). L'alerte s'affiche cependant **seulement quand l'app est ouverte** : il n'y a pas de notification système.

**Non disponible** : modifier le titre d'une tâche, la déplacer d'une colonne à l'autre, la réordonner, supprimer toutes les tâches terminées, rechercher, mettre en pause un minuteur.

---

## 5. Modèle de données

```ts
type Category = "UI" | "INU" | "UDI" | "NDNI";

interface Task {
  id: string;              // Date.now().toString() à la création
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp (ms) de fin du minuteur, ou null
}
```

- Toutes les tâches sont dans un seul tableau `allTasks`, filtré par catégorie à l'affichage.
- La sauvegarde utilise `AsyncStorage.setItem("TASKS_4COLS", JSON.stringify(allTasks))`, déclenchée par un `useEffect` sur `allTasks`.
- Le chargement utilise `AsyncStorage.getItem("TASKS_4COLS")` puis `JSON.parse`, sans validation du format ni versionnage du schéma.
- Les erreurs sont seulement journalisées (`console.warn`), sans retour visible pour l'utilisateur.

---

## 6. Configuration de publication

### `app.json`

| Champ | Valeur |
|---|---|
| `name` | Todo4Columns |
| `slug` | Todo4Columns |
| `version` | **1.0.5** (alors que `package.json` indique **1.0.4**) |
| `orientation` | portrait |
| `userInterfaceStyle` | light (alors que l'interface est entièrement sombre) |
| `android.package` | `com.saloum.sylla.Todo4Columns` |
| `ios.bundleIdentifier` | **Absent** |
| `ios.supportsTablet` | true |
| `android.versionCode` / `ios.buildNumber` | **Absents** du fichier : gérés à distance par EAS (`appVersionSource: "remote"`) |
| `android.adaptiveIcon` | **Absent** |
| Splash | Plugin `expo-splash-screen` : `splash-icon.png`, fond `#ffffff`, largeur 200 |
| EAS `projectId` | `9c064a91-0d49-4533-91fb-8b1e63760b97` |

### `eas.json` (présent)

- `cli.version` ≥ 15.0.10, `appVersionSource: "remote"`.
- Profils de build :
  - `development` : `developmentClient: true`, distribution interne. **`expo-dev-client` n'est pas installé**, donc ce profil ne fonctionnera pas en l'état.
  - `preview` : distribution interne.
  - `production` : `autoIncrement: true`.
- `submit.production` : vide.

**Non vérifié** : la valeur actuelle du `versionCode` côté serveurs EAS, l'existence de builds passés, une éventuelle publication sur le Play Store ou l'App Store, et l'état des identifiants de signature.

---

## 7. Points faibles

### Bugs et comportements problématiques
1. **Sauvegarde et re-rendu toutes les secondes, en permanence.** Le `setInterval` d'une seconde fait `prev.map(...)`, ce qui crée un nouveau tableau à chaque tick même sans minuteur actif. Résultat : un re-rendu complet de l'écran **et une écriture AsyncStorage chaque seconde** tant que l'app est ouverte, ce qui coûte de la batterie et des écritures disque. L'affichage du compte à rebours dépend d'ailleurs de cet effet de bord.
2. **Effet de bord dans un updater d'état.** `Alert.alert` est appelé à l'intérieur de `setAllTasks(prev => ...)`. React peut exécuter un updater deux fois (StrictMode, rendu concurrent), et l'alerte risque alors d'apparaître en double. Si plusieurs minuteurs expirent en même temps, plusieurs alertes s'empilent.
3. **Risque d'écrasement des données au démarrage.** L'effet de sauvegarde s'exécute au premier rendu avec `allTasks = []`, en parallèle du chargement. Si l'écriture passait avant la lecture, les tâches seraient effacées. Je n'ai pas reproduit ce cas, mais rien dans le code ne l'empêche (pas de drapeau « chargé »).
4. **Aucune notification réelle.** Le minuteur ne prévient pas l'utilisateur si l'app est en arrière-plan ou fermée, alors que `expo-notifications` est installé.
5. **Fenêtre du minuteur « maison ».** C'est une `View` en position absolue, pas un `Modal` : le bouton retour Android ne la ferme pas, et sur Android elle peut passer sous le clavier (`KeyboardAvoidingView` sans `behavior`).
6. **Libellés incohérents.** La catégorie `UDI` s'appelle « Urgent + Déléguer » dans la colonne mais `U-NI` sur le bouton. Les clés (`INU`, `UDI`, `NDNI`) ne suivent pas la même logique que les libellés (`NU-I`, `U-NI`, `NU-NI`). Le sous-titre « eiseinoeur » semble être une coquille pour « Eisenhower ».
7. **Format du minuteur.** `MM:SS` sans heures : 150 minutes s'affichent « 150:00 ». Une durée décimale (« 1.5 ») est tronquée à 1 sans avertissement (`parseInt`).

### Code mort / dépendances inutiles
- `expo-notifications`, `expo-screen-orientation` et `expo-status-bar` sont installés mais jamais importés.
- `assets/adaptive-icon.png` n'est référencé nulle part.
- `intervalRef` n'est utilisé que pour le nettoyage de l'effet ; une variable locale suffirait.
- La liste des catégories et leurs libellés sont dupliqués à plusieurs endroits de `App.tsx`.

### Dépendances / API obsolètes
- `SafeAreaView` importé depuis `react-native` est déprécié ; l'alternative est `react-native-safe-area-context`. Il est en plus combiné à un `paddingTop: Constants.statusBarHeight`, ce qui risque un double espacement en haut sur iOS (non vérifié sur appareil).
- `npm install` signale 39 vulnérabilités (1 critique, 29 hautes). Je n'ai pas analysé en détail lesquelles concernent l'app livrée plutôt que les outils de développement.

### UX / design
- **L'écran de démarrage affiche l'image Expo par défaut** (grille et cercles gris) sur fond blanc, ce qui détonne avec le thème sombre de l'app.
- L'icône Android n'a pas d'`adaptiveIcon` : le carré arrondi de `icon.png` risque d'être affiché réduit ou recadré par le launcher (non vérifié visuellement).
- `icon.png` pèse 1,2 Mo, ce qui est lourd pour une icône.
- `SPACING` vaut `Constants.statusBarHeight` : toutes les marges dépendent donc de la hauteur de la barre d'état, qui varie selon l'appareil. La mise en page n'est pas cohérente d'un téléphone à l'autre.
- La largeur des colonnes est calculée une seule fois via `Dimensions.get` et ne réagit pas aux changements de taille (tablette, écran pliable, multi-fenêtre).
- Accessibilité : les boutons sont des emojis sans `accessibilityLabel`, et les zones tactiles sont petites (✕, ⏱️).
- La touche « Entrée » du clavier n'ajoute pas la tâche (pas de `onSubmitEditing`).
- Aucun état vide (« Aucune tâche ») dans les colonnes.

### Qualité / maintenabilité
- Tout est dans un seul fichier de 575 lignes : logique, UI et styles mélangés.
- **Aucun test**, aucun lint, aucune CI.
- Versions divergentes entre `package.json` (1.0.4) et `app.json` (1.0.5).
- Pas de README.

---

## 8. Pistes d'amélioration pour une nouvelle version

**Corrections prioritaires**
1. Ne mettre à jour l'état que si un minuteur expire réellement, et isoler l'affichage du compte à rebours dans un petit composant avec son propre intervalle. Cela supprime les écritures et re-rendus inutiles chaque seconde.
2. Sortir `Alert.alert` de l'updater d'état.
3. Ajouter un drapeau `isLoaded` pour ne sauvegarder qu'après le chargement initial.
4. Utiliser `expo-notifications` pour programmer une notification locale à `timerEnd`, afin que le minuteur fonctionne app fermée. Sinon, retirer la dépendance.
5. Remplacer la fenêtre maison par `Modal`, et passer à `react-native-safe-area-context`.

**Fonctionnalités**
- Modifier une tâche et la déplacer entre colonnes, par glisser-déposer ou via un menu.
- Réordonner les tâches, et supprimer d'un coup les tâches terminées.
- Afficher la matrice en grille 2×2 (plus fidèle à Eisenhower) en option, à la place du défilement horizontal.
- Ajouter des dates d'échéance, et éventuellement des rappels récurrents.
- Proposer un export / import ou une sauvegarde cloud.

**Publication**
- Remplacer `splash-icon.png` et configurer `android.adaptiveIcon` avec de vrais visuels, et alléger `icon.png`.
- Passer `userInterfaceStyle` à `dark` (ou `automatic` avec un thème clair).
- Ajouter `ios.bundleIdentifier` si une version iOS est prévue.
- Installer `expo-dev-client` ou retirer le profil `development`.
- Aligner les versions entre `package.json` et `app.json`.

**Code**
- Découper en `types.ts`, `storage.ts`, `components/` (Column, TaskItem, TimerModal) et un hook `useTasks`.
- Centraliser les catégories dans une seule constante (clé, libellé court, titre, couleur).
- Supprimer les dépendances inutilisées.
- Ajouter ESLint, des tests Jest et React Native Testing Library sur la logique (ajout, suppression, minuteur, persistance), et une CI GitHub Actions.
