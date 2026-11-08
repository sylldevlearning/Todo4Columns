# Play Console › Sécurité des données : réponses pour la 1.5.0

À saisir à la main dans Play Console › Règles et programmes › Contenu de l'application ›
Sécurité des données (l'API ne permet pas de les envoyer). Changement par rapport à la 1.4 :
la sauvegarde Google Drive, facultative, envoie des données hors du téléphone.

## Pourquoi déclarer quelque chose

Pour Google Play, une donnée est « collectée » dès que l'app la transmet hors de l'appareil,
même vers le compte de l'utilisateur. La sauvegarde Drive envoie les tâches et le journal des
tâches terminées vers le Google Drive de l'utilisateur : il faut donc la déclarer, comme
« facultative ». Rien n'est transmis au développeur ni à un tiers.

## Vue d'ensemble

| Question | Réponse |
|---|---|
| Votre application collecte-t-elle ou partage-t-elle des types de données utilisateur requis ? | **Oui** |
| Toutes les données utilisateur collectées par votre application sont-elles chiffrées en transit ? | **Oui** (HTTPS vers l'API Google Drive) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** : Réglages › Google Drive › « Supprimer ma sauvegarde en ligne » ; ou retrait de l'accès sur myaccount.google.com/permissions |

Création de compte (question séparée, si elle est posée) : **Non**. DoFirst n'a pas de compte :
la connexion Google sert seulement à l'accès au Drive et ne crée aucun compte DoFirst.

## Types de données

### Activité dans l'application › Autres contenus générés par l'utilisateur
(les tâches : titres, notes, étapes, personnes à qui une tâche est confiée)

| Question | Réponse |
|---|---|
| Collectées | **Oui** |
| Partagées | **Non** |
| Traitées de façon éphémère | **Non** (elles sont stockées dans le Drive de l'utilisateur) |
| Collecte obligatoire ou facultative | **Facultative** (seulement si l'utilisateur connecte Google Drive) |
| Finalités | **Fonctionnement de l'application** (sauvegarde et restauration) |

### Activité dans l'application › Autres actions
(journal des tâches terminées : date et quadrant ; historique des revues de la semaine)

Mêmes réponses : collectées **Oui**, partagées **Non**, éphémère **Non**, **facultative**,
finalité **Fonctionnement de l'application**.

### Non déclarés

- **Adresse e-mail** : lue dans la connexion Google pour l'afficher (« Compte : … ») et gardée
  sur le téléphone seulement ; DoFirst ne la transmet pas.
- **Réglages de l'app** : ils font partie du fichier de sauvegarde mais ne correspondent à aucun
  type de données de la liste Google (préférences d'affichage et de rappels).
- **Connexion Google** : faite par Google Play services (Google Sign-In) ; les échanges
  d'authentification relèvent de Google, comme la sauvegarde Android déjà décrite.

## À vérifier au moment de la saisie

- Si la Play Console range les réglages ou le journal autrement, garder la règle : facultatif,
  non partagé, finalité « Fonctionnement de l'application ».
- « Accès à l'application » : aucune fonction n'est réservée aux comptes ; la section Google Drive
  demande une connexion Google mais tout le reste fonctionne sans. Pas d'identifiants à fournir.
- Lien vers les règles : https://sylldevlearning-legal.vercel.app/dofirst/privacy (mis à jour le
  8 novembre 2026).
