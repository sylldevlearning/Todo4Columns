const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Mercredi 22 octobre »
export function formatToday(now: Date = new Date()): string {
  return capitalize(
    now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  );
}

// « Ven. 24 oct. · 09:00 »
export function formatDue(ts: number): string {
  const d = new Date(ts);
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const day = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${capitalize(weekday)} ${day} · ${time}`;
}

// « 1 tâche », « 3 tâches »
export function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

// Temps restant « MM:SS », ou « H:MM:SS » au-delà d'une heure
export function formatRemaining(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
