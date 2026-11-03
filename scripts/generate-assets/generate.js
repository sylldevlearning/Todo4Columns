// Génère les icônes et l'écran de démarrage de DoFirst (assets de l'app uniquement).
// Les images de la fiche Play Store (store/listings/<langue>/images) ne sont pas générées :
// ce sont celles publiées, envoyées telles quelles par scripts/play-listing.mjs.
// Usage : npm run assets  (ou node scripts/generate-assets/generate.js)
//
// Logo : grille 2×2 de carrés arrondis aux couleurs des quadrants,
// avec une coche blanche dans « Faire » (haut-gauche).
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const ASSETS = path.join(ROOT, "assets");

const BG = "#0F1115";
const QUADRANTS = ["#FF7A59", "#5B9BFF", "#F2B33D", "#8B92A0"]; // Faire, Planifier, Déléguer, Éliminer

// ---- Logo (dessiné dans une boîte de 100 × 100) ----
const CELL = 46;
const GAP = 8;
const RADIUS = 11;
const CELLS = [
  [0, 0],
  [CELL + GAP, 0],
  [0, CELL + GAP],
  [CELL + GAP, CELL + GAP],
];
// Coche centrée dans la case « Faire »
const CHECK = "M12.5 24 L20 31.5 L34 16.5";
const CHECK_WIDTH = 6.5;

const rect = ([x, y], fill) =>
  `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${RADIUS}" fill="${fill}"/>`;

// Logo en couleurs, placé en (x, y) avec une largeur `size`
function colorLogo(x, y, size) {
  return `<g transform="translate(${x} ${y}) scale(${size / 100})">
    ${CELLS.map((c, i) => rect(c, QUADRANTS[i])).join("\n    ")}
    <path d="${CHECK}" fill="none" stroke="#FFFFFF" stroke-width="${CHECK_WIDTH}"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

// Silhouette d'une seule couleur, coche évidée (icônes thématiques, notification)
function silhouetteLogo(x, y, size, fill = "#FFFFFF") {
  return `<defs><mask id="check">
    <rect x="-10" y="-10" width="120" height="120" fill="white"/>
    <path d="${CHECK}" fill="none" stroke="black" stroke-width="${CHECK_WIDTH}"
      stroke-linecap="round" stroke-linejoin="round"/>
  </mask></defs>
  <g transform="translate(${x} ${y}) scale(${size / 100})">
    <g mask="url(#check)">${CELLS.map((c) => rect(c, fill)).join("")}</g>
  </g>`;
}

const svg = (width, height, body, background = null) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${background ? `<rect width="100%" height="100%" fill="${background}"/>` : ""}
  ${body}
</svg>`);

// Logo centré occupant `ratio` de la largeur
const centered = (canvas, ratio, draw) => {
  const size = canvas * ratio;
  const offset = (canvas - size) / 2;
  return draw(offset, offset, size);
};

async function writePng(file, buffer, { opaque = false } = {}) {
  let image = sharp(buffer);
  if (opaque) image = image.flatten({ background: BG }).removeAlpha();
  await image.png({ compressionLevel: 9 }).toFile(file);
  const meta = await sharp(file).metadata();
  console.log(
    `${path.relative(ROOT, file)} : ${meta.width}×${meta.height}, ${
      meta.hasAlpha ? "transparent" : "opaque"
    }`
  );
}

async function main() {
  // Icône de l'app : fond plein, logo à 64 % de la largeur
  await writePng(path.join(ASSETS, "icon.png"), svg(1024, 1024, centered(1024, 0.64, colorLogo), BG), {
    opaque: true,
  });

  // Icône adaptative Android : avant-plan transparent, fond #0F1115 (app.json).
  // Le masque rond garde un disque de 66 % du diamètre : à 50 % de large, même les coins arrondis
  // de la grille restent visibles ; à 60 %, ils seraient rognés sur les lanceurs à icônes rondes.
  await writePng(path.join(ASSETS, "adaptive-icon.png"), svg(1024, 1024, centered(1024, 0.5, colorLogo)));

  // Icône thématique (Android 13+) : seule la transparence compte
  await writePng(
    path.join(ASSETS, "monochrome-icon.png"),
    svg(1024, 1024, centered(1024, 0.5, (x, y, s) => silhouetteLogo(x, y, s)))
  );

  // Écran de démarrage : logo seul sur fond transparent (affiché à 180 dp de large)
  await writePng(path.join(ASSETS, "splash-icon.png"), svg(1024, 1024, centered(1024, 1, colorLogo)));

  // Notification Android : silhouette blanche, 4 px de marge
  await writePng(
    path.join(ASSETS, "notification-icon.png"),
    svg(96, 96, centered(96, 88 / 96, (x, y, s) => silhouetteLogo(x, y, s)))
  );

  // Favicon web
  await writePng(path.join(ASSETS, "favicon.png"), svg(48, 48, centered(48, 0.8, colorLogo), BG), {
    opaque: true,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
