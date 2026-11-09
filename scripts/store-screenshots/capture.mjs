// Captures du Play Store dans chaque langue (outil de développement, jamais inclus dans l'app).
//
//   npm run screenshots                         export web, 13 langues, captures rangées dans les fiches
//   npm run screenshots -- --examples=ja,de,en  quelques langues, dans scripts/store-screenshots/.out/examples
//   options : --skip-export (réutilise le dernier export web), --only=ja,de (langues de l'app)
//   npm run screenshots -- --theme=light         version claire (app et cadre clairs), rangée à part
//                                                dans scripts/store-screenshots/.out/light : les
//                                                fiches du Play Store gardent les captures sombres
//
// 1. Export web de l'app (react-native-web installé sans être enregistré dans package.json ;
//    googleAccount.web.ts copié le temps de l'export pour afficher la section Google Drive).
// 2. Playwright ouvre l'app en taille téléphone (412×915, 1080 px de large), avec des données
//    d'exemple traduites déposées dans le localStorage du navigateur (data.mjs) : rien dans l'app,
//    rien dans les données de l'utilisateur.
// 3. Chaque capture est posée dans le cadre des captures françaises (fond, lueur, titre sur deux
//    lignes, sous-titre, téléphone), en 1080×1920 PNG.
import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { LISTINGS, SAMPLES, storageFor, THEMES, TITLES } from "./data.mjs";
import { serve } from "./server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, ".out");
const WEB = path.join(OUT, "web");
const RAW = path.join(OUT, "raw");
const STUB_TARGET = path.join(ROOT, "src/drive/googleAccount.web.ts");
const SCREENS = ["matrice", "dictee", "calendrier", "avancement", "bilan", "revue", "sauvegarde"];
const PORT = 8765;
const VIEWPORT = { width: 412, height: 915 };
const SCALE = 1080 / 412;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const examples = typeof args.examples === "string" ? args.examples.split(",") : null;
// Thème des captures : sombre par défaut (fiches du Play Store), clair à la demande
const APPEARANCE = args.theme === "light" ? "light" : "dark";
const only = examples ?? (typeof args.only === "string" ? args.only.split(",") : null);
const languages = [...new Set(Object.values(LISTINGS))].filter((l) => !only || only.includes(l));

function exportWeb() {
  if (!existsSync(path.join(ROOT, "node_modules/react-native-web"))) {
    console.log("react-native-web absent : installation sans l'enregistrer (--no-save)");
    execSync("npm install --no-save react-native-web@0.21.4", { cwd: ROOT, stdio: "inherit" });
  }
  copyFileSync(path.join(HERE, "googleAccount.web.ts.txt"), STUB_TARGET);
  try {
    rmSync(WEB, { recursive: true, force: true });
    const result = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", WEB, "--clear"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CI: "1" },
    });
    if (result.status !== 0) throw new Error("expo export --platform web a échoué");
  } finally {
    rmSync(STUB_TARGET, { force: true });
  }
}

// Libellés verticaux « Important / Pas important » : en web, le texte pivoté rétrécit à la largeur
// de sa colonne ; on le laisse déborder (page de capture seulement)
const FIX_VERTICAL_LABELS = () => {
  for (const el of document.querySelectorAll("div")) {
    const t = getComputedStyle(el).transform;
    if (t && t.startsWith("matrix(") && Math.abs(parseFloat(t.slice(7).split(",")[1]) + 1) < 0.01) {
      el.style.flexShrink = "0";
      el.style.minWidth = "160px";
      el.style.overflow = "visible";
      if (el.parentElement) el.parentElement.style.overflow = "visible";
    }
  }
};

// Interrupteurs : en web, la pastille d'un interrupteur activé prend la couleur par défaut de
// react-native-web (vert) ; elle est blanche dans l'app
const FIX_SWITCH_THUMBS = () => {
  for (const el of document.querySelectorAll("div")) {
    if (getComputedStyle(el).backgroundColor === "rgb(0, 150, 136)") el.style.backgroundColor = "#ffffff";
  }
};

// Texte qui dépasse de sa boîte, au demi-pixel près (le navigateur met « … » dès le moindre
// dépassement) : largeur réelle du texte mesurée avec un Range
const OVERFLOWS = `(el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const inner = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return text.width > inner + 0.5 || el.scrollHeight > el.clientHeight + 1;
}`;
const isClamped = `(cs) => cs.textOverflow === "ellipsis" || (cs.webkitLineClamp && cs.webkitLineClamp !== "none")`;

// Textes coupés par « … » (une ligne ou nombre de lignes limité) : relevés pour les éviter
const FIND_TRUNCATED = ([overflowsSrc, clampedSrc]) => {
  const overflows = eval(overflowsSrc);
  const clamped = eval(clampedSrc);
  const cut = [];
  for (const el of document.querySelectorAll("div, span")) {
    if (!clamped(getComputedStyle(el)) || !el.textContent) continue;
    if (overflows(el)) cut.push(el.textContent.trim());
  }
  return [...new Set(cut)];
};
export const truncated = [];

