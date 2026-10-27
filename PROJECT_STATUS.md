# DoFirst (Todo4Columns) — État de la version 1.3 (étape 1 : étapes et séances)

> Mis à jour le 27/10/2026, branche `version-1.3.0` (créée depuis `version-1.2.1`). Numéro de version encore 1.2.1 dans `app.json`.
> Vérifié : 536 tests Jest (50 suites, fuseau Europe/Paris), `tsc --noEmit` (aussi sur chaque commit), `expo-doctor` (21/21) et prebuild Android dans une copie du projet.
> **Builds EAS :**
> - **Production 1.2.0** (versionCode 7, build `fde044da`) : ne contient ni les ajustements des rappels, ni le blocage d'AD_ID, ni la 1.2.1.
> - **APK de test 1.2.1** (profil `preview`, commit `ea7a7db`, versionCode 7 non incrémenté) : build `39ba178d-94ce-4b28-8f2a-8b65fd3d02b9`, installable hors Play Store.
> - **Aucun build de production 1.2.1**, et aucun build de la 1.3. Voir la liste de tests à la fin.

---

## 1. Résumé

DoFirst est une app de tâches fondée sur la **matrice d'Eisenhower**. Chaque tâche est rangée dans l'une des quatre cases à partir de deux questions (« C'est urgent ? », « C'est important ? ») :

| Clé enregistrée | Français | Anglais |
|---|---|---|
| `UI` | Faire | Do |
| `INU` | Planifier | Schedule |
| `UDI` | Déléguer | Delegate |
| `NDNI` | Si j'ai le temps | Someday |

Les données restent sur le téléphone, sans compte. L'app est en français et en anglais (langue du téléphone), avec un thème sombre. Publiée sur Android sous le package `com.saloum.sylla.matriceeisenhower`.

## 2. Historique

- **1.0.x** : un seul écran de quatre colonnes, en JavaScript, sans tests.
- **1.1** : réécriture en TypeScript avec expo-router (matrice 2×2, quadrants, fiche de tâche, réglages). Rappels par quadrant avec notifications et actions « Fait », « Reporter 1 h » et « Ouvrir ». Plage silencieuse, archivage, célébrations, migration des anciennes données et récupération des tâches de l'ancienne app, nouveau nom DoFirst. S'y ajoute un audit de performance : R8, `shrinkResources`, polices intégrées, contexte découpé.
- **1.2** :
  - aide intégrée ;
  - équilibre et bilan ;
  - revue hebdomadaire et priorités ;
  - journal des fins de tâches ;
  - escalade et bascule des tâches en retard ;
  - tâches récurrentes ;
  - délégation par message ;
  - sauvegarde (export, import, annulation du dernier import).
- **1.3** (cette branche), étape 1 : étapes des tâches, « Répartir sur plusieurs jours », rappels d'étape.
- **1.2.1** :
  - demande d'avis dans l'app (fenêtre officielle de Google Play) ;
  - Réglages › À propos : noter, partager, suggérer une idée, version ;
  - `useTasks` découpé en hooks dédiés, code dupliqué mis en commun ;
  - règles de confidentialité ; permission AD_ID bloquée.

## 3. Stack technique

| Élément | Valeur |
|---|---|
| Expo SDK | 57 (`expo` ~57.0.31), nouvelle architecture |
| React Native / React | 0.86.3 / 19.2.3, Hermes |
| Langage | TypeScript strict |
| Navigation | expo-router (pile : matrice, quadrant, fiche en formSheet, réglages, aide, bilan, revue) |
| État | `useTasks` + `TasksContext` découpé en trois (tâches et journal par sélecteur, actions à identité fixe, réglages par sélecteur) |
| Stockage | AsyncStorage |
| Animations / gestes | Reanimated 4, Worklets, Gesture Handler |
| Tests | Jest (jest-expo), React Native Testing Library |

