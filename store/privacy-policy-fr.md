# Règles de confidentialité de DoFirst

Dernière mise à jour : 9 novembre 2026

DoFirst est une application Android de gestion des tâches fondée sur la matrice d'Eisenhower. Ces règles expliquent ce que l'application fait de tes données. En résumé : **DoFirst ne collecte aucune donnée. Tes données restent sur ton téléphone et, seulement si tu actives la synchronisation Google Drive, dans ton propre Google Drive.**

## Aucune donnée collectée ni envoyée

- DoFirst ne collecte, ne vend et ne partage aucune donnée personnelle. Rien n'est transmis au développeur.
- L'application ne contient aucun outil de mesure d'audience, de statistiques, de suivi publicitaire ni de rapport de plantage.
- Aucun serveur DoFirst ne reçoit tes tâches ni tes réglages : il n'en existe pas.

## Pas de compte

DoFirst s'utilise sans compte, sans inscription, sans adresse e-mail ni numéro de téléphone. La connexion à un compte Google ne sert qu'à la synchronisation Google Drive, qui est facultative.

## Pas de publicité

DoFirst n'affiche aucune publicité et n'utilise pas l'identifiant publicitaire de l'appareil.

## Données stockées sur ton téléphone

Tes tâches, tes réglages, le journal de tes tâches terminées (date et quadrant, sans titre) et l'historique de tes revues de la semaine sont enregistrés uniquement dans le stockage privé de l'application, sur ton téléphone. Aucune autre application n'y a accès.

Tu peux tout supprimer à tout moment en effaçant les données de DoFirst dans les paramètres d'Android, ou en désinstallant l'application.

## Sauvegarde Android de Google

Si tu as activé la sauvegarde de ton téléphone (paramètres d'Android, compte Google), Android peut inclure les données de DoFirst dans cette sauvegarde, comme pour les autres applications. Cette sauvegarde est gérée par Google selon tes réglages et ses propres règles de confidentialité ; DoFirst n'y a pas accès. Tu peux la désactiver dans les paramètres d'Android.

## Synchronisation Google Drive (facultative)

Dans Réglages › Google Drive, tu peux connecter ton compte Google pour synchroniser tes données entre tes téléphones, via ton propre Google Drive. Sans cette connexion, rien n'est envoyé nulle part. L'application ne demande jamais de connexion au lancement.

DoFirst ne demande qu'une seule autorisation : drive.appdata. Elle donne accès uniquement à un dossier caché de ton Google Drive réservé à DoFirst. DoFirst ne voit ni tes fichiers ni tes dossiers Drive, et ce dossier caché n'apparaît pas parmi eux.

- Contenu : tes tâches (étapes et avancement compris), le journal des tâches terminées (date et quadrant) et l'historique des revues, dans un fichier synchronisé, plus une copie par jour gardée 5 jours. Les réglages restent sur chaque téléphone ; ceux du dernier téléphone synchronisé sont joints au fichier, pour qu'un nouveau téléphone les retrouve.
- Envoi : directement de ton téléphone à Google Drive, en connexion chiffrée (HTTPS). Aucun serveur DoFirst n'intervient et le développeur n'a aucun accès à ces données.
- Synchronisation automatique (désactivable) : quelques secondes après chaque changement, à l'ouverture de l'application et quand tu la quittes ; sans connexion internet, rien n'est envoyé avant le retour du réseau.
- Compte : l'adresse e-mail du compte connecté est affichée dans l'application et gardée sur ton téléphone seulement. La connexion est gérée par Google Sign-In ; DoFirst n'enregistre pas tes jetons d'accès.
- Contrôle : « Se déconnecter » arrête la synchronisation sur ce téléphone ; « Supprimer mes données en ligne » efface de ton Drive le fichier synchronisé, ses copies et les anciennes sauvegardes DoFirst. Tu peux aussi retirer l'accès de DoFirst à tout moment sur myaccount.google.com/permissions.

Ces fichiers sont stockés par Google selon les règles de confidentialité de Google. L'utilisation et le transfert vers toute autre application des informations reçues des API Google respectent les Règles d'utilisation des données utilisateur des services d'API Google, y compris les exigences d'utilisation limitée.
## Fichiers d'export, seulement à ta demande

Quand tu touches « Exporter mes données », DoFirst crée un fichier de sauvegarde et ouvre le partage d'Android : c'est toi qui choisis où l'envoyer (Drive, e-mail…). Le fichier temporaire est effacé au lancement suivant. Rien n'est exporté sans ton action.

Quand tu importes une sauvegarde, tu choisis toi-même le fichier dans le sélecteur d'Android ; DoFirst ne lit que ce fichier.

## Micro et dictée (facultatif)

Le bouton micro du titre permet de dicter une tâche. L'autorisation du micro n'est demandée qu'au premier appui sur ce bouton ; tu peux la refuser ou la retirer dans les paramètres d'Android, le reste de l'application fonctionne sans.

- La voix est transformée en texte par le service de reconnaissance vocale de ton téléphone (en général celui de Google), sur l'appareil lui-même quand un modèle hors ligne est installé. Sinon, ce service peut traiter l'audio en ligne selon ses propres règles de confidentialité.
- DoFirst n'enregistre pas l'audio, ne le conserve pas et ne l'envoie à aucun serveur DoFirst ni au développeur : il ne reçoit que le texte reconnu, placé dans le titre.
- L'écoute ne commence que quand tu touches le micro (ou gardes le doigt sur +) et s'arrête après un silence.

Saisie intelligente : la recherche d'une date (« demain à 15 h ») ou des mots « urgent » et « important » dans le titre se fait entièrement sur ton téléphone, sans intelligence artificielle ni serveur. Rien n'est appliqué sans ton accord.
## Aucune autorisation de stockage

DoFirst ne demande pas l'accès à tes photos, à tes fichiers ni à ta mémoire de stockage. Les autorisations de stockage sont retirées de l'application. Les seules autorisations demandées sont les notifications (rappels) et, si tu utilises la dictée, le micro.

## Notifications locales uniquement

Les rappels sont des notifications locales : ils sont programmés et affichés par ton téléphone lui-même, sans passer par Internet ni par un serveur. Tu peux les refuser ou les désactiver à tout moment dans les paramètres d'Android ; tes tâches restent enregistrées.

## Partage et messages

Quand tu utilises « Envoyer », « Relancer », « Partager DoFirst » ou « Suggérer une idée / signaler un problème », DoFirst ouvre l'application de ton choix (messagerie, e-mail…) avec un texte prêt. Rien n'est envoyé tant que tu ne l'envoies pas toi-même depuis cette application. DoFirst n'a pas accès à tes contacts.

L'e-mail de suggestion contient la version de DoFirst et celle d'Android, pour aider à comprendre un problème ; tu peux les retirer avant l'envoi.

## Avis sur le Play Store

DoFirst peut afficher, de temps en temps, la fenêtre officielle de Google Play qui propose de noter l'application. Cette fenêtre est fournie par Google Play ; une note ou un avis éventuel est traité par Google selon ses propres règles de confidentialité. DoFirst ne reçoit pas ta note.

## Enfants

DoFirst ne collecte aucune donnée, y compris auprès des enfants.

## Modifications

Si ces règles changent, la nouvelle version sera publiée à la même adresse avec sa date de mise à jour.

## Contact

Pour toute question sur ces règles : sylldevlearning@gmail.com
