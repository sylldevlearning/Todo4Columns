# DoFirst (Todo4Columns) — État de la version 1.6.0

> Mis à jour le 11/11/2026. **1.6.0 soumise à l'examen** (synchronisation Google Drive, widgets Android, thème clair) : branche `version-1.6.0` fusionnée dans `master`, tag `v1.6.0` (branches gardées).
> **En production :** 1.6.0 (versionCode 12) soumise à l'examen le 11/11/2026 par `release:ship` (production 100 %, 14 fiches avec la synchronisation, les widgets et le thème clair, notes dans les 14 langues) ; relu par l'API : production `1.6.0 [12] completed`, 14 descriptions identiques aux fichiers. Précédente : 1.5.0 (versionCode 11). Avant chaque promotion : `node scripts/check-aab.mjs <app.aab>` (widgets et permissions).
> Revue de la synchronisation faite et ses 10 points corrigés. Vérifié : 962 tests Jest (67 suites), `tsc --noEmit`, `expo-doctor` 21/21, prebuild Android dans une copie (3 récepteurs de widgets, thème DayNight, écran de démarrage clair et sombre, aucune permission demandée en plus au prebuild). Bundle JS Android : 5 614 778 → 5 649 154 octets (+34 Ko : widgets +6,6 Ko, thème +27,7 Ko).
> **Test interne : 1.6.0 (versionCode 12)**, build de production du 11/11/2026 envoyé par EAS (`--auto-submit`), notes 1.6.0 des 14 langues envoyées (`release:notes -- --apply`). Permissions réelles (manifeste fusionné de l'AAB, comparé à la 1.5.0) : aucune permission demandée en plus ; `WAKE_LOCK` et `ACCESS_NETWORK_STATE` étaient déjà présentes ; `FOREGROUND_SERVICE` absente (bloquée) ; seule nouveauté, `BIND_REMOTEVIEWS`, qui protège le service des widgets (non demandée par l'app). Testée sur téléphone : OK ; soumise à l'examen le 11/11/2026.
> 1.5.0 : branche `version-1.5.0` fusionnée dans `master`, tag `v1.5.0` (branches de version gardées).
> Vérifié (10/11/2026) : 776 tests Jest (60 suites, fuseau Europe/Paris), 5 tests des scripts Play (`npm run test:scripts`), `tsc --noEmit`, `expo-doctor` 21/21, prebuild Android dans une copie du projet (versionName 1.5.0 ; permission ajoutée : `RECORD_AUDIO`, plus `<queries>` vers le service de reconnaissance de Google). Bundle JS Android : 4 978 805 → 5 378 363 octets (+390 Ko, +8 %, surtout chrono-node) ; natif : module Kotlin d'expo-speech-recognition (~1 900 lignes, sans dépendance native).
> **En production :** 1.5.0 (versionCode 11) soumise à l'examen le 09/11/2026 par `release:ship` (production 100 %, 14 fiches avec 7 captures chacune, Sécurité des données) ; relu par l'API : production `1.5.0 [11] completed`, 14 fiches, 7 captures par langue. Précédente : 1.4.1 (versionCode 9).
> **Google Cloud (projet `matrice-deisenhower`, compte csgonesse@gmail.com) :** API Google Drive activée ; écran de consentement « DoFirst » (scope `drive.appdata` seul, classé non sensible), règles https://sylldevlearning-legal.vercel.app/dofirst/privacy, domaine autorisé `sylldevlearning-legal.vercel.app` ; deux clients OAuth Android pour `com.saloum.sylla.matriceeisenhower` : clé d'importation EAS (`BD:20:F7:8A…`, client existant « Client Android 1 ») et clé de signature Play (`D7:7B:86:3C…`, « DoFirst Android (clé de signature Play) »). Pas de client Web (la librairie n'en a pas besoin pour un jeton d'accès). **Application OAuth publiée (« En production ») le 09/11/2026** : aucune validation requise pour l'accès aux données (pas de scope sensible) ; le Centre de validation indique que le branding (nom « DoFirst ») n'est pas affiché aux utilisateurs tant qu'il n'est pas validé (facultatif, voir « Points ouverts »).