Modules Expo : `expo-notifications`, `expo-localization`, `expo-haptics`, `expo-font`, `expo-splash-screen`, `expo-router`, `expo-linking`, `expo-constants`, `expo-dev-client`, `expo-build-properties`, `expo-file-system`, `expo-sharing`, `expo-store-review` (1.2.1). Plus `@react-native-community/datetimepicker`, `@expo/vector-icons` (Ionicons) et `@expo-google-fonts/manrope`.

## 4. Organisation du code

```
app/                    Écrans (expo-router)
  _layout.tsx           Fournisseurs, réponses aux notifications, présentation, message de bascule
  index.tsx             Matrice, carte « Ta semaine », bandeau « Bientôt urgentes »
  quadrant/[category]   Liste d'un quadrant (FlatList)
  task.tsx              Fiche de création / modification
  settings.tsx          Réglages
  help.tsx              « Comment ça marche »
  balance.tsx           Bilan
  review.tsx            Revue de la semaine
src/
  hooks/useTasks.ts     État des tâches et actions, assemblé à partir des hooks dédiés :
    useCompletionLog (journal), useTaskSaving (sauvegarde), useNotificationSync
    (notifications), useTimers (minuteurs), useEscalation (bascule),
    useRecurrence (fin, réouverture, occurrence suivante), useForeground
  store/                Contexte découpé et magasin à sélecteurs
  notifications/        Calcul, programmation, réconciliation, réponses
  migrations.ts         Schémas v1 → v7 ;  storage.ts  chargement et sauvegarde
  recovery.ts           Récupération des tâches de l'ancienne app (à ne pas modifier)
  balance.ts, completionLog.ts, review.ts, recurrence.ts, backup.ts, delegation.ts
  reviewPrompt.ts       Conditions de la demande d'avis ; community.ts  liens « À propos »
  guards.ts             isRecord, CATEGORY_KEYS (recovery.ts garde ses propres copies)
  components/           Cartes, formulaires, InfoButton, présentation…
  i18n/fr.ts, en.ts     Tous les textes (mêmes clés, vérifié par test)
store/                  Fiches Play Store, notes de version, règles de confidentialité
```

## 5. Données enregistrées (AsyncStorage)

| Clé | Contenu |
|---|---|
| `TASKS_4COLS` | Tâches, schéma **v7** (`{ schemaVersion, tasks }`) |
| `TASKS_4COLS_BACKUP_V1` … `V6` | Copie du format d'origine, écrite une seule fois avant chaque migration |
| `TASKS_4COLS_CORRUPT_<date>` | Contenu illisible mis de côté |
| `TASKS_4COLS_RECOVERY_DONE`, `TASKS_4COLS_RECOVERY_LOG` | Récupération des anciennes tâches |
| `SETTINGS` | Réglages (schéma 1, champs ajoutés avec valeurs par défaut ; en 1.2.1, `firstUseAt` et `reviewAskedAt` optionnels pour la demande d'avis) |
| `COMPLETION_LOG` | Journal `{ date, catégorie }` des tâches terminées, 26 semaines |
| `WEEKLY_REVIEW_LOG` | Semaines où une revue a été faite |
| `BACKUP_BEFORE_IMPORT` | Copie des données avant le dernier import |
| `LAST_HANDLED_NOTIFICATION_RESPONSE` | Dernière réponse de notification appliquée |

Champs ajoutés aux tâches en 1.2 :
- **v5 :** `completedAt`, `priorityWeek`.
- **v6 :** `recurrence`, `nextOccurrenceId`, `escalationSkippedFor`.
- **v7 (1.3) :** `steps`, liste de `{ id, title, done, doneAt, day (« 2026-10-27 », facultatif), time (« 14:30 », facultatif) }`, vide par défaut.

Les trois champs optionnels (`completedAt`, `priorityWeek`, `nextOccurrenceId`) ne sont pas renseignés par la récupération, qui n'a pas été modifiée.

## 6. Fonctionnalités

**Matrice et quadrants**
- Grille 2×2 avec aperçu de chaque case.
- Cartes : glisser à droite pour terminer, à gauche pour supprimer, « Annuler » pendant 5 s.
- Menu « … » : déplacer, minuteur.
- Section « Terminées ».

**Rappels**
- Faire : relance répétable.
- Planifier : échéance et rappel.
- Déléguer : relance de la personne, échéance facultative.
- Plage silencieuse ; limite iOS de 64 notifications respectée (avec une place réservée à la revue).
- Actions des notifications : « Fait », « Reporter 1 h », « Ouvrir », et « Relancer » pour les tâches confiées. Chaque bouton ouvre l'app (une app arrêtée ne recevrait pas l'action sinon).
- Plage silencieuse : une seule relance à sa fin, les suivantes réespacées d'un intervalle.

