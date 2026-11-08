// Versions Google Play : choix de la version du test interne, promotion en production (100 %),
// avec les notes de store/release-notes-<langue>.txt.
// Utilisé par play-release.mjs (promotion seule) et play-ship.mjs (fiche et production ensemble).
import { appVersion, fail, releaseSummaries } from "./lib.mjs";

export const FROM = "internal";
export const TO = "production";

// versionName d'une version : son nom (« 1.4.0 », ou « 42 (1.4.0) » selon l'outil d'envoi)
export const versionNameOf = (release) => /\(([^)]+)\)\s*$/.exec(release.name ?? "")?.[1] ?? release.name ?? null;
export const codes = (release) => (release.versionCodes ?? []).map(String);

export async function trackReleases(api, edit, track) {
  const { data } = await api.edits.tracks.get({ ...edit, track });
  return data.releases ?? [];
}

// Version publiée du test interne : la plus récente, ou celle de --version-code
export function pickRelease(releases, versionCode) {
  const candidates = releases.filter((r) => r.status === "completed" && codes(r).length > 0);
  if (typeof versionCode === "string") {
    const wanted = candidates.find((r) => codes(r).includes(versionCode));
    if (!wanted) {
      fail(`versionCode ${versionCode} absent du test interne (versions publiées : ${candidates.flatMap(codes).join(", ") || "aucune"})`);
    }
    return wanted;
  }
  if (candidates.length === 0) fail("Aucune version publiée dans le test interne");
  return candidates.reduce((a, b) => (Math.max(...codes(b).map(Number)) > Math.max(...codes(a).map(Number)) ? b : a));
}

export function printNotes(notes) {
  for (const { language, text } of notes) {
    console.log(`  Notes ${language} (${[...text].length}/500) :`);
    console.log(text.split("\n").map((l) => `    ${l}`).join("\n"));
  }
}

// Version à promouvoir et version actuellement en production (lecture seule), lues dans la
// modification ouverte
export function preparePromotion(api, edit, options) {
  return planPromotion((track) => trackReleases(api, edit, track), options);
}

// Même chose sans ouvrir de modification (simulation, vérification de --confirm avant l'ouverture)
export function previewPromotion(api, packageName, options) {
  return planPromotion((track) => releaseSummaries(api, packageName, track), options);
}

async function planPromotion(read, { notes, versionCode }) {
  const release = pickRelease(await read(FROM), versionCode);
  const versionName = versionNameOf(release);
  if (!versionName) fail("Version du test interne sans nom : impossible de vérifier --confirm");
  const production = await read(TO);
  if (production.some((r) => r.status === "completed" && codes(r).some((c) => codes(release).includes(c)))) {
    fail(`${versionName} (versionCode ${codes(release).join(", ")}) est déjà en production`);
  }
  return { release, versionName, notes, live: production.find((r) => r.status === "completed") };
}

export function printPromotion(packageName, plan, review) {
  const { release, versionName, live, notes } = plan;
  const configured = appVersion();
  console.log(`\n${packageName} — promotion vers la production`);
  console.log(`  Version      : ${versionName}${configured && configured !== versionName ? `  (app.json : ${configured})` : ""}`);
  console.log(`  versionCode  : ${codes(release).join(", ")}`);
  console.log(`  Canal        : ${FROM} → ${TO}, 100 % des utilisateurs`);
  console.log(`  En production: ${live ? `${versionNameOf(live)} (versionCode ${codes(live).join(", ")})` : "aucune version"}`);
  console.log(`  Examen       : ${review}`);
  printNotes(notes);
}

// Sécurité : rien n'est envoyé sans --confirm=<versionName> identique à la version promue
export function requireConfirm(args, versionName, command) {
  if (args.confirm === undefined) {
    fail(`Rien n'a été envoyé. Pour envoyer cette version : npm run ${command} -- --confirm=${versionName}`);
  }
  if (args.confirm !== versionName) {
    fail(`--confirm=${args.confirm} ne correspond pas à la version promue (${versionName}) : rien n'a été envoyé.`);
  }
}

// Place la version en production à 100 % dans la modification ouverte (sans la valider)
export async function stagePromotion(api, edit, { release, notes }) {
  await api.edits.tracks.update({
    ...edit,
    track: TO,
    requestBody: {
      track: TO,
      releases: [{ name: release.name, versionCodes: codes(release), status: "completed", releaseNotes: notes }],
    },
  });
}
