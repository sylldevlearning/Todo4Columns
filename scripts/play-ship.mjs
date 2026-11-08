// Mise en production complète : fiche Play Store ET promotion du test interne vers la production
// (100 %, notes de store/release-notes-<langue>.txt), dans UNE SEULE modification de l'API,
// soumise à l'examen en une fois : la fiche et la version sont examinées et publiées ensemble.
//
//   node scripts/play-ship.mjs                   résumé seulement (fiche et version), rien n'est envoyé
//   node scripts/play-ship.mjs --confirm=1.4.0   envoie le tout et le soumet à l'examen
// Options : --version-code=42 (une autre version du test interne), --key=<clé du compte de service>,
//   --skip-upload-check (voir scripts/play/guard.mjs)
// La comparaison de la fiche ouvre une modification (l'API n'a pas d'autre lecture des fiches) :
// elle n'est ouverte que si aucun envoi EAS n'est en cours. La version et --confirm sont vérifiés
// avant, sans modification.
import { client, commit, fail, packageName, parseArgs, releaseNotes, run, withEdit } from "./play/lib.mjs";
import { applyListingChanges, listingChanges, printLimits, readListings } from "./play/listing.mjs";
import { codes, preparePromotion, previewPromotion, printPromotion, requireConfirm, stagePromotion } from "./play/release.mjs";

const args = parseArgs();
const versionCode = typeof args["version-code"] === "string" ? args["version-code"] : undefined;

run(async () => {
  // Fiches et notes vérifiées avant toute connexion (limites, dimensions des images)
  const listings = readListings();
  const notes = releaseNotes();
  const pkg = packageName();
  console.log(`${pkg} — fiche Play Store et production`);
  printLimits(listings);

  const api = client(args);
  // Version et --confirm vérifiés sans ouvrir de modification
  const preview = await previewPromotion(api, pkg, { notes, versionCode });
  if (args.confirm !== undefined) requireConfirm(args, preview.versionName, "release:ship");

  await withEdit(api, pkg, args, async (edit) => {
    const changes = await listingChanges(api, edit, listings);
    console.log(`\nFiche : ${changes.length === 0 ? "aucun changement" : `${changes.length} changement(s)`}`);
    const plan = await preparePromotion(api, edit, { notes, versionCode });
    if (plan.versionName !== preview.versionName) {
      fail(`Le test interne a changé (${plan.versionName} au lieu de ${preview.versionName}) : rien n'a été envoyé.`);
    }
    printPromotion(pkg, plan, "fiche et version soumises ensemble à l'examen");
    requireConfirm(args, plan.versionName, "release:ship");

    await applyListingChanges(api, edit, changes);
    await stagePromotion(api, edit, plan);
    await commit(api, edit, true);
    console.log(
      `\n✔ Soumis à l'examen en une seule modification : ${changes.length} changement(s) de fiche et ` +
        `${plan.versionName} (versionCode ${codes(plan.release).join(", ")}) en production à 100 %.`
    );
  });
});
