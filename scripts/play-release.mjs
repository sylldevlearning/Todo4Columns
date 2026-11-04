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
// Option commune : --key=<clé du compte de service>
import { client, commit, fail, packageName, parseArgs, releaseNotes, run, withEdit } from "./play/lib.mjs";
import {
  codes,
  FROM,
  pickRelease,
  preparePromotion,
  printNotes,
  printPromotion,
  requireConfirm,
  stagePromotion,
  trackReleases,
  versionNameOf,
} from "./play/release.mjs";

const args = parseArgs();
const versionCode = typeof args["version-code"] === "string" ? args["version-code"] : undefined;

async function promote(api, edit) {
  const sendForReview = args["send-for-review"] === true;
  const plan = await preparePromotion(api, edit, { notes: releaseNotes(), versionCode });
  printPromotion(
    edit.packageName,
    plan,
    sendForReview ? "soumis directement à l'examen" : "en attente dans la Play Console (non soumis)"
  );
  requireConfirm(args, plan.versionName, "release:promote");

  await stagePromotion(api, edit, plan);
  await commit(api, edit, sendForReview);
  console.log(
    sendForReview
      ? `\n✔ ${plan.versionName} promue en production et soumise à l'examen.`
      : `\n✔ ${plan.versionName} promue en production. Changements en attente : Play Console › Vue d'ensemble de la publication › Envoyer les modifications pour examen.`
  );
}

async function internalNotes(api, edit) {
  const notes = releaseNotes();
  const releases = await trackReleases(api, edit, FROM);
  const release = pickRelease(releases, versionCode);
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
  await commit(api, edit, false, { automaticIfRequired: true });
  console.log("\n✔ Notes envoyées pour le test interne.");
}

run(async () => {
  const pkg = packageName();
  if (args["internal-notes"] === true && args.confirm !== undefined) fail("--confirm ne s'utilise qu'avec la promotion");
  releaseNotes(); // notes vérifiées avant toute connexion
  const api = client(args);
  await withEdit(api, pkg, (edit) => (args["internal-notes"] === true ? internalNotes(api, edit) : promote(api, edit)));
});
