// Versions Google Play, avec les notes de store/release-notes-<langue>.txt.
//
// Promotion du test interne vers la production (100 %) :
//   node scripts/play-release.mjs                      résumé seulement, rien n'est envoyé
//   node scripts/play-release.mjs --confirm=1.4.0      promeut, changements en attente dans la Play Console
//   ... --confirm=1.4.0 --send-for-review              promeut et soumet directement à l'examen
//   --version-code=42 : une autre version du test interne que la plus récente
//
// Notes de la dernière version du test interne (eas submit ne les envoie pas) :
//   node scripts/play-release.mjs --internal-notes [--apply]
//
// Option commune : --key=<clé du compte de service>
import { appVersion, client, commit, fail, packageName, parseArgs, releaseNotes, run, withEdit } from "./play/lib.mjs";

const args = parseArgs();
const FROM = "internal";
const TO = "production";

// versionName d'une version : son nom (« 1.4.0 », ou « 42 (1.4.0) » selon l'outil d'envoi)
const versionNameOf = (release) => /\(([^)]+)\)\s*$/.exec(release.name ?? "")?.[1] ?? release.name ?? null;
const codes = (release) => (release.versionCodes ?? []).map(String);

async function trackReleases(api, edit, track) {
  const { data } = await api.edits.tracks.get({ ...edit, track });
  return data.releases ?? [];
}

function pickRelease(releases) {
  const candidates = releases.filter((r) => r.status === "completed" && codes(r).length > 0);
  if (typeof args["version-code"] === "string") {
    const wanted = candidates.find((r) => codes(r).includes(args["version-code"]));
    if (!wanted) fail(`versionCode ${args["version-code"]} absent du test interne (versions publiées : ${candidates.flatMap(codes).join(", ") || "aucune"})`);
    return wanted;
  }
  if (candidates.length === 0) fail("Aucune version publiée dans le test interne");
  return candidates.reduce((a, b) => (Math.max(...codes(b).map(Number)) > Math.max(...codes(a).map(Number)) ? b : a));
}

function printNotes(notes) {
  for (const { language, text } of notes) {
    console.log(`  Notes ${language} (${[...text].length}/500) :`);
    console.log(text.split("\n").map((l) => `    ${l}`).join("\n"));
  }
}

async function promote(api, edit) {
  const notes = releaseNotes();
  const release = pickRelease(await trackReleases(api, edit, FROM));
  const versionName = versionNameOf(release);
  if (!versionName) fail("Version du test interne sans nom : impossible de vérifier --confirm");
  const production = await trackReleases(api, edit, TO);
  const live = production.find((r) => r.status === "completed");
  if (production.some((r) => codes(r).some((c) => codes(release).includes(c)) && r.status === "completed")) {
    fail(`${versionName} (versionCode ${codes(release).join(", ")}) est déjà en production`);
  }
  const sendForReview = args["send-for-review"] === true;

  console.log(`\n${edit.packageName} — promotion vers la production`);
  console.log(`  Version      : ${versionName}${appVersion() && appVersion() !== versionName ? `  (app.json : ${appVersion()})` : ""}`);
  console.log(`  versionCode  : ${codes(release).join(", ")}`);
  console.log(`  Canal        : ${FROM} → ${TO}, 100 % des utilisateurs`);
  console.log(`  En production: ${live ? `${versionNameOf(live)} (versionCode ${codes(live).join(", ")})` : "aucune version"}`);
  console.log(`  Examen       : ${sendForReview ? "soumis directement à l'examen" : "en attente dans la Play Console (non soumis)"}`);
  printNotes(notes);

  if (args.confirm === undefined) {
    fail(`Rien n'a été envoyé. Pour promouvoir cette version : npm run release:promote -- --confirm=${versionName}`);
  }
  if (args.confirm !== versionName) {
    fail(`--confirm=${args.confirm} ne correspond pas à la version promue (${versionName}) : rien n'a été envoyé.`);
  }

  await api.edits.tracks.update({
    ...edit,
    track: TO,
    requestBody: {
      track: TO,
      releases: [
        {
          name: release.name,
          versionCodes: codes(release),
          status: "completed",
          releaseNotes: notes,
        },
      ],
    },
  });
  await commit(api, edit, sendForReview);
  console.log(
    sendForReview
      ? `\n✔ ${versionName} promue en production et soumise à l'examen.`
      : `\n✔ ${versionName} promue en production. Changements en attente : Play Console › Vue d'ensemble de la publication › Envoyer les modifications pour examen.`
  );
}

async function internalNotes(api, edit) {
  const notes = releaseNotes();
  const releases = await trackReleases(api, edit, FROM);
  const release = pickRelease(releases);
  const versionName = versionNameOf(release);
  console.log(`\n${edit.packageName} — notes de ${versionName} (versionCode ${codes(release).join(", ")}), test interne`);
  printNotes(notes);
  if (args.apply !== true) {
    console.log("\nSimulation : rien n'a été envoyé (--apply pour envoyer).");
    return;
  }
  await api.edits.tracks.update({
    ...edit,
    track: FROM,
    requestBody: {
      track: FROM,
      releases: releases.map((r) => (r === release ? { ...r, releaseNotes: notes } : r)),
    },
  });
  await commit(api, edit, false);
  console.log("\n✔ Notes envoyées pour le test interne.");
}

run(async () => {
  const pkg = packageName();
  if (args["internal-notes"] === true && args.confirm !== undefined) fail("--confirm ne s'utilise qu'avec la promotion");
  releaseNotes(); // notes vérifiées avant toute connexion
  const api = client(args);
  await withEdit(api, pkg, (edit) => (args["internal-notes"] === true ? internalNotes(api, edit) : promote(api, edit)));
});
