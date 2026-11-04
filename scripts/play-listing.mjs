// Fiche Play Store depuis store/listings/<langue>/ (fr-FR, en-US…) :
//   title.txt (30 caractères), short.txt (80), full.txt (4000)
//   images/icon.png, images/featureGraphic.png, images/promoGraphic.png, images/tvBanner.png
//   images/phoneScreenshots/*.png (et sevenInch-, tenInch-, tv-, wearScreenshots), dans l'ordre des noms
//
// node scripts/play-listing.mjs            simulation : vérifie et affiche les différences, n'envoie rien
// node scripts/play-listing.mjs --apply    envoie, sans soumettre à l'examen
// Options : --key=<clé du compte de service>, --language=fr-FR (une seule fiche)
// Fiche et production ensemble : scripts/play-ship.mjs
import { client, commit, packageName, parseArgs, run, withEdit } from "./play/lib.mjs";
import { applyListingChanges, listingChanges, printLimits, readListings } from "./play/listing.mjs";

const args = parseArgs();
const apply = args.apply === true;
const onlyLanguage = typeof args.language === "string" ? args.language : undefined;

async function main() {
  const listings = readListings(onlyLanguage);
  const pkg = packageName();
  console.log(`${pkg} — fiche Play Store (${apply ? "ENVOI" : "simulation, rien n'est envoyé"})`);
  printLimits(listings);

  const api = client(args);
  await withEdit(api, pkg, async (edit) => {
    const changes = await listingChanges(api, edit, listings, { onlyLanguage });
    if (changes.length === 0) {
      console.log("\n✔ Aucune différence : rien à envoyer.");
      return;
    }
    if (!apply) {
      console.log(`\n${changes.length} changement(s). Simulation : rien n'a été envoyé (npm run listing:apply pour envoyer).`);
      return;
    }
    await applyListingChanges(api, edit, changes);
    await commit(api, edit, false);
    console.log(
      `\n✔ ${changes.length} changement(s) envoyé(s), non soumis à l'examen : ` +
        "Play Console › Vue d'ensemble de la publication › Envoyer les modifications pour examen."
    );
  });
}

run(main);