---

## 1. Résumé

DoFirst est une app de tâches fondée sur la **matrice d'Eisenhower**. Chaque tâche est rangée dans l'une des quatre cases à partir de deux questions (« C'est urgent ? », « C'est important ? ») :

| Clé enregistrée | Français | Anglais |
|---|---|---|
| `UI` | Faire | Do |
| `INU` | Planifier | Schedule |
| `UDI` | Déléguer | Delegate |
| `NDNI` | Si j'ai le temps | Someday |

Les données restent sur le téléphone, sans compte. L'app existe en 13 langues (réglage « Langue », « Automatique » par défaut), avec un thème sombre. Publiée sur Android sous le package `com.saloum.sylla.matriceeisenhower`.

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
- **1.3.0** : étapes des tâches, « Répartir sur plusieurs jours », rappels d'étape, corrections de la revue de code, nouvelles fiches Play Store.
- **1.6.0** (en cours) : synchronisation Google Drive entre plusieurs téléphones, à la place de la sauvegarde quotidienne de la 1.5 :
  - données synchronisées : tâches (étapes et avancement compris), journal des fins, revues ; réglages propres à chaque téléphone ;
  - `modifiedAt` sur chaque tâche, mis à jour à un seul endroit (`stampChanges`, appelée par `setTasks` dans `useTasks`) pour toute modification de contenu ; `updatedAt` reste le point de départ des relances (une étape cochée depuis la carte ne le changeait pas, et ne doit pas relancer les rappels) ; pierres tombales `{ id, deletedAt }` gardées 90 jours ;
  - fichiers dans `appDataFolder` : `dofirst-sync.json` (l'actuel) et `dofirst-sync-copy-AAAA-MM-JJ.json` (une copie par jour, à la première synchronisation du jour, 5 jours gardés) ;
  - algorithme (`src/sync/engine.ts`) : télécharger l'actuel s'il a changé (révision Drive), fusionner par id (le plus récent gagne, pierre tombale si plus récente, journal en union), enregistrer, envoyer. Drive v3 ignore `If-Match` : la révision est revérifiée juste avant l'envoi (changée : on retélécharge et refusionne) et l'historique des révisions juste après (écriture glissée entre les deux : refusionnée et renvoyée) ; deux actuels créés en même temps sont fusionnés, le plus ancien reste ;
  - déclencheurs (`src/sync/controller.ts`, `DriveSync`) : 10 s après le dernier changement, arrière-plan, ouverture et retour dans l'app (30 s au plus), connexion ; hors ligne : nouvel essai à 30 s, 2 min, 10 min puis toutes les 30 min, sans message ;
  - icône nuage dans l'en-tête de la matrice ; à la connexion, « Fusionner (recommandé) », « Remplacer par Google Drive » (copie de secours) ou « Garder ce téléphone », récupération d'office si le téléphone est vide ; Réglages › Google Drive : Synchroniser maintenant, retour à une copie, synchronisation automatique, déconnexion, suppression des données en ligne ;
  - migration : la dernière sauvegarde de la 1.5 devient le point de départ (fusionnée, sauf si elle vient de ce téléphone : ses données sont alors déjà plus récentes) ; elle reste dans le Drive et est supprimée avec « Supprimer mes données en ligne ».
- **1.6.0, widgets Android** (librairie `react-native-android-widget` 0.26.0, MIT, plugin Expo) : « Faire » (2×2 : nombre, 3 tâches, + et micro), « Aujourd'hui » (4×2 : échéances et étapes du jour, avec l'heure), « Matrice » (4×4 : 4 cases, nombre et tâches) ; redimensionnables, aperçus sans texte (`npm run assets:widgets`) ; liens profonds (fiche, nouvelle tâche, micro, case, calendrier) ; coche depuis « Faire » et « Aujourd'hui » (app ouverte : ses actions ; app fermée : mêmes règles sur les données enregistrées, `markDoneIn`, journal, rappels, `modifiedAt`) ; rafraîchis à chaque changement, au changement de langue ou de thème, à minuit (app ouverte) et toutes les heures pour « Aujourd'hui » ; noms du sélecteur dans les 13 langues (`plugins/withWidgetStrings.js`) ; point d'entrée `index.js` (gestionnaire des widgets).
- **1.6.0, thème clair** : Réglages › Apparence (Automatique par défaut, Clair, Sombre), à chaud, propre au téléphone ; toutes les couleurs dans `src/theme.ts` (`colors` et quadrants lus à chaque accès, `themedStyles`, écrans abonnés par `useScheme`) ; contraste au moins 4,5:1 vérifié par les tests (rouge « danger » du thème sombre éclairci) ; alertes et sélecteurs du système au même mode ; barres d'état et de navigation (`expo-system-ui`, `expo-navigation-bar`) ; écran de démarrage clair ou sombre ; widgets au thème de l'app ; captures claires possibles (`npm run screenshots -- --theme=light`, rangées à part).
- **1.5.0** (soumise à l'examen le 09/11/2026) :
  - sauvegarde Google Drive facultative (Réglages › Google Drive) : connexion Google, dossier caché `appDataFolder` (scope `drive.appdata`), sauvegarde manuelle et automatique (au plus une par jour, au passage en arrière-plan, si les données ont changé), 5 dernières gardées, restauration avec aperçu et copie de secours, proposée après connexion si une sauvegarde existe, déconnexion, suppression de la sauvegarde en ligne ; textes dans les 13 langues ;
  - vue calendrier (icône à chiffres sur la matrice) : mois, points par quadrant et nombre de tâches, échéances, étapes prévues, occurrences futures des tâches récurrentes (« Prévue », non modifiables), panneau du jour avec répartition et frise horaire, « Sans heure » ;
  - dictée du titre (micro dans la fiche, appui long sur « + ») avec la reconnaissance vocale du téléphone, autorisation au premier appui ;
  - retours de tests : bouton micro sur la matrice ; « Répartir sur plusieurs jours » en trois modes (jours d'affilée, certains jours de la semaine, dates précises sur un mini-calendrier) ; appui long sur une tâche : panneau rapide (étapes à cocher, avancement calculé ou réglé de 0 à 100 %, barre fine sur la carte et dans la fiche) ; restauration Drive automatique si l'app est vide, demandée sinon ; présentation en 6 écrans (dont Google Drive) et carte Drive unique pour qui met à jour ;
  - saisie intelligente locale : échéance proposée depuis le titre (chrono-node, 10 langues : pas de coréen, turc ni hindi), « urgent » / « important » suggérés dans les 13 langues ;
  - maintenance : 8 paquets Expo à jour (correctifs du SDK 57), config Jest dans `jest.config.js` (`expo-asset` résolu depuis `expo`), scripts Play : les simulations n'ouvrent plus de modification concurrente.
- **1.4.1** :
  - présentation : 4e écran « Ne rate plus rien », qui propose d'activer les rappels (autorisation des notifications) ;
  - matrice : carte « Active les rappels » pour qui met à jour l'app sans revoir la présentation ; réglage `remindersPromptDone` ;
  - textes des rappels dans les 13 langues.
- **1.4.0** :
  - réglage « Langue » : « Automatique (langue du téléphone) » ou l'une des 13 langues, appliqué tout de suite (écrans, notifications programmées, boutons d'action, canal Android) ; en automatique, langue recalculée au retour dans l'app ;
  - 11 nouvelles langues : espagnol, portugais du Brésil, allemand, italien, indonésien, japonais, coréen, chinois simplifié, turc, hindi, russe ;
  - textes longs : sur Android, deux lignes avec césure (noms des quadrants, sous-titres, pastilles) ;
  - publication Google Play par scripts (fiches, test interne, production) ; fiches Play Store dans 14 langues.
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
| Dictée | `expo-speech-recognition` 57.1.1 (MIT, `SpeechRecognizer` d'Android, `EXTRA_PREFER_OFFLINE`) |
| Dates en langage naturel | `chrono-node` 2.10.3 (MIT), langues importées une à une (`chrono-node/fr`… ; correspondance dans `jest.config.js`) |
| Connexion Google | `@react-native-google-signin/google-signin` 16.1.5 (version gratuite, MIT), Android seulement ; API REST Drive v3 par `fetch` |
| Publication | `googleapis` (API androidpublisher v3, scripts `scripts/play-*.mjs`), `sharp` (comparaison des images) |

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
  drive/                Sauvegarde Google Drive : googleAccount.ts (connexion, scope drive.appdata),
                        driveApi.ts (API REST, appDataFolder), driveBackup.ts (état, rotation,
                        règle de la sauvegarde automatique) ; hooks/useDriveBackup.ts (Réglages),
                        components/DriveAutoBackup.tsx (passage en arrière-plan)
  calendar.ts           Vue calendrier : grille, contenu des jours, frise (app/calendar.tsx,
                        components/CalendarDayPanel.tsx)
  smartInput.ts         Dates et mots « urgent » / « important » tirés du titre ;
                        hooks/useVoiceInput.ts (dictée), components/TitleField.tsx
  guards.ts             isRecord, CATEGORY_KEYS (recovery.ts garde ses propres copies)
  components/           Cartes, formulaires, InfoButton, présentation…
  i18n/                 Textes des 13 langues (fr.ts fait référence ; mêmes clés et mêmes
                        paramètres vérifiés par test), langue courante (index.ts), pluriel russe
  components/fitText.ts Textes étroits : deux lignes avec césure sur Android
scripts/play/          Publication Google Play : lib.mjs (connexion, modifications),
                        listing.mjs (fiches), release.mjs (promotion), guard.mjs (pas de
                        modification pendant un envoi EAS ; tests : npm run test:scripts)
scripts/play-listing.mjs, play-release.mjs, play-ship.mjs
                        Commandes npm (réutilisables dans un autre projet Expo)
store/listings/<langue>/  Fiches Play Store : title.txt, short.txt, full.txt, images/
store/                  Notes de version (release-notes-<langue>.txt), règles de confidentialité
```

## 5. Données enregistrées (AsyncStorage)

| Clé | Contenu |
|---|---|
| `TASKS_4COLS` | Tâches, schéma **v8** (`{ schemaVersion, tasks }` ; v8 : `progress`, avancement réglé à la main) |
| `TASKS_4COLS_BACKUP_V1` … `V7` | Copie du format d'origine, écrite une seule fois avant chaque migration |
| `TASKS_4COLS_CORRUPT_<date>` | Contenu illisible mis de côté |
| `TASKS_4COLS_RECOVERY_DONE`, `TASKS_4COLS_RECOVERY_LOG` | Récupération des anciennes tâches |
| `SETTINGS` | Réglages (schéma 1, champs ajoutés avec valeurs par défaut ; en 1.2.1, `firstUseAt` et `reviewAskedAt` optionnels pour la demande d'avis ; en 1.4, `language` : `"auto"` par défaut ou une langue ; en 1.6, `appearance` : `"auto"`, `"light"` ou `"dark"`) |
| `COMPLETION_LOG` | Journal `{ date, catégorie }` des tâches terminées, 26 semaines |
| `WEEKLY_REVIEW_LOG` | Semaines où une revue a été faite |
| `DRIVE_BACKUP` | Connexion Google Drive : compte connecté, synchronisation automatique (`autoBackup`, nom de la 1.5), `lastBackupAt` de la 1.5 (sert à reconnaître une sauvegarde faite par ce téléphone). À part des réglages : une restauration ne l'écrase pas |
| `DRIVE_SYNC` | État de la synchronisation (1.6) : fichier et révision déjà fusionnés (révision effacée si l'historique n'a pas pu être vérifié), empreinte, dernière synchronisation, migration faite, jour de la dernière copie |
| `SYNC_DELETED` | Suppressions notées au moment où elles se produisent, gardées 90 jours (1.6) : pierres tombales `{ id, deletedAt }` des tâches et retraits du journal `{ key « date\|quadrant », removedAt }` (tâche rouverte) |
| `BACKUP_BEFORE_IMPORT` | Copie des données avant le dernier import |
| `LAST_HANDLED_NOTIFICATION_RESPONSE` | Dernière réponse de notification appliquée |

Champs ajoutés aux tâches en 1.2 :
- **v5 :** `completedAt`, `priorityWeek`.
- **v6 :** `recurrence`, `nextOccurrenceId`, `escalationSkippedFor`.
- **v7 (1.3) :** `steps`, liste de `{ id, title, done, doneAt, day (« 2026-10-27 », facultatif), time (« 14:30 », facultatif) }`, vide par défaut.

Les trois champs optionnels (`completedAt`, `priorityWeek`, `nextOccurrenceId`) ne sont pas renseignés par la récupération, qui n'a pas été modifiée.

En 1.6, `modifiedAt` (facultatif, même schéma v8) : absent des tâches enregistrées avant, il vaut alors la plus récente des dates connues (`modifiedAtOf`), le même calcul sur chaque téléphone.

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
- Fiche : section « Étapes » : ajouter, renommer, cocher, supprimer, réordonner (appui long sur la poignée puis glisser, place calculée sur les positions mesurées ; « Monter » / « Descendre » sur la poignée pour TalkBack), jour prévu (Aucun / Aujourd'hui / Demain / Date) et heure du rappel. « Aujourd'hui » après l'heure du rappel : rappel à l'heure pleine suivante, avec « Rappel aujourd'hui à 15:00 ». Après 23:00, « Trop tard pour un rappel aujourd'hui ». Une coche, un jour ou une heure changés ailleurs pendant que la fiche est ouverte ne sont pas écrasés (si la fiche ne les a pas touchés).
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

**Langues** (1.4)
- fr, en, es, pt-BR, de, it, id, ja, ko, zh-Hans, tr, hi, ru, chacune sous son nom natif dans Réglages › Langue (bouton « i »).
- « Automatique » : langue du téléphone si elle est disponible, sinon anglais ; portugais → brésilien, chinois traditionnel → simplifié, `in` → indonésien. Recalculée au retour dans l'app.
- Changement sans relancer l'app : écrans, notifications programmées reprogrammées, boutons d'action, nom du canal Android.
- Pluriels écrits à la main (Hermes n'a pas `Intl.PluralRules` sur Android) ; dates au format de la langue.
- Manrope couvre le latin, le turc et le cyrillique (vérifié par test) ; japonais, coréen, chinois et hindi utilisent la police système, sans police embarquée.

**Demande d'avis** (1.2.1)
- Fenêtre officielle de Google Play (`expo-store-review`), sans quitter l'app.
- Après la fin d'une revue de la semaine, ou une tâche terminée dès la 10e (journal des fins de tâches).
- Jamais pendant les 3 premiers jours, au plus une fois tous les 90 jours, jamais dans les 30 s après un « Annuler » (tâche, bascule, import), jamais par-dessus une célébration (attend sa fin).
- Première utilisation inconnue (réglages d'avant la 1.2.1) : estimée par la plus ancienne tâche ou fin de tâche.
- Google décide seul d'afficher ou non la fenêtre (quota) : l'app ne sait pas si elle est apparue.

## 7. Publication

| Élément | Valeur |
|---|---|
| Version | **1.5.0** (`app.json`, `package.json`) |
| versionCode | Géré par EAS (`appVersionSource: remote`, `autoIncrement`), absent d'`app.json` |
| Package Android | `com.saloum.sylla.matriceeisenhower` |
| R8 / shrinkResources | Activés (`expo-build-properties`), règles keep pour gesture-handler, AsyncStorage, expo-localization |
| Polices | Manrope (5 graisses) intégrées au build Android |
| Fiche Play Store | `store/listings/<langue>/` : `title.txt`, `short.txt`, `full.txt`, `images/phoneScreenshots/` : 7 captures 1080×1920 par langue, générées par `npm run screenshots` (`scripts/store-screenshots/`, Playwright sur l'export web, données d'exemple hors de l'app). 14 fiches, en ligne depuis la 1.4.0 : fr-FR, en-US, es-419, es-ES, pt-BR, de-DE, it-IT, id, ja-JP, ko-KR, zh-CN, tr-TR, hi-IN, ru-RU |
| Notes de version | `store/release-notes-<langue>.txt`, 14 fichiers (es-419 et es-ES identiques), 500 caractères maximum (1.4.1 : de 44 à 164) |
| Envoi Google Play | Voir ci-dessous. Clé du compte de service hors du dépôt (`C:/secrets/dofirst-play.json`, chemin dans `eas.json`) |
| Règles de confidentialité | `store/privacy-policy-fr.md`, `store/privacy-policy-en.md`, publiées (projet Vercel `sylldevlearning-legal`, `vercel --prod`) sur https://sylldevlearning-legal.vercel.app/dofirst/confidentialite et /dofirst/privacy (mises à jour le 08/11/2026 pour Google Drive) |
| Sécurité des données | `store/data-safety-1.5.0.md`, saisie dans la Play Console le 09/11/2026 (pas d'API) : collecte facultative, non partagée, chiffrée, « Autre contenu généré par l'utilisateur » et « Autres actions » pour le fonctionnement de l'appli ; audio non déclaré ; pas de création de compte, mais connexion avec un compte externe : Oui (connexion Google facultative, pour Drive seulement ; envoyé pour examen le 09/11/2026) ; URL de suppression : /dofirst/privacy |

**Commandes de publication** (prochaine version : remplacer 1.5.0)
1. `eas build --platform android --profile production --auto-submit --non-interactive --no-wait` : build, puis test interne (suivi : `eas build:list` et la page de l'envoi sur expo.dev ; `eas submit:list` n'existe pas). **Aucun appel à l'API Play pendant l'envoi**, même une simulation : Google Play n'accepte qu'une modification ouverte à la fois et l'envoi échoue (« The Google Play edit is no longer valid »). En cas d'échec : `eas submit -p android --profile production --id <build>`.
2. `npm run release:notes`, puis `npm run release:notes -- --apply` : notes de la version du test interne (`eas submit` ne les envoie pas). Vérifier d'abord que la simulation vise le bon versionCode.
3. Tests sur téléphone.
4. `npm run listing:check` : différences de fiche (simulation ; elle ouvre une modification, refusée si un envoi EAS peut être en cours).
5. `npm run release:ship -- --confirm=<version>` : fiche et production (100 %, notes) dans une seule modification, soumises ensemble à l'examen. Sans `--confirm`, ou avec une autre version, rien n'est envoyé.

Autres commandes : `npm run listing:apply` (fiche seule) et `npm run release:promote -- --confirm=<version>` (production seule). Comme la « Publication gérée » est désactivée, ces deux commandes refusent de garder les changements en attente : il faut leur ajouter `--send-for-review`. `release:notes` valide directement (test interne).

Simulations sans modification Play : `release:notes` et `release:promote` sans `--apply`/`--confirm` lisent les versions par `applications.tracks.releases.list`. Toute ouverture de modification (fiche, envoi) passe d'abord par `scripts/play/guard.mjs` : refus si un build de production est en cours, ou terminé depuis moins de 3 h avec un versionCode absent des canaux ; `--skip-upload-check` si l'envoi a échoué.

**Permissions du manifeste final**
- **Attendues :** `INTERNET`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED` et `POST_NOTIFICATIONS` (expo-notifications).
- **Retirées :** `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` et `com.google.android.gms.permission.AD_ID`, via `android.blockedPermissions`.

Le prebuild montre ces directives de retrait ; la fusion finale des manifestes n'a lieu qu'au build.

## 8. Points ouverts

- **Tests sur téléphone :** faits sur le build 9 de la 1.4.1 (test interne), tout est OK. La liste ci-dessous sert pour les prochaines versions.
- **1.6.0, widgets :** permissions vérifiées sur le build 12 (rien de nouveau demandé) ; à vérifier sur téléphone : poids natif (WorkManager, androidsvg, ~4 500 lignes Java ; non mesuré sans build), widgets sur l'écran d'accueil (ajout, redimensionnement, coche app fermée et ouverte, liens, passage à minuit). « Aujourd'hui » se rafraîchit toutes les heures app fermée : jusqu'à une heure de retard après minuit.
- **1.6.0, thème clair :** à vérifier sur le build : barre de navigation (boutons) et alertes du système dans les deux thèmes, passage automatique quand le téléphone change de thème.
- **1.6.0 (synchronisation) :** à tester sur deux téléphones avec un build (pas encore fait). Limites connues :
  - **horloge des téléphones :** « la plus récente gagne » se décide avec l'heure de chaque téléphone ; un téléphone en retard de plusieurs minutes perd une modification faite juste après celle d'un autre ;
  - **pierres tombales de 90 jours :** un téléphone resté hors ligne plus longtemps fait revenir les tâches supprimées entre-temps ;
  - **historique des révisions :** lu sur toutes les pages ; s'il est indisponible ou sans notre révision, la vérification est notée impossible, une écriture croisée n'est rattrapée qu'à la prochaine synchronisation de l'autre téléphone (rien n'est perdu tant qu'il synchronise encore) ; non vérifié sur le vrai Drive (tests sur un Drive simulé) ;
  - **conflit sur une même tâche :** c'est la tâche entière la plus récente qui gagne (pas champ par champ) : une étape cochée sur un téléphone et un titre changé sur l'autre, presque en même temps, gardent une seule des deux modifications ;
  - **migration 1.5 :** les dates n'y sont que des estimations ; une étape décochée en 1.5 (sans changer `updatedAt`) peut être recochée par la sauvegarde d'un autre téléphone ;
  - **suppression des données en ligne :** un autre téléphone encore connecté les renvoie (le message le dit) ;
  - **téléphone resté en 1.5 :** il continue ses sauvegardes `dofirst-backup-*`, ignorées après la migration ;
  - **journal :** une entrée retirée l'est pour toutes les fins de la même milliseconde et du même quadrant ; l'archivage du lancement attend la première synchronisation (20 s au plus) ;
  - **Sécurité des données :** mêmes types (tâches, journal), toujours facultatifs et stockés dans le Drive de l'utilisateur : pas de changement à déclarer. Règles de confidentialité mises à jour le 09/11/2026 (« synchronisation », copies du jour, réglages joints au fichier), publiées sur Vercel.
- **1.5.0 :** soumise à l'examen le 09/11/2026 (production, fiches, captures, Sécurité des données). Suivre l'examen dans la Play Console.
  - **Branding OAuth (facultatif) :** pour afficher « DoFirst » sur l'écran de connexion Google, valider le branding (Google Auth Platform › Centre de validation ; domaine `sylldevlearning-legal.vercel.app` à valider dans Search Console). Sans cela, la connexion fonctionne.
  - **Adresse d'assistance de l'écran de consentement :** encore csgonesse@gmail.com ; sylldevlearning@gmail.com (Owner IAM) peut la remplacer dans Branding.
  - **Contacts développeur :** sylldevlearning@gmail.com et contact@sylldevlearning.fr.
  - **iOS :** section Google Drive masquée (pas de client OAuth iOS ni de plugin `iosUrlScheme`).
- **Poids natif :** non mesuré sans build. Il faut comparer l'AAB 1.2.0 à celui de la 1.1.
- **iOS :** il n'est ni configuré (pas de `bundleIdentifier`) ni testé. Les polices y sont encore chargées au lancement.
- **Copie de secours d'import :** une seule, celle du dernier import.
- **Traductions à faire relire** (1.4) : hindi en priorité (formes masculines à la première personne, registre « तुम »), russe (noms non déclinés, accords au masculin), turc (tournures évitant les suffixes après un nom), coréen (« (으)로 », « 을(를) »), japonais (politesse) ; messages de félicitations dans toutes les langues ; fiches Play Store des 12 nouvelles langues (mots-clés).
- **Césure Android :** elle suit le dictionnaire de la langue du téléphone, qui peut différer de celle de l'app.
- **Adresse de contact :** `sylldevlearning@gmail.com` dans `src/community.ts` et les deux règles de confidentialité.
- **Acceptés sans correction (revue de la 1.3, étape 1) :**
  - **Demande d'avis sur un APK de test :** installée hors Play Store, l'app enregistre `reviewAskedAt` alors que Google n'affiche rien ; la demande est ensuite bloquée 90 jours. Sans effet en production.
  - **Étape au titre vidé :** elle disparaît à l'enregistrement de la fiche, sans avertissement.

- **À faire dans une version de maintenance :**
  - **Message d'erreur de quota (scripts Play) :** une erreur 403 « Listing releases quota exceeded » (quota de `applications.tracks.releases.list`, appelé par la garde `scripts/play/guard.mjs`) s'affiche comme « Accès refusé : l'accès du compte de service n'est pas encore actif… », ce qui est faux. `explain()` (`scripts/play/lib.mjs`) doit reconnaître les erreurs de quota (`quota`, `rateLimitExceeded`, 429) et dire de réessayer plus tard ; la garde doit alors indiquer que la vérification des envois EAS n'a pas pu se faire (`eas status`, puis `--skip-upload-check` si aucun envoi n'est en cours).
  - **Avertissement Node DEP0190** : `spawnSync` avec `shell: true` et des arguments (garde, appel à `eas build:list`).

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
    - Numéro de version affiché : 1.5.0.
15. **Étapes** (1.3)
    - Appui long sur la poignée puis glisser une étape dans la fiche (feuille native) : la ligne suit le doigt et prend sa place au lâcher, y compris avec le jour d'une étape ouvert ; le défilement de la fiche reste possible ; un appui long sur le titre sélectionne le texte.
    - TalkBack : la poignée annonce « Déplacer « … » » et propose « Monter » / « Descendre ».
    - Fiche longue, clavier ouvert : « Nouvelle étape » et les titres des étapes restent visibles au-dessus du clavier.
    - « Aujourd'hui » choisi après 9:00 : ligne « Rappel aujourd'hui à 15:00 » et rappel reçu à cette heure ; après 23:00, « Trop tard pour un rappel aujourd'hui ».
    - « Reporter à demain » depuis un rappel pendant que la fiche de la tâche est ouverte : le report est gardé à l'enregistrement.
    - Choix « Date » : calendrier natif ; heure du rappel.
    - « Répartir sur plusieurs jours » : aperçu, week-ends sautés, création.
    - Rappel d'étape à 9:00 avec « Fait » et « Reporter à demain », app ouverte, en arrière-plan et arrêtée.
    - Cocher une étape dans la fiche : coche animée, ligne surlignée en vert, vibration ; avec « Réduire les animations », vert affiché sans fondu.
    - Cocher la dernière étape dans la fiche : « Terminer la tâche ? » puis la fiche se ferme et les confettis partent.
    - Carte : « Aujourd'hui : … » à cocher, puis « Étape cochée » et « Annuler » ; « En retard : … » en rouge ; grille « 2/5 ».
    - Demande d'avis : jamais juste après avoir ouvert l'app depuis une notification, ni par-dessus la fiche, une alerte, la carte d'autorisation ou le message de bascule.
16. **Langues** (1.4)
    - Réglages › Langue : chaque langue s'applique tout de suite (matrice, fiche, réglages) ; une notification déjà programmée arrive dans la nouvelle langue ; nom du canal dans les réglages Android.
    - « Automatique » : changer la langue du téléphone, revenir dans l'app : nouvelle langue sans relancer.
    - Japonais, coréen, chinois, hindi : aucun carré vide, hauteur des lignes correcte (hindi surtout) ; caractères chinois et japonais avec la bonne forme selon la langue du téléphone.
    - Allemand, russe, indonésien sur un petit écran : noms des quadrants sur deux lignes avec trait d'union, jamais coupés ; pastilles et onglets de la présentation lisibles.
17. **Poids et batterie**
    - Taille de l'AAB comparée à la 1.1.
    - App en arrière-plan : pas de réveils inutiles.
