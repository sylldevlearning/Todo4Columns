// Versions Google Play, avec les notes de store/release-notes-<langue>.txt.
//
// Promotion du test interne vers la production (100 %) :
//   node scripts/play-release.mjs                      résumé seulement, rien n'est envoyé
//   node scripts/play-release.mjs --confirm=1.4.0      promeut, changements en attente dans la Play Console
//   ... --confirm=1.4.0 --send-for-review              promeut et soumet directement à l'examen
//   --version-code=42 : une autre version du test interne que la plus récente
// Fiche et production dans une même modification : scripts/play-ship.mjs
//
// Notes de la dernière version du test interne (eas submit ne les envoie pas) :
//   node scripts/play-release.mjs --internal-notes [--apply]
//
// Options communes : --key=<clé du compte de service>, --skip-upload-check (voir scripts/play/guard.mjs)
//
// Les simulations (sans --confirm, ou sans --apply) n'ouvrent aucune modification : Google Play n'en
// accepte qu'une à la fois, et en ouvrir une invaliderait celle d'un envoi EAS en cours.
import { client, commit, fail, packageName, parseArgs, releaseNotes, releaseSummaries, run, withEdit } from "./play/lib.mjs";
import {
  codes,
  FROM,
  pickRelease,
  preparePromotion,
  previewPromotion,
  printNotes,
  printPromotion,
  requireConfirm,
  stagePromotion,
  trackReleases,
  versionNameOf,
} from "./play/release.mjs";

const args = parseArgs();
const versionCode = typeof args["version-code"] === "string" ? args["version-code"] : undefined;

async function promote(api, pkg) {
  const sendForReview = args["send-for-review"] === true;
  const notes = releaseNotes();
  const review = sendForReview ? "soumis directement à l'examen" : "en attente dans la Play Console (non soumis)";
  // Résumé et --confirm vérifiés sans ouvrir de modification
  const preview = await previewPromotion(api, pkg, { notes, versionCode });
  printPromotion(pkg, preview, review);
  requireConfirm(args, preview.versionName, "release:promote");

  await withEdit(api, pkg, args, async (edit) => {
    const plan = await preparePromotion(api, edit, { notes, versionCode });
    if (plan.versionName !== preview.versionName) {
      fail(`Le test interne a changé (${plan.versionName} au lieu de ${preview.versionName}) : rien n'a été envoyé.`);
    }
    await stagePromotion(api, edit, plan);
    await commit(api, edit, sendForReview);
    console.log(
      sendForReview
        ? `\n✔ ${plan.versionName} promue en production et soumise à l'examen.`
        : `\n✔ ${plan.versionName} promue en production. Changements en attente : Play Console › Vue d'ensemble de la publication › Envoyer les modifications pour examen.`
    );
  });
}

function printInternal(pkg, release, notes) {
  console.log(`\n${pkg} — notes de ${versionNameOf(release)} (versionCode ${codes(release).join(", ")}), test interne`);
  printNotes(notes);
}

async function internalNotes(api, pkg) {
  const notes = releaseNotes();
  if (args.apply !== true) {
    // Simulation : versions lues sans ouvrir de modification
    printInternal(pkg, pickRelease(await releaseSummaries(api, pkg, FROM), versionCode), notes);
    console.log("\nSimulation : rien n'a été envoyé, aucune modification ouverte (--apply pour envoyer).");
    return;
  }
  await withEdit(api, pkg, args, async (edit) => {
    const releases = await trackReleases(api, edit, FROM);
    const release = pickRelease(releases, versionCode);
    printInternal(pkg, release, notes);
    await api.edits.tracks.update({
      ...edit,
      track: FROM,
      requestBody: {
        track: FROM,
        releases: releases.map((r) => (r === release ? { ...r, releaseNotes: notes } : r)),
      },
    });
    await commit(api, edit, false, { automaticIfRequired: true });
    console.log("\n✔ Notes envoyées pour le test interne.");
  });
}

run(async () => {
  const pkg = packageName();
  if (args["internal-notes"] === true && args.confirm !== undefined) fail("--confirm ne s'utilise qu'avec la promotion");
  releaseNotes(); // notes vérifiées avant toute connexion
  const api = client(args);
  await (args["internal-notes"] === true ? internalNotes(api, pkg) : promote(api, pkg));
});