// Réduit la police d'un texte coupé jusqu'à ce qu'il tienne (75 % au plus), sauf les titres de
// tâches (données d'exemple, à raccourcir plutôt)
const SHRINK_APP_TEXTS = ([taskTitles, overflowsSrc, clampedSrc]) => {
  const overflows = eval(overflowsSrc);
  const clamped = eval(clampedSrc);
  const titles = new Set(taskTitles);
  for (const el of document.querySelectorAll("div, span")) {
    const cs = getComputedStyle(el);
    if (!clamped(cs)) continue;
    const text = el.textContent?.trim();
    if (!text || titles.has(text)) continue;
    const start = parseFloat(cs.fontSize);
    let size = start;
    const over = () => overflows(el);
    while (over() && size > start * 0.75) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
  }
};

async function settle(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

// Bouton principal en bas de l'écran (« Suivant », « Terminer la revue »…)
async function clickBottomButton(page) {
  const box = await page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('[role="button"]')) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height === 0) continue;
      if (!best || r.bottom > best.bottom || (r.bottom === best.bottom && r.width > best.width)) best = r;
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 };
  });
  if (!box) throw new Error("bouton principal introuvable");
  await page.mouse.click(box.x, box.y);
}

async function captureLanguage(browser, language, base) {
  const dir = path.join(RAW, language);
  mkdirSync(dir, { recursive: true });
  const storage = storageFor(language, Date.now(), { appearance: APPEARANCE });
  const calendarDay = storage.__calendarDay;
  delete storage.__calendarDay;
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, locale: language, colorScheme: APPEARANCE });
  await context.addInitScript((data) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    sessionStorage.setItem("seeded", "1");
  }, storage);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const taskTitles = Object.values(SAMPLES[language]).flat().filter((v) => typeof v === "string");
  const shot = async (i, target = page) => {
    await target.evaluate(FIX_SWITCH_THUMBS);
    await target.evaluate(SHRINK_APP_TEXTS, [taskTitles, OVERFLOWS, isClamped]);
    for (const text of await target.evaluate(FIND_TRUNCATED, [OVERFLOWS, isClamped])) truncated.push(`${language} · ${SCREENS[i]} : ${text}`);
    await target.screenshot({ path: path.join(dir, `${i + 1}-${SCREENS[i]}.png`) });
  };

  // 1. Matrice : mêmes tâches, sans échéances (cases lisibles)
  const plainContext = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE, locale: language, colorScheme: APPEARANCE });
  const plain = storageFor(language, Date.now(), { plain: true, appearance: APPEARANCE });
  delete plain.__calendarDay;
  await plainContext.addInitScript((data) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, plain);
  const matrixPage = await plainContext.newPage();
  await matrixPage.goto(base, { waitUntil: "networkidle" });
  await settle(matrixPage, 2000);
  await matrixPage.evaluate(FIX_VERTICAL_LABELS);
  await shot(0, matrixPage);
  await plainContext.close();

  // 2. Fiche, micro et titre rempli (ouverte depuis « Faire »)
  await page.goto(`${base}quadrant/UI`);
  await settle(page);
  await page.mouse.click(VIEWPORT.width - 50, VIEWPORT.height - 50);
  await settle(page, 1200);
  const title = page.locator("input").first();
  await title.fill(SAMPLES[language].dictated);
  await title.evaluate((el) => el.blur());
  await settle(page, 500);
  await shot(1);

  // 3. Calendrier, un jour ouvert
  await page.goto(`${base}calendar`);
  await settle(page);
  await page.locator(`[data-testid="day-${calendarDay}"]`).click();
  await settle(page, 600);
  await shot(2);

  // 4. Avancement : appui long sur le projet en 5 étapes (3 faites, 60 %)
  await page.goto(`${base}quadrant/INU`);
  await settle(page);
  const card = await page.locator('[data-testid="task-card-plan1"]').boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await settle(page, 1000);
  await shot(3);

  // 5. Bilan
  await page.goto(`${base}balance`);
  await settle(page, 1200);
  await shot(4);

  // 6. Revue terminée : « Suivant », « Suivant », « Terminer la revue »
  await page.goto(`${base}review`);
  await settle(page);
  for (let i = 0; i < 3; i++) {
    await clickBottomButton(page);
    await settle(page, 700);
  }
  await shot(5);

  // 7. Réglages › Google Drive (compte connecté)
  await page.goto(`${base}settings`);
  await settle(page);
  await page.getByText("alex@example.com", { exact: false }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await settle(page, 500);
  await shot(6);

  await context.close();
  if (errors.length) console.warn(`  ${language} : erreurs de la page`, errors.slice(0, 3));
  return dir;
}


// Cadre : mêmes proportions que les captures françaises
const THEME_COLORS = {
  red: { top: "#63352c", glow: "rgba(255,122,89,0.18)", accent: "#FF7A59" },
  blue: { top: "#294166", glow: "rgba(91,155,255,0.18)", accent: "#5B9BFF" },
  gold: { top: "#5e4923", glow: "rgba(242,179,61,0.16)", accent: "#F2B33D" },
};
const FONTS = {
  ja: "'Noto Sans JP'",
  ko: "'Noto Sans KR'",
  "zh-Hans": "'Noto Sans SC'",
  hi: "'Noto Sans Devanagari', 'Noto Sans'",
};
const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@500;800&family=Noto+Sans+JP:wght@500;800&family=Noto+Sans+KR:wght@500;800&family=Noto+Sans+SC:wght@500;800&family=Noto+Sans+Devanagari:wght@500;800&display=block";

