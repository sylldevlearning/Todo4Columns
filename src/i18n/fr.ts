import { Category } from "../types";

// Textes en français (langue de référence : en.ts doit avoir exactement les mêmes clés)
const s = (n: number) => (n > 1 ? "s" : "");

export const fr = {
  locale: "fr-FR", // dates et heures

  common: {
    cancel: "Annuler",
    back: "Retour",
    delete: "Supprimer",
    settings: "Réglages",
    openPhoneSettings: "Ouvrir les réglages du téléphone",
  },

  // Quadrants : seules les clés UI / INU / UDI / NDNI sont enregistrées
  categories: {
    UI: {
      name: "Faire",
      subtitle: "Maintenant",
      axisLabel: "Urgent et important",
      description: "Urgent et important : à faire toi-même, maintenant.",
    },
    INU: {
      name: "Planifier",
      subtitle: "Bloquer un créneau",
      axisLabel: "Important, pas urgent",
      description: "Important mais pas urgent : bloque un créneau pour t'y mettre.",
    },
    UDI: {
      name: "Déléguer",
      subtitle: "Confier et relancer",
      axisLabel: "Urgent, pas important",
      description: "Urgent mais pas important : confie-la et relance la personne.",
    },
    NDNI: {
      name: "Si j'ai le temps",
      subtitle: "Plus tard, peut-être",
      axisLabel: "Ni urgent ni important",
      description: "Ni urgent ni important : à faire seulement s'il te reste du temps.",
    },
  } as Record<Category, { name: string; subtitle: string; axisLabel: string; description: string }>,

  matrix: {
    title: "Ma matrice",
    taskCount: (n: number) => `${n} tâche${s(n)}`,
    newTask: "Nouvelle tâche",
    urgent: "Urgent",
    notUrgent: "Pas urgent",
    important: "Important",
    notImportant: "Pas important",
    cellLabel: (name: string, n: number) => `${name}, ${n} tâche${s(n)} à faire`,
    others: (n: number) => `+${n} autre${s(n)}`,
    empty: "Aucune tâche",
  },

  quadrant: {
    subtitle: (axis: string, n: number) => `${axis} · ${n} à faire`,
    empty: "Rien à faire ici pour l'instant.",
    done: (n: number) => `Terminées · ${n}`,
    clearDone: "Vider les terminées",
    newTaskIn: (name: string) => `Nouvelle tâche dans « ${name} »`,
  },

  // Bandeau « Annuler »
  undo: {
    action: "Annuler",
    reopened: "Tâche rouverte",
    completed: "Tâche terminée",
    deleted: (n: number) => (n > 1 ? `${n} tâches supprimées` : "Tâche supprimée"),
    snoozed: "Relance reportée d'1 h",
    movedToDo: "Passée en Faire",
    movedTo: (name: string) => `Déplacée vers « ${name} »`,
  },

  card: {
    markTodo: (title: string) => `Marquer « ${title} » comme à faire`,
    markDone: (title: string) => `Marquer « ${title} » comme terminée`,
    reopen: "Rouvrir",
    complete: "Terminer",
    edit: (title: string) => `Modifier « ${title} »`,
    options: (title: string) => `Options de « ${title} »`,
    snooze: "Reporter 1 h",
    move: "Déplacer…",
    moveToDo: "Passer en Faire",
  },

  chips: {
    waitingSince: (duration: string) => `En attente depuis ${duration}`,
    nextIn: (duration: string) => `Relance dans ${duration}`,
    nagCount: (index: number, total: number) => `Relance ${index}/${total}`,
  },

  menu: {
    close: "Fermer le menu",
    moveTo: "Déplacer vers…",
    moveToLabel: (name: string) => `Déplacer vers « ${name} »`,
    timer: "Minuteur",
  },

  timer: {
    title: "Minuteur",
    subtitle: "Durée en minutes",
    placeholder: "Ex. : 25",
    inputLabel: "Durée du minuteur en minutes",
    invalidTitle: "Durée invalide",
    invalidBody: "Veuillez entrer un nombre de minutes valide.",
    start: "Démarrer",
    expiredTitle: "Temps écoulé",
    expiredOne: (title: string) => `Le délai pour la tâche « ${title} » est terminé !`,
    expiredMany: (titles: string[]) =>
      `Le délai est terminé pour les tâches : ${titles.map((x) => `« ${x} »`).join(", ")}`,
  },

  form: {
    newTitle: "Nouvelle tâche",
    editTitle: "Modifier la tâche",
    titlePlaceholder: "Titre de la tâche",
    titleLabel: "Titre",
    urgentQuestion: "C'est urgent ?",
    urgentHint: "À traiter dans les 48 h",
    importantQuestion: "C'est important ?",
    importantHint: "Ça compte pour tes objectifs",
    doNag: "Relancer si pas faite après",
    repeat: (max: number) => `Répéter jusqu'à ce que ce soit fait (${max} max)`,
    due: "Échéance",
    remindMe: "Me rappeler",
    delegatedTo: "Confié à",
    personPlaceholder: "Nom de la personne",
    followUp: "Relancer la personne",
    ndniNote: "Pas de rappel.",
    ndniNoteArchive: "Pas de rappel. La tâche sera archivée automatiquement dans 7 jours.",
    notificationsDenied: "Les notifications sont désactivées : ce rappel ne s'affichera pas.",
    save: "Enregistrer",
    addTo: (name: string) => `Ajouter à « ${name} »`,
  },

  dueDate: {
    add: "Ajouter une échéance",
    label: (date: string) => `Échéance : ${date}`,
    remove: "Retirer l'échéance",
  },

  // Options de rappel et durées
  reminders: {
    min: (n: number) => `${n} min`,
    hours: (n: number) => `${n} h`,
    hoursMinutes: (h: number, m: string) => `${h} h ${m}`,
    days: (n: number) => `${n} j`,
    oneDay: "1 jour",
    never: "Jamais",
    onTheDay: "Le jour J",
    oneHourBefore: "1 h avant",
    dayBefore: "La veille",
    oneMinuteBefore: "1 min avant",
    tomorrow: "Demain",
    inThreeDays: "Dans 3 jours",
    oneWeek: "1 semaine",
    nagLabel: (option: string, repeated: boolean) =>
      `Relance ${option}${repeated ? " · répétée" : ""}`,
    followUpLabel: (option: string) => `Relance ${option.toLowerCase()}`,
  },

  settings: {
    title: "Réglages",
    defaults: "Rappels par défaut",
    doField: "Faire · relancer si pas faite après",
    repeatUntilDone: "Répéter jusqu'à ce que ce soit fait",
    maxNags: "Nombre maximum de relances",
    planField: "Planifier · me rappeler",
    delegateField: "Déléguer · relancer la personne",
    quietHours: "Plage silencieuse",
    quietHoursHint: "Les rappels prévus pendant cette plage sont décalés à sa fin.",
    start: "Début",
    end: "Fin",
    notifications: "Notifications",
    permission: {
      granted: "Autorisées",
      denied: "Refusées : aucun rappel ne s'affichera",
      undetermined: "Pas encore demandées",
    },
    allowNotifications: "Autoriser les notifications",
    animations: "Animations",
    celebrations: "Animations de célébration",
    celebrationsHint: "Des confettis et un petit mot quand tu termines une tâche.",
    archives: (n: number) => `Archives · ${n}`,
    autoArchive: "Archiver automatiquement les tâches « Si j'ai le temps » après 7 jours",
    archivesHint: "Les tâches archivées apparaissent ici.",
    archivedOn: (date: string) => `Archivée ${date}`,
    restore: "Restaurer",
    deleteForever: "Supprimer définitivement",
    deleteForeverBody: (title: string) => `« ${title} » sera supprimée sans retour possible.`,
    androidDelay: "Sur Android, un rappel peut arriver avec quelques minutes de décalage.",
    help: "Aide",
  },

  // Aide : cartes des boutons « i »
  help: {
    infoLabel: (title: string) => `En savoir plus : ${title}`,
    close: "Fermer",
    example: (text: string) => `Exemple : ${text}`,
    info: {
      UI: {
        title: "Faire",
        body: "Urgent et important : si ça attend, il y aura une vraie conséquence. Fais-le toi-même, aujourd'hui.",
        example: "envoyer le dossier qui doit partir ce soir.",
      },
      INU: {
        title: "Planifier",
        body: "Important mais pas urgent : c'est ce qui te fait avancer. Choisis un moment pour t'y mettre avant que ça devienne urgent.",
        example: "réviser un examen qui a lieu dans trois semaines.",
      },
      UDI: {
        title: "Déléguer",
        body: "Urgent mais pas important pour toi : quelqu'un d'autre peut s'en charger. Confie-le, puis relance la personne si tu n'as pas de nouvelles.",
        example: "demander à un collègue d'envoyer le compte rendu de la réunion.",
      },
      NDNI: {
        title: "Si j'ai le temps",
        body: "Ni urgent ni important : à faire seulement s'il te reste du temps. Pas de pression : garde-le pour un moment libre.",
        example: "trier les vieilles photos de ton téléphone.",
      },
      urgent: {
        title: "C'est urgent ?",
        body: "Est-ce que ça doit être fait aujourd'hui ou demain ? Si oui, c'est urgent. Sinon, ça peut attendre un moment choisi, même si c'est important.",
        example: "une facture à payer avant demain est urgente ; renouveler un passeport qui expire dans six mois ne l'est pas encore.",
      },
      important: {
        title: "C'est important ?",
        body: "Est-ce que ça compte pour tes objectifs, ta santé, ton travail ou tes proches ? Si ne jamais le faire aurait de vraies conséquences, c'est important.",
        example: "préparer un entretien d'embauche est important ; regarder la dernière vidéo à la mode ne l'est pas.",
      },
      nag: {
        title: "Relance",
        body: "Si la tâche n'est pas cochée après ce délai, tu reçois une notification. Tu peux répondre « Fait » ou « Reporter 1 h » directement depuis la notification.",
        example: "avec « 2 h », une tâche créée à 9 h te relance à 11 h si elle n'est pas faite.",
      },
      repeat: {
        title: "Répéter la relance",
        body: "La relance revient au même intervalle tant que la tâche n'est pas cochée, jusqu'au nombre maximum de relances. Ensuite, elle s'arrête.",
        example: "relance toutes les 2 h, 3 au maximum : à 11 h, 13 h et 15 h.",
      },
      reminder: {
        title: "Me rappeler",
        body: "Pour une tâche avec une échéance : tu reçois un rappel avant, puis une notification à l'heure de l'échéance. « Le jour J » ne garde que la notification de l'échéance.",
        example: "échéance vendredi à 14 h avec « La veille » : rappel jeudi à 14 h, puis vendredi à 14 h.",
      },
      delegatedTo: {
        title: "Confié à",
        body: "Le nom de la personne à qui tu as confié la tâche. Il apparaît dans la relance pour que tu saches qui contacter. Ce champ est facultatif.",
        example: "avec « Marie », la relance demande « As-tu des nouvelles de Marie ? ».",
      },
      followUp: {
        title: "Relancer la personne",
        body: "Après ce délai, tu reçois une notification pour prendre des nouvelles. Si c'est réglé, réponds « Fait ».",
        example: "avec « Dans 3 jours », une tâche confiée lundi te relance jeudi.",
      },
      quietHours: {
        title: "Plage silencieuse",
        body: "Aucun rappel pendant cette plage : ceux qui tomberaient dedans arrivent à sa fin. Les minuteurs sonnent quand même à l'heure.",
        example: "de 22:00 à 08:00, une relance prévue à 23 h arrive à 8 h le lendemain.",
      },
      autoArchive: {
        title: "Archivage automatique",
        body: "Une tâche restée 7 jours dans « Si j'ai le temps » sans être faite part dans les archives. Ta matrice reste légère, et tu peux la restaurer ici à tout moment.",
        example: "une idée ajoutée lundi et pas faite est archivée le lundi suivant.",
      },
      balance: {
        title: "Ton équilibre",
        body: "La barre montre dans quelles cases étaient les tâches que tu as terminées. Anticiper, c'est faire les tâches « Planifier » avant qu'elles deviennent urgentes : plus cette part grandit, moins tu as d'urgences.",
        example: "« 6 tâches sur 10 anticipées » : 6 des 10 tâches terminées venaient de « Planifier ».",
      },
      celebrations: {
        title: "Animations de célébration",
        body: "Quand tu termines une tâche, des confettis et un petit mot s'affichent. Désactive-les si tu préfères une app plus sobre.",
        example: "glisse une tâche vers la droite pour la terminer et voir l'animation.",
      },
    },
  },

  // Présentation au premier lancement (3 écrans)
  onboarding: {
    skip: "Passer",
    next: "Suivant",
    start: "C'est parti",
    progress: (page: number, total: number) => `Écran ${page} sur ${total}`,
    replay: "Revoir la présentation",
    matrix: {
      title: "Urgent ou important ?",
      body: "La matrice d'Eisenhower range chaque tâche selon deux questions. Ça donne 4 cases, et chacune te dit quoi faire.",
    },
    create: {
      title: "Deux questions, c'est tout",
      body: "Quand tu crées une tâche, réponds à « C'est urgent ? » et « C'est important ? ». L'app la range toute seule dans la bonne case.",
    },
    gestures: {
      title: "Rappels et gestes",
      body: "Glisse une tâche vers la droite pour la terminer, vers la gauche pour la supprimer. Les rappels arrivent en notification : réponds « Fait » ou « Reporter 1 h » sans ouvrir l'app.",
    },
    // Textes des illustrations
    sampleTask: "Rendre le dossier",
    swipeRight: "Terminer",
    swipeLeft: "Supprimer",
  },

  // Équilibre : carte « Ta semaine » et écran « Bilan »
  balance: {
    cardTitle: "Ta semaine",
    anticipated: (n: number, total: number) =>
      `${n} tâche${s(n)} sur ${total} anticipée${s(n)}`,
    notEnough: "Termine quelques tâches pour voir ton équilibre.",
    open: "Ouvre le bilan",
    title: "Bilan",
    thisWeek: "Cette semaine",
    previousWeeks: "Les 4 semaines précédentes",
    weekOf: (date: string) => `Semaine du ${date}`,
    done: (n: number) => `${n} tâche${s(n)} terminée${s(n)}`,
    empty: "Aucune tâche terminée",
    barLabel: (parts: string) => `Tâches terminées : ${parts}`,
    part: (name: string, n: number) => `${name} ${n}`,
    insight:
      "Plus tu planifies, moins tu as d'urgences : une tâche « Planifier » faite à temps ne devient jamais urgente.",
  },

  // Page « Comment ça marche »
  howTo: {
    title: "Comment ça marche",
    methodTitle: "La méthode d'Eisenhower",
    method: [
      "Avant d'agir, pose-toi deux questions : est-ce urgent ? est-ce important ? Les réponses rangent chaque tâche dans l'une des 4 cases de la matrice, et chaque case te dit quoi faire.",
      "Urgent veut dire que ça doit être fait aujourd'hui ou demain. Important veut dire que ça compte pour tes objectifs, ta santé, ton travail ou tes proches.",
      "Le but : passer plus de temps sur ce qui est important avant que ça devienne urgent. C'est la case « Planifier ».",
    ],
    quadrantsTitle: "Les 4 cases",
    examples: "Exemples",
    quadrants: {
      UI: {
        action: "Fais-le toi-même, maintenant. Ces tâches ne peuvent pas attendre.",
        examples: [
          "Envoyer le dossier qui doit partir ce soir",
          "Payer une facture qui expire demain",
          "Appeler le plombier pour une fuite",
        ],
      },
      INU: {
        action: "Choisis un moment pour t'y mettre. C'est ici que tu avances vraiment.",
        examples: [
          "Réviser un examen dans trois semaines",
          "Faire du sport",
          "Préparer un projet qui te tient à cœur",
        ],
      },
      UDI: {
        action: "Confie-le à quelqu'un, puis relance la personne si tu n'as pas de nouvelles.",
        examples: [
          "Demander à un collègue le compte rendu de la réunion",
          "Faire réserver le restaurant par un ami",
          "Laisser le garage s'occuper du contrôle technique",
        ],
      },
      NDNI: {
        action: "Seulement s'il te reste du temps. Pas de pression : garde-le pour un moment libre.",
        examples: [
          "Trier les vieilles photos du téléphone",
          "Réorganiser les icônes de ton écran d'accueil",
          "Regarder un épisode de plus",
        ],
      },
    } as Record<Category, { action: string; examples: string[] }>,
    gesturesTitle: "Les gestes de l'app",
    gestures: {
      openQuadrant: "Touche une case de la matrice pour voir ses tâches.",
      add: "Touche le bouton + pour créer une tâche. Depuis une case, les interrupteurs sont déjà réglés pour elle.",
      check: "Touche le rond d'une tâche pour la cocher ou la rouvrir.",
      swipeRight: "Glisse une tâche vers la droite pour la terminer.",
      swipeLeft: "Glisse une tâche vers la gauche pour la supprimer.",
      undo: "Après une action, « Annuler » reste affiché 5 secondes pour revenir en arrière.",
      edit: "Touche une tâche pour la modifier.",
      menu: "Touche « … » sur une tâche pour la déplacer vers une autre case ou lancer un minuteur.",
      waiting: "Une tâche « Faire » restée sans réponse après sa relance propose « Reporter 1 h » et « Déplacer… ».",
      pastDue: "Une tâche « Planifier » dont l'échéance est passée propose « Passer en Faire ».",
      done: "Les tâches terminées sont rangées sous « Terminées », en bas de chaque case. « Vider les terminées » les supprime.",
      notification: "Dans une notification, « Fait » termine la tâche, « Reporter 1 h » repousse le rappel d'une heure et « Ouvrir » affiche sa case.",
      info: "Touche une icône « i » pour une explication rapide.",
    },
  },

  // Messages de célébration, tirés au hasard quand une tâche est terminée
  celebrations: {
    UI: [
      "Et une urgence de moins !",
      "Réglé, et dans les temps.",
      "Pression retombée. Bien joué !",
      "Tu gères le feu comme un pro.",
      "C'était urgent, c'est fait.",
      "Une épine de moins dans le pied.",
      "Efficace ! Au suivant.",
      "Mission accomplie.",
      "Tu viens de t'enlever un poids.",
      "Rapide et précis. Bravo !",
    ],
    INU: [
      "Voilà ce qui fait avancer ta vie.",
      "Tu as pris de l'avance. Bravo !",
      "Important avant urgent : tu as tout compris.",
      "Une urgence évitée avant même d'exister.",
      "C'est comme ça qu'on construit.",
      "Ton futur toi te remercie.",
      "Organisé et serein. Bien joué !",
      "Un pas de plus vers tes objectifs.",
      "Moins de stress demain grâce à aujourd'hui.",
      "Ça, c'est de la vraie priorité.",
    ],
    UDI: [
      "Bien délégué, temps gagné.",
      "Tu n'as pas à tout faire seul.",
      "Le travail d'équipe, ça paie !",
      "Une tâche de moins sur tes épaules.",
      "Déléguer, c'est aussi s'organiser.",
      "Confié, suivi, terminé.",
      "Ton temps est précieux, tu le protèges.",
      "Bonne coordination !",
      "Et voilà, c'est réglé.",
      "Bien joué, chef d'orchestre.",
    ],
    NDNI: [
      "Petit plaisir, coché !",
      "Tu avais du temps, tu l'as bien utilisé.",
      "Bonus débloqué.",
      "Et en plus, tu fais ça !",
      "Rien d'obligatoire, et pourtant c'est fait.",
      "Le petit extra du jour.",
      "Une chose de plus, l'esprit léger.",
      "Joli bonus !",
      "Tu fais même les petits trucs, bravo.",
      "Coché, sans pression.",
    ],
  } as Record<Category, string[]>,

  notifications: {
    channel: "Rappels",
    actionDone: "Fait",
    actionSnooze: "Reporter 1 h",
    actionOpen: "Ouvrir",
    nag: "Toujours pas faite ?",
    nagCount: (index: number, total: number) => `Toujours pas faite ? Relance ${index}/${total}`,
    nagSnoozed: "Rappel reporté : toujours pas faite ?",
    dueSoon: (date: string) => `Échéance : ${date}`,
    dueReached: "Échéance atteinte, passer en Faire ?",
    planSnoozed: "Rappel reporté : c'est le moment ?",
    delegate: (person: string | null) =>
      person ? `As-tu des nouvelles de ${person} ?` : "As-tu des nouvelles ?",
    delegateSnoozed: (person: string | null) =>
      person ? `Rappel reporté : des nouvelles de ${person} ?` : "Rappel reporté : des nouvelles ?",
    timerDone: "Minuteur terminé",
  },
};

export type Translations = typeof fr;