**Escalade**
- « Bientôt urgente » quand une échéance de « Planifier » arrive dans moins de 48 h, avec un bandeau sur la matrice et une suggestion dans la fiche.
- Bascule automatique en « Faire » à l'échéance, puce « En retard », message avec « Annuler » ; désactivable.

**Récurrence** (dans « Planifier »)
- Chaque jour, jours de semaine, chaque semaine (jours au choix), chaque mois, chaque année.
- L'occurrence suivante est créée quand on termine la précédente, sans rattrapage.
- Cas limites gérés : 31 du mois, 29 février, changement d'heure.

**Équilibre**
- Carte « Ta semaine » (7 derniers jours).
- Bilan : semaine en cours et 4 semaines précédentes, lus dans le journal.

**Revue de la semaine**
- Notification hebdomadaire (dimanche 18 h par défaut, réglable).
- Trois étapes : « Si j'ai le temps », jusqu'à 3 priorités étoilées, tâches confiées. Puis célébration et série de semaines.

**Étapes** (1.3)
- Fiche : section « Étapes » : ajouter, renommer, cocher, supprimer, réordonner (appui long sur la poignée puis glisser, place calculée sur les positions mesurées ; « Monter » / « Descendre » sur la poignée pour TalkBack), jour prévu (Aucun / Aujourd'hui / Demain / Date) et heure du rappel. « Aujourd'hui » après l'heure du rappel : rappel à l'heure pleine suivante, avec « Rappel aujourd'hui à 15:00 ». Une coche faite ailleurs pendant que la fiche est ouverte n'est pas écrasée.
- « Répartir sur plusieurs jours » : 2 à 14 séances de 30 min, 1 h ou 2 h, à partir d'aujourd'hui ou de demain, week-ends sautés au choix ; aperçu avant de créer « Séance 1/5 · 1 h »…
- Carte : « 2/5 », « Aujourd'hui : … » et « En retard : … », à cocher depuis la carte avec « Étape cochée » et « Annuler » (dernière étape : « Terminer » puis « Tâche terminée » et « Annuler »). Grille : « 2/5 » à côté du titre.
- Rappel le jour prévu (à l'heure de l'étape, 9:00 par défaut), dans tous les quadrants, avec « Fait » et « Reporter à demain » ; plage silencieuse et plafond de 64 respectés.
- Étape cochée dans la fiche : coche animée, ligne brièvement surlignée en vert et vibration légère (sans fondu ni rebond si « Réduire les animations » est activé). Depuis la carte ou un rappel : célébration discrète (message « Étape faite ! », vibration légère). Dernière étape : « Terminer la tâche ? », puis célébration complète.
- Le journal ne compte que les tâches terminées. L'occurrence suivante d'une tâche récurrente reprend les étapes, décochées et sans jour.

**Délégation**
- « Envoyer à Marie » et « Relancer » ouvrent le partage natif avec un message prêt, sans accès aux contacts.

**Sauvegarde**
- Export JSON via le partage.
- Import avec vérification, aperçu, confirmation et copie de secours.
- « Annuler le dernier import ».
- Sauvegarde automatique Android (`allowBackup`).

**Aide**
- Présentation en 3 écrans au premier lancement.
- Icônes « i » avec cartes d'explication.
- Page « Comment ça marche ».

**Réglages**
- Rappels par défaut, plage silencieuse, notifications, revue, bascule en retard.
- Célébrations, archivage, sauvegarde, aide.
- À propos : « Noter DoFirst » (fiche Play Store), « Partager DoFirst » (partage natif avec le lien), « Suggérer une idée / signaler un problème » (e-mail prérempli avec les versions de l'app et d'Android), numéro de version.

**Demande d'avis** (1.2.1)
- Fenêtre officielle de Google Play (`expo-store-review`), sans quitter l'app.
- Après la fin d'une revue de la semaine, ou une tâche terminée dès la 10e (journal des fins de tâches).
- Jamais pendant les 3 premiers jours, au plus une fois tous les 90 jours, jamais dans les 30 s après un « Annuler » (tâche, bascule, import), jamais par-dessus une célébration (attend sa fin).
- Première utilisation inconnue (réglages d'avant la 1.2.1) : estimée par la plus ancienne tâche ou fin de tâche.
- Google décide seul d'afficher ou non la fenêtre (quota) : l'app ne sait pas si elle est apparue.

## 7. Publication

| Élément | Valeur |
|---|---|
| Version | **1.2.1** (`app.json`, `package.json`) |
| versionCode | Géré par EAS (`appVersionSource: remote`, `autoIncrement`), absent d'`app.json` |
| Package Android | `com.saloum.sylla.matriceeisenhower` |
| R8 / shrinkResources | Activés (`expo-build-properties`), règles keep pour gesture-handler, AsyncStorage, expo-localization |
| Polices | Manrope (5 graisses) intégrées au build Android |
| Fiche Play Store | `store/listing-fr.md`, `store/listing-en.md` |
| Notes de version | `store/release-notes-fr.txt`, `store/release-notes-en.txt` (encore celles de la 1.2.0) |
| Règles de confidentialité | `store/privacy-policy-fr.md`, `store/privacy-policy-en.md` (à publier à une adresse publique pour la Play Console) |

**Permissions du manifeste final**
- **Attendues :** `INTERNET`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` et `POST_NOTIFICATIONS` (expo-notifications).
- **Retirées :** `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` et `com.google.android.gms.permission.AD_ID`, via `android.blockedPermissions`.

Le prebuild montre ces directives de retrait ; la fusion finale des manifestes n'a lieu qu'au build.

## 8. Points ouverts

- **Tests sur téléphone :** ils restent à faire (liste ci-dessous), en particulier ce que seul un vrai build vérifie : R8, `shrinkResources`, polices intégrées et notifications.
- **Poids natif :** non mesuré sans build. Il faut comparer l'AAB 1.2.0 à celui de la 1.1.
- **iOS :** il n'est ni configuré (pas de `bundleIdentifier`) ni testé. Les polices y sont encore chargées au lancement.
- **Copie de secours d'import :** une seule, celle du dernier import.
- **Adresse de contact :** `sylldevlearning@gmail.com` dans `src/community.ts` et les deux règles de confidentialité.
- **Acceptés sans correction (revue de la 1.3, étape 1) :**
  - **Demande d'avis sur un APK de test :** installée hors Play Store, l'app enregistre `reviewAskedAt` alors que Google n'affiche rien ; la demande est ensuite bloquée 90 jours. Sans effet en production.
  - **Étape au titre vidé :** elle disparaît à l'enregistrement de la fiche, sans avertissement.
- **Coche faite ailleurs pendant que la fiche est ouverte :** gardée ; en revanche un jour reporté ailleurs (« Reporter à demain ») est remplacé par celui de la fiche à l'enregistrement.

### Dette technique

- **Réglée en 1.2.1 :** `useTasks` découpé en hooks dédiés ; `isRecord`, `CATEGORY_KEYS`, `selectCompletions`, `isForeground` et `METRICS` (tests) mis en commun ; `Escalation.at` supprimé.
- **Reste :** `TaskForm.tsx` (près de 700 lignes) et `app/review.tsx` (plus de 500) gagneraient à être découpés. `recovery.ts` garde ses copies d'`isRecord` et `CATEGORY_KEYS` (fichier à ne pas modifier).

## 9. Reste à vérifier sur téléphone (dans l'ordre)

Avec le build de production (R8 actif), installé **par-dessus** la version publiée.

1. **Récupération et mise à jour**
   - Par-dessus une ancienne version 1.0.x (si disponible) : les anciennes tâches sont récupérées.
   - Par-dessus la 1.1 du Play Store : tâches et réglages conservés, aucune tâche en double.
   - La présentation s'affiche une seule fois.
   - « Ta semaine » reprend les tâches déjà terminées.
2. **Build R8 / shrinkResources**
   - Lancement sans plantage, sur tous les écrans : matrice, quadrant, fiche, réglages, aide, bilan, revue.
   - Glissements, défilement, fiche en formSheet.
   - Sélecteurs de date et d'heure, retours haptiques.
   - Icône de l'app, icône adaptative et monochrome, écran de démarrage, icône des notifications.
3. **Polices** : les 5 graisses de Manrope partout, sans police système ; l'écran de démarrage disparaît vite.
4. **Notifications**
   - Autorisation : fenêtre système au premier rappel activé (tâche, relance, revue hebdomadaire) ; après des refus répétés, carte « Les notifications sont désactivées… » avec « Ouvrir les réglages » et « Plus tard ». La tâche est bien enregistrée malgré le refus.
   - Retour des réglages du téléphone après avoir autorisé DoFirst : la carte se ferme et les rappels arrivent.
   - Réglages › Notifications : « activées / désactivées » et le bon bouton.
   - « Faire » : relance avec « Fait », « Reporter 1 h » et « Ouvrir », app ouverte, en arrière-plan et **arrêtée** (balayée des apps récentes) : chaque bouton ouvre l'app et l'action est appliquée.
   - « Planifier » : rappel puis échéance.
   - « Déléguer » : relance avec « Fait », « Relancer » et « Reporter 1 h ».
   - Plage silencieuse désactivée sur une installation neuve, toujours active après une mise à jour depuis la 1.1.
   - Plage silencieuse respectée : relances répétées pendant la nuit, une seule à 8 h puis les suivantes espacées.
   - Fiche : ligne « Ce rappel tombe dans ta plage silencieuse… ». **« Modifier la plage » ouvre les Réglages par-dessus la fiche** (à vérifier : la fiche est une feuille native) et le retour ramène à la fiche intacte ; « Désactiver la plage » fait disparaître la ligne.
   - Pas de rappel en double après la mise à jour.
   - Rappels encore programmés après un redémarrage du téléphone.
5. **Célébrations**
   - Confettis et message en terminant une tâche.
   - Réglage désactivé : simple vibration.
   - « Réduire les animations » du téléphone respecté.
6. **Présentation et aide**
   - « Passer », « Suivant », « Revoir la présentation ».
   - Cartes « i » fermées par appui à côté et bouton retour.
   - **Glissement vers le bas** d'une carte « i » : elle se ferme au-delà d'un court glissement, revient en place sinon (les tests automatiques ne vérifient que le seuil, pas le geste).
   - « Comment ça marche ».
   - Labels lus par TalkBack.
7. **Équilibre et revue**
   - Carte « Ta semaine » et bilan.
   - Notification de revue à l'heure choisie : la régler quelques minutes plus tard pour tester. Un appui ouvre la revue.
   - Les 3 étapes, puis célébration et série.
   - Les étoiles apparaissent et disparaissent la semaine suivante.
8. **Récurrence**
   - Terminer une tâche hebdomadaire : occurrence suivante créée et ses rappels programmés.
   - « Annuler » et « Arrêter de répéter ».
   - Tâche mensuelle le 31.
9. **Escalade et bascule**
   - « Bientôt urgente » : puce, bandeau, suggestion dans la fiche.
   - Échéance passée app ouverte : bascule, message, « Annuler ».
   - Échéance passée app fermée : bascule à la réouverture.
   - À la mise à jour depuis la 1.1 : les tâches « Planifier » déjà en retard **ne** basculent **pas** ; le message de bascule n'apparaît jamais par-dessus la présentation.
   - Tâche remise à la main dans « Planifier » avec une échéance passée : elle y reste.
   - Réglage désactivé : pas de bascule.
10. **Sauvegarde**
    - Export vers Drive ou un mail.
    - **Import d'un fichier choisi dans Drive** (lecture réelle du fichier via le sélecteur du système : non couverte par les tests automatiques).
    - Le fichier exporté a disparu du cache au lancement suivant.
    - Fichier invalide refusé.
    - « Annuler le dernier import ».
    - Aucune demande de permission de stockage.
11. **Délégation**
    - « Envoyer à Marie » par SMS ou WhatsApp.
    - « Relancer » depuis la notification (app fermée et en arrière-plan) et depuis la revue.
12. **Anglais** : téléphone en anglais. Tous les écrans, les boutons de notification et le nom de fichier de la sauvegarde.
13. **Demande d'avis** (1.2.1) : la fenêtre de Google ne s'affiche que pour une app installée depuis le Play Store (piste de test interne comprise), et Google limite sa fréquence.
    - Après une revue de la semaine terminée, une fois les confettis finis.
    - Sur un compte de test, la fenêtre peut ne pas apparaître du tout : vérifier seulement l'absence de plantage.
14. **À propos** (1.2.1)
    - « Noter DoFirst » ouvre la fiche dans l'app Play Store.
    - « Partager DoFirst » : message et lien corrects dans SMS ou WhatsApp.
    - « Suggérer une idée » : Gmail s'ouvre avec l'adresse, l'objet et les versions de l'app et d'Android.
    - Numéro de version affiché : 1.2.1.
15. **Étapes** (1.3)
    - Appui long sur la poignée puis glisser une étape dans la fiche (feuille native) : la ligne suit le doigt et prend sa place au lâcher, y compris avec le jour d'une étape ouvert ; le défilement de la fiche reste possible ; un appui long sur le titre sélectionne le texte.
    - TalkBack : la poignée annonce « Déplacer « … » » et propose « Monter » / « Descendre ».
    - Fiche longue, clavier ouvert : « Nouvelle étape » et les titres des étapes restent visibles au-dessus du clavier.
    - « Aujourd'hui » choisi après 9:00 : ligne « Rappel aujourd'hui à 15:00 » et rappel reçu à cette heure.
    - Choix « Date » : calendrier natif ; heure du rappel.
    - « Répartir sur plusieurs jours » : aperçu, week-ends sautés, création.
    - Rappel d'étape à 9:00 avec « Fait » et « Reporter à demain », app ouverte, en arrière-plan et arrêtée.
    - Cocher une étape dans la fiche : coche animée, ligne surlignée en vert, vibration ; avec « Réduire les animations », vert affiché sans fondu.
    - Cocher la dernière étape dans la fiche : « Terminer la tâche ? » puis la fiche se ferme et les confettis partent.
    - Carte : « Aujourd'hui : … » à cocher, puis « Étape cochée » et « Annuler » ; « En retard : … » en rouge ; grille « 2/5 ».
    - Demande d'avis : jamais juste après avoir ouvert l'app depuis une notification, ni par-dessus la fiche, une alerte, la carte d'autorisation ou le message de bascule.
16. **Poids et batterie**
    - Taille de l'AAB comparée à la 1.1.
    - App en arrière-plan : pas de réveils inutiles.
