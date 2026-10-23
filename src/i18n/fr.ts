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
    soonUrgent: "Bientôt urgente",
    late: "En retard",
  },

  // Tâches récurrentes
  recurrence: {
    label: "Répéter",
    never: "Jamais",
    daily: "Chaque jour",
    weekdays: "Jours de semaine",
    weekly: "Chaque semaine",
    monthly: "Chaque mois",
    yearly: "Chaque année",
    days: "Jours",
    weeklyOn: (days: string) => `Chaque semaine · ${days}`,
    repeats: (rule: string) => `Se répète : ${rule.toLowerCase()}`,
    stop: "Arrêter de répéter",
  },

  // Escalade : tâches « Planifier » dont l'échéance arrive dans moins de 48 h
  escalation: {
    banner: (n: number) => (n > 1 ? `${n} tâches deviennent urgentes` : "1 tâche devient urgente"),
    listTitle: "Bientôt urgentes",
    listBody: "Leur échéance arrive dans moins de 48 h. Passe-les en « Faire » pour t'en occuper maintenant.",
    suggestion: "Échéance dans moins de 48 h : c'est sans doute urgent.",
    suggestionAction: "Marquer comme urgent",
    escalated: (n: number) =>
      n > 1 ? `${n} tâches planifiées sont passées en Faire` : "1 tâche planifiée est passée en Faire",
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
    dueOptional: "Échéance (facultative)",
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
    review: "Revue de la semaine",
    autoEscalate: "Basculer les tâches en retard dans Faire",
    weeklyReminder: "Me rappeler chaque semaine",
    reviewDay: "Jour",
    reviewTime: "Heure",
    weekdays: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
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
      review: {
        title: "Revue de la semaine",
        body: "Une fois par semaine, 5 minutes pour faire le tri : « Si j'ai le temps », tes priorités et les tâches confiées. C'est le meilleur moyen de garder ta matrice à jour et d'anticiper.",
        example: "le dimanche soir, archive deux vieilles idées, choisis 3 priorités et note que ton collègue a rendu son travail.",
      },
      reviewReminder: {
        title: "Rappel de la revue",
        body: "Une notification t'invite à faire ta revue chaque semaine, au jour et à l'heure choisis. Si l'heure tombe dans la plage silencieuse, le rappel arrive à sa fin.",
        example: "le dimanche à 18 h, pour préparer tranquillement la semaine qui vient.",
      },
      recurrence: {
        title: "Répéter",
        body: "Quand tu termines une tâche qui se répète, la suivante est créée toute seule, avec la prochaine échéance. Les occurrences manquées ne sont pas rattrapées : la suivante tombe toujours après aujourd'hui.",
        example: "« Payer le loyer » chaque mois le 31 : en avril, l'échéance passe au 30, le dernier jour du mois.",
      },
      delegateSend: {
        title: "Envoyer la tâche",
        body: "Ouvre le partage de ton téléphone avec un message prêt à envoyer. Tu choisis l'appli (SMS, WhatsApp, mail…) et la personne : l'app n'a pas accès à tes contacts.",
        example: "« Salut Marie, peux-tu t'occuper de : Compte rendu ? Merci ! »",
      },
      backup: {
        title: "Sauvegarde",
        body: "« Exporter » crée un fichier avec toutes tes données, à garder où tu veux (Drive, mail, fichiers). « Importer » remplace les données de ce téléphone par celles d'un fichier, après une copie de secours. Sur Android, la sauvegarde automatique de Google garde aussi tes données, si elle est activée sur le téléphone.",
        example: "avant de changer de téléphone, exporte tes données dans Drive, puis importe le fichier sur le nouveau.",
      },
      autoEscalate: {
        title: "Tâches en retard",
        body: "Quand l'échéance d'une tâche « Planifier » est dépassée, elle passe toute seule dans « Faire », avec ses relances. Un message te prévient, et « Annuler » la remet dans « Planifier ».",
        example: "« Préparer la réunion », prévue pour 14 h et pas faite, passe en « Faire » à 14 h avec la puce « En retard ».",
      },
      soonUrgent: {
        title: "Bientôt urgente",
        body: "L'échéance de cette tâche « Planifier » arrive dans moins de 48 h : elle est en train de devenir urgente. « Passer en Faire » la range avec ce qui se traite maintenant.",
        example: "un dossier prévu de longue date, à rendre demain à 17 h, passe en « Faire » ce matin.",
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

  // Revue de la semaine
  review: {
    title: "Revue de la semaine",
    open: "Faire la revue de la semaine",
    openNow: "Faire la revue maintenant",
    close: "Fermer la revue",
    progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
    skip: "Passer",
    next: "Suivant",
    finish: "Terminer la revue",
    priority: "priorité de la semaine",
    someday: {
      title: "Si j'ai le temps",
      body: "Pour chaque tâche, décide si tu la gardes, la planifies ou l'archives.",
      empty: "Rien dans « Si j'ai le temps ». Passe à la suite.",
      keep: "Garder",
      plan: "Planifier",
      archive: "Archiver",
    },
    priorities: {
      title: "Tes priorités",
      body: "Choisis jusqu'à 3 tâches « Planifier » pour la semaine. Elles auront une étoile jusqu'à la fin de la semaine.",
      empty: "Aucune tâche à planifier pour l'instant.",
      count: (n: number, max: number) => `${n} sur ${max} choisie${s(n)}`,
    },
    delegated: {
      title: "Tâches confiées",
      body: "As-tu des nouvelles ? Marque ce qui est fait. Toujours en attente : tu seras relancé plus tard.",
      empty: "Aucune tâche confiée en attente.",
      done: "Fait",
      waiting: "Toujours en attente",
      to: (person: string) => `Confiée à ${person}`,
    },
    end: {
      title: "Revue terminée !",
      balance: "Ton équilibre cette semaine",
      streak: (n: number) => `${n} semaine${s(n)} de revue d'affilée`,
      back: "Terminer",
    },
  },

  // Délégation par message (partage natif, sans accès aux contacts)
  delegation: {
    send: (name: string | null) => (name ? `Envoyer à ${name}` : "Envoyer"),
    message: (name: string | null, title: string, due: string | null) =>
      `Salut${name ? ` ${name}` : ""}, peux-tu t'occuper de : ${title} ?${due ? ` (avant le ${due})` : ""} Merci !`,
    nudge: (name: string | null) => (name ? `Relancer ${name}` : "Relancer"),
    nudgeMessage: (title: string) => `Petit rappel : où en es-tu pour ${title} ?`,
  },

  // Sauvegarde : export et import des données
  backup: {
    section: "Sauvegarde",
    export: "Exporter mes données",
    import: "Importer une sauvegarde",
    filePrefix: "dofirst-sauvegarde",
    exportTitle: "Sauvegarde DoFirst",
    exportErrorTitle: "Export impossible",
    exportErrorBody: "Le fichier n'a pas pu être créé. Réessaie dans un instant.",
    invalidTitle: "Fichier non reconnu",
    invalidBody: "Ce fichier n'est pas une sauvegarde DoFirst valide. Rien n'a été modifié.",
    newerTitle: "Sauvegarde trop récente",
    newerBody:
      "Elle vient d'une version plus récente de DoFirst. Mets l'app à jour pour l'importer. Rien n'a été modifié.",
    confirmTitle: "Importer cette sauvegarde ?",
    preview: (n: number, date: string) => `${n} tâche${s(n)}, sauvegarde du ${date}`,
    confirmBody: "Tes données actuelles seront remplacées. Une copie de secours est gardée sur ce téléphone.",
    replace: "Remplacer",
    doneTitle: "Sauvegarde importée",
    doneBody: (n: number) => `${n} tâche${s(n)} restaurée${s(n)}.`,
    importErrorTitle: "Import impossible",
    importErrorBody: "Les données n'ont pas pu être remplacées. Rien n'a été modifié.",
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
    weekTitle: "Ta semaine",
    week: [
      "La carte « Ta semaine », sur la matrice, montre dans quelles cases étaient les tâches que tu as terminées ces 7 derniers jours. Plus la part de « Planifier » est grande, plus tu anticipes. Les tâches terminées puis supprimées y restent comptées.",
      "Chaque semaine (par défaut le dimanche à 18 h), une notification t'invite à faire ta revue : trier « Si j'ai le temps », choisir jusqu'à 3 priorités et faire le point sur les tâches confiées.",
    ],
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
      soonUrgent: "Une tâche « Planifier » dont l'échéance arrive dans moins de 48 h affiche « Bientôt urgente » et propose « Passer en Faire ». Un bandeau sur la matrice les rassemble.",
      late: "Échéance dépassée : la tâche « Planifier » passe toute seule dans « Faire », avec la puce « En retard ». « Annuler » la remet dans « Planifier ». Tu peux désactiver cette bascule dans les Réglages.",
      pastDue: "Bascule désactivée : une tâche « Planifier » dont l'échéance est passée propose « Passer en Faire ».",
      recurrence: "Dans « Planifier », « Répéter » crée la tâche suivante dès que tu termines celle-ci. « Annuler » la retire, « Arrêter de répéter » est dans la fiche.",
      done: "Les tâches terminées sont rangées sous « Terminées », en bas de chaque case. « Vider les terminées » les supprime.",
      notification: "Dans une notification, « Fait » termine la tâche, « Reporter 1 h » repousse le rappel d'une heure et « Ouvrir » affiche sa case.",
      balance: "Touche la carte « Ta semaine » pour ouvrir le bilan des 5 dernières semaines.",
      review: "Touche l'icône calendrier de la matrice pour faire la revue de la semaine à tout moment.",
      star: "Une étoile marque les priorités de la semaine, sur leur carte et dans la grille. Elle disparaît d'elle-même la semaine suivante.",
      send: "Dans la fiche d'une tâche « Déléguer », « Envoyer » ouvre le partage avec un message prêt pour la personne. Tu choisis l'appli et le destinataire.",
      nudge: "Dans la relance d'une tâche confiée ou à l'étape 3 de la revue, « Relancer » prépare un petit rappel à envoyer.",
      backup: "Réglages › Sauvegarde : « Exporter mes données » crée un fichier à garder où tu veux, « Importer une sauvegarde » le remet sur ce téléphone.",
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
    actionNudge: "Relancer",
    nag: "Toujours pas faite ?",
    nagCount: (index: number, total: number) => `Toujours pas faite ? Relance ${index}/${total}`,
    nagSnoozed: "Rappel reporté : toujours pas faite ?",
    dueSoon: (date: string) => `Échéance : ${date}`,
    dueReached: "Échéance atteinte, passer en Faire ?",
    dueEscalated: "Échéance atteinte : la tâche passe en Faire.",
    planSnoozed: "Rappel reporté : c'est le moment ?",
    delegate: (person: string | null) =>
      person ? `As-tu des nouvelles de ${person} ?` : "As-tu des nouvelles ?",
    delegateSnoozed: (person: string | null) =>
      person ? `Rappel reporté : des nouvelles de ${person} ?` : "Rappel reporté : des nouvelles ?",
    timerDone: "Minuteur terminé",
    weeklyReview: "5 minutes pour faire le point et choisir tes priorités.",
  },
};

export type Translations = typeof fr;