// Capture calée en bas du téléphone (panneau qui s'ouvre par le bas) plutôt qu'en haut
const ALIGN_BOTTOM = new Set(["avancement"]);

// Couleurs du cadre (fond, titres, téléphone) selon le thème des captures
const FRAME = {
  dark: { base: "#0f1115", title: "#fff", subtitle: "rgba(255,255,255,0.58)", border: "#2a2e37", phone: "#101115", shadow: "rgba(0,0,0,0.45)" },
  light: { base: "#f6f7f9", title: "#14161a", subtitle: "rgba(20,22,26,0.6)", border: "#e3e6eb", phone: "#ffffff", shadow: "rgba(20,22,26,0.18)" },
}[APPEARANCE];

function frameHtml(language, index, screenshotUrl) {
  const [line1, line2, subtitle] = TITLES[language][index];
  const theme = THEME_COLORS[THEMES[index]];
  const font = FONTS[language] ?? "'Noto Sans'";
  const long = Math.max([...line1].length, [...line2].length) > 18;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT_LINK}">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1920px; overflow: hidden; font-family: ${font}, sans-serif;
    background: radial-gradient(120% 45% at 50% 0%, ${theme.glow}, transparent 70%),
                linear-gradient(180deg, ${APPEARANCE === "dark" ? theme.top : FRAME.base} 0px, ${APPEARANCE === "dark" ? theme.top : FRAME.base} 180px, ${FRAME.base} 980px); }
  .titles { position: absolute; top: 96px; left: 60px; right: 60px; text-align: center; }
  h1 { font-weight: 800; font-size: ${long ? 74 : 88}px; line-height: 1.08; color: ${FRAME.title}; letter-spacing: -0.5px; }
  h1 span { display: block; color: ${theme.accent}; }
  p { margin-top: 26px; font-weight: 500; font-size: 38px; color: ${FRAME.subtitle}; }
  .phone { position: absolute; left: 106px; top: 398px; width: 868px; height: 1700px; border-radius: 74px;
    border: 3px solid ${FRAME.border}; background: ${FRAME.phone}; overflow: hidden; box-shadow: 0 30px 80px ${FRAME.shadow}; }
  .phone img { display: block; width: 862px; }
  .phone.bottom img { position: absolute; left: 0; bottom: 178px; }
</style></head><body>
<div class="titles"><h1>${line1}<span>${line2}</span></h1><p>${subtitle}</p></div>
<div class="phone${ALIGN_BOTTOM.has(SCREENS[index]) ? " bottom" : ""}"><img src="${screenshotUrl}"></div>
</body></html>`;
}

async function frameLanguage(browser, language, rawDir, targets) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (let i = 0; i < SCREENS.length; i++) {
    const raw = path.join(rawDir, `${i + 1}-${SCREENS[i]}.png`);
    const html = path.join(OUT, `frame-${language}-${i}.html`);
    writeFileSync(html, frameHtml(language, i, pathToFileURL(raw).href));
    await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (const dir of targets) {
      mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `0${i + 1}-${SCREENS[i]}.png`), type: "png" });
    }
    rmSync(html);
  }
  await page.close();
}

// Fiches qui reprennent les captures d'une langue de l'app
const listingsFor = (language) => Object.entries(LISTINGS).filter(([, l]) => l === language).map(([listing]) => listing);

mkdirSync(OUT, { recursive: true });
if (!args["skip-export"] || !existsSync(WEB)) exportWeb();
const server = await serve(WEB, PORT);
const browser = await chromium.launch();
try {
  for (const language of languages) {
    console.log(`→ ${language}`);
    const rawDir = await captureLanguage(browser, language, `http://localhost:${PORT}/`);
    // Version claire : jamais dans les fiches (elles gardent les captures sombres)
    const light = APPEARANCE === "light";
    const targets = examples
      ? [path.join(OUT, light ? "examples-light" : "examples", language)]
      : light
      ? [path.join(OUT, "light", language)]
      : listingsFor(language).map((l) => path.join(ROOT, "store/listings", l, "images/phoneScreenshots"));
    // Anciennes captures de la fiche remplacées (le .gitkeep reste)
    if (!examples && !light) for (const dir of targets) if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(path.join(dir, f));
    await frameLanguage(browser, language, rawDir, targets);
    console.log(`  ${targets.map((t) => path.relative(ROOT, t)).join(", ")}`);
  }
} finally {
  await browser.close();
  server.close();
}
if (truncated.length) {
  console.warn(`\n⚠ Textes coupés par « … » (à raccourcir dans data.mjs) :\n  ${truncated.join("\n  ")}`);
  process.exitCode = 2;
} else console.log("\n✔ Aucun texte coupé par « … »");
