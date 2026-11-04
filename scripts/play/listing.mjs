// Fiche Play Store : lecture de store/listings/<langue>/, différences avec la Play Console, envoi.
// Utilisé par play-listing.mjs (fiche seule) et play-ship.mjs (fiche et production ensemble).
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fail, length, readText, STORE } from "./lib.mjs";

const LIMITS = { title: 30, shortDescription: 80, fullDescription: 4000 };
const FILES = { title: "title.txt", shortDescription: "short.txt", fullDescription: "full.txt" };
const SINGLE_IMAGES = ["icon", "featureGraphic", "promoGraphic", "tvBanner"];
const IMAGE_SETS = ["phoneScreenshots", "sevenInchScreenshots", "tenInchScreenshots", "tvScreenshots", "wearScreenshots"];
// Dimensions imposées par Google Play
const SIZES = { icon: [512, 512], featureGraphic: [1024, 500], promoGraphic: [180, 120], tvBanner: [1280, 720] };
const IMAGE_FILE = /\.(png|jpe?g)$/i;

const LISTINGS = path.join(STORE, "listings");

// Fiches locales, vérifiées avant toute connexion (toutes, ou une seule langue)
export function readListings(onlyLanguage) {
  if (!existsSync(LISTINGS)) fail(`Dossier absent : ${LISTINGS}`);
  const languages = readdirSync(LISTINGS).filter((l) => statSync(path.join(LISTINGS, l)).isDirectory());
  const selected = onlyLanguage ? [onlyLanguage] : languages;
  const errors = [];
  const listings = selected.map((language) => {
    const dir = path.join(LISTINGS, language);
    if (!existsSync(dir)) fail(`Fiche absente : ${dir}`);
    const texts = {};
    for (const [field, file] of Object.entries(FILES)) {
      const text = readText(path.join(dir, file));
      if (!text) errors.push(`${language}/${file} : absent ou vide`);
      else if (length(text) > LIMITS[field]) {
        errors.push(`${language}/${file} : ${length(text)} caractères, ${LIMITS[field]} maximum`);
      }
      texts[field] = text ?? "";
    }
    return { language, texts, images: readImages(dir, language, errors) };
  });
  if (errors.length > 0) fail(`Fiche invalide, rien n'a été envoyé :\n  ${errors.join("\n  ")}`);
  return listings;
}

function readImages(dir, language, errors) {
  const imagesDir = path.join(dir, "images");
  const images = {};
  if (!existsSync(imagesDir)) return images;
  const entries = readdirSync(imagesDir);
  for (const type of SINGLE_IMAGES) {
    const file = entries.find((f) => IMAGE_FILE.test(f) && path.parse(f).name === type);
    if (!file) continue;
    const full = path.join(imagesDir, file);
    const size = pngSize(full);
    if (size && SIZES[type] && (size[0] !== SIZES[type][0] || size[1] !== SIZES[type][1])) {
      errors.push(`${language}/images/${file} : ${size.join("×")}, ${SIZES[type].join("×")} attendu`);
    }
    images[type] = [full];
  }
  for (const type of IMAGE_SETS) {
    const setDir = path.join(imagesDir, type);
    if (!existsSync(setDir)) continue;
    const files = readdirSync(setDir).filter((f) => IMAGE_FILE.test(f)).sort();
    if (files.length > 8) errors.push(`${language}/images/${type} : ${files.length} images, 8 maximum`);
    if (files.length > 0) images[type] = files.map((f) => path.join(setDir, f));
  }
  for (const f of entries) {
    const name = path.parse(f).name;
    if (!SINGLE_IMAGES.includes(name) && !IMAGE_SETS.includes(name)) {
      errors.push(`${language}/images/${f} : nom inconnu (${[...SINGLE_IMAGES, ...IMAGE_SETS].join(", ")})`);
    }
  }
  return images;
}

// Largeur et hauteur d'un PNG (en-tête IHDR) ; null pour un autre format
function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

// Google Play réencode les images : l'empreinte renvoyée par l'API n'est pas celle du fichier envoyé.
// On compare donc les pixels de l'image en ligne et du fichier local (sharp, si installé).
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  sharp = null;
}

