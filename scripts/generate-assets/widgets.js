// Aperçus des widgets dans le sélecteur de widgets du téléphone (assets/widgets/*-preview.png).
// Sans texte (le sélecteur ne connaît pas la langue de l'app) : la forme de chaque widget, aux
// couleurs du thème sombre. Usage : node scripts/generate-assets/widgets.js
const path = require("path");
const sharp = require("sharp");

const OUT = path.resolve(__dirname, "../../assets/widgets");
const BG = "#0F1115";
const RAISED = "#232731";
const TEXT = "#F3F4F6";
const MUTED = "#A1A7B3";
const Q = { UI: "#FF7A59", INU: "#5B9BFF", UDI: "#F2B33D", NDNI: "#8B92A0" };
const tint = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const frame = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="44" fill="${BG}"/>${body}</svg>`;
const bar = (x, y, w, h, fill, r = h / 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle = (cx, cy, color) => `<circle cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${color}" stroke-width="4"/>`;
const row = (x, y, w, color, textWidth) => circle(x + 14, y, color) + bar(x + 40, y - 7, textWidth ?? w - 50, 14, TEXT, 7);

// « Faire » : titre et nombre, + et micro, 3 tâches
function doPreview() {
  const w = 320;
  return frame(
    w,
    w,
    bar(24, 30, 90, 22, Q.UI) +
      bar(124, 30, 26, 22, Q.UI) +
      `<circle cx="224" cy="41" r="22" fill="${RAISED}"/><path d="M224 30v22M213 41h22" stroke="${Q.UI}" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="276" cy="41" r="22" fill="${RAISED}"/><rect x="270" y="28" width="12" height="20" rx="6" fill="none" stroke="${Q.UI}" stroke-width="4"/>` +
      [110, 170, 230].map((y, i) => row(20, y, w - 40, Q.UI, [200, 160, 180][i])).join("")
  );
}

// « Aujourd'hui » : titre, puis lignes heure + tâche aux couleurs des quadrants
function todayPreview() {
  const w = 640;
  const h = 320;
  const lines = [
    [Q.UI, 300],
    [Q.INU, 360],
    [Q.UDI, 250],
    [Q.NDNI, 320],
  ];
  return frame(
    w,
    h,
    bar(28, 30, 260, 22, TEXT) +
      lines
        .map(([c, tw], i) => {
          const y = 100 + i * 56;
          return circle(42, y, c) + bar(70, y - 7, 64, 14, c, 7) + bar(150, y - 7, tw, 14, TEXT, 7);
        })
        .join("")
  );
}

// « Matrice » : les 4 cases, nom, nombre et 3 tâches
function matrixPreview() {
  const s = 640;
  const cell = (x, y, c) =>
    `<rect x="${x}" y="${y}" width="292" height="292" rx="32" fill="${tint(c, 0.16)}"/>` +
    bar(x + 22, y + 26, 130, 22, c) +
    bar(x + 236, y + 26, 34, 22, c) +
    [92, 142, 192].map((dy, i) => bar(x + 22, y + dy, [220, 170, 200][i], 14, i === 2 ? MUTED : TEXT, 7)).join("");
  return frame(s, s, cell(20, 20, Q.UI) + cell(328, 20, Q.INU) + cell(20, 328, Q.UDI) + cell(328, 328, Q.NDNI));
}

async function main() {
  for (const [name, svg] of [
    ["do", doPreview()],
    ["today", todayPreview()],
    ["matrix", matrixPreview()],
  ]) {
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(path.join(OUT, `${name}-preview.png`));
  }
  console.log("Aperçus des widgets écrits dans assets/widgets");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
