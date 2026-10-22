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
    ndniNote: "Pas de rappel. La tâche sera archivée automatiquement dans 7 jours.",
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
    archives: (n: number) => `Archives · ${n}`,
    archivesHint: "Les tâches « Si j'ai le temps » restées 7 jours sans être faites sont archivées ici.",
    archivedOn: (date: string) => `Archivée ${date}`,
    restore: "Restaurer",
    deleteForever: "Supprimer définitivement",
    deleteForeverBody: (title: string) => `« ${title} » sera supprimée sans retour possible.`,
    androidDelay: "Sur Android, un rappel peut arriver avec quelques minutes de décalage.",
  },

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