async function pixels(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Vrai si l'image en ligne a les mêmes pixels que le fichier local, au réencodage près : moins de
// 0,1 % des valeurs s'écartent de plus de 32 sur 255. Un réencodage ne produit pas de tels écarts ;
// changer une seule ligne de texte d'une bannière en donne ~1,4 % (l'écart moyen, lui, reste ~1,6).
async function sameImage(url, file) {
  if (!sharp) return false;
  const response = await fetch(`${url}=s0`);
  if (!response.ok) return false;
  const [remote, local] = await Promise.all([pixels(Buffer.from(await response.arrayBuffer())), pixels(file)]);
  if (remote.width !== local.width || remote.height !== local.height) return false;
  let changed = 0;
  for (let i = 0; i < local.data.length; i++) {
    if (Math.abs(local.data[i] - remote.data[i]) > 32) changed++;
  }
  return changed / local.data.length < 0.001;
}

async function sameImages(remoteImages, files) {
  if (remoteImages.length !== files.length) return false;
  for (let i = 0; i < files.length; i++) {
    if (!(await sameImage(remoteImages[i].url, files[i]))) return false;
  }
  return true;
}
const mimeType = (file) => (/\.png$/i.test(file) ? "image/png" : "image/jpeg");

// Différence ligne à ligne (plus longue sous-suite commune)
function lineDiff(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push(`      + ${b[j++]}`);
    } else {
      out.push(`      - ${a[i++]}`);
    }
  }
  return out;
}

// Longueurs de chaque fiche locale
export function printLimits(listings) {
  for (const { language, texts } of listings) {
    console.log(
      `  ${language} : titre ${length(texts.title)}/30, courte ${length(texts.shortDescription)}/80, ` +
        `complète ${length(texts.fullDescription)}/4000`
    );
  }
}

const normalized = (text) => (text ?? "").replace(/\r\n?/g, "\n").trim();

// Différences entre les fiches locales et celles de la modification ouverte (affichées)
export async function listingChanges(api, edit, listings, { onlyLanguage } = {}) {
  const { data: remote } = await api.edits.listings.list(edit);
  const remoteByLanguage = new Map((remote.listings ?? []).map((l) => [l.language, l]));
  const changes = [];

  for (const { language, texts, images } of listings) {
    const current = remoteByLanguage.get(language);
    console.log(`\n${language}${current ? "" : " (nouvelle fiche dans cette langue)"}`);
    const changedFields = Object.keys(FILES).filter((f) => normalized(current?.[f]) !== texts[f]);
    for (const field of changedFields) {
      const before = normalized(current?.[field]);
      if (field === "fullDescription") {
        console.log(`  ${FILES[field]} : ${length(before)} → ${length(texts[field])} caractères`);
        console.log(lineDiff(before, texts[field]).join("\n"));
      } else {
        console.log(`  ${FILES[field]} : « ${before} » → « ${texts[field]} »`);
      }
    }
    if (changedFields.length > 0) changes.push({ kind: "texts", language, texts });

    for (const [type, files] of Object.entries(images)) {
      const { data } = await api.edits.images.list({ ...edit, language, imageType: type });
      const remoteImages = data.images ?? [];
      if (await sameImages(remoteImages, files)) continue;
      console.log(
        `  images/${type} : ${remoteImages.length} en ligne → ${files.length} à envoyer` +
          (sharp ? "" : " (sharp absent : comparaison impossible)")
      );
      changes.push({ kind: "images", language, type, files });
    }
    if (!changes.some((c) => c.language === language)) console.log("  identique à la Play Console");
  }
  const unmanaged = [...remoteByLanguage.keys()].filter((l) => !listings.some((x) => x.language === l));
  if (unmanaged.length > 0 && !onlyLanguage) {
    console.log(`\nFiches en ligne sans dossier local (laissées telles quelles) : ${unmanaged.join(", ")}`);
  }
  return changes;
}

// Applique les changements dans la modification ouverte (sans la valider)
export async function applyListingChanges(api, edit, changes) {
  for (const change of changes) {
    const base = { ...edit, language: change.language };
    if (change.kind === "texts") {
      await api.edits.listings.patch({ ...base, requestBody: { language: change.language, ...change.texts } });
    } else {
      await api.edits.images.deleteall({ ...base, imageType: change.type });
      for (const file of change.files) {
        await api.edits.images.upload({
          ...base,
          imageType: change.type,
          media: { mimeType: mimeType(file), body: createReadStream(file) },
        });
      }
    }
  }
}
