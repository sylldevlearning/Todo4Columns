// Outils communs aux scripts Google Play (API androidpublisher v3).
// Réutilisable dans un autre projet Expo : copier scripts/play/ et scripts/play-*.mjs,
// installer googleapis. Le package est lu dans app.json › android.package.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { google } from "googleapis";

export const ROOT = process.cwd();
export const STORE = path.join(ROOT, "store");

// Arguments « --nom » et « --nom=valeur »
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) fail(`Argument inconnu : ${arg}`);
    args[match[1]] = match[2] ?? true;
  }
  return args;
}

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

// Identifiant de l'app : app.json › expo.android.package (ou android.package)
export function packageName() {
  const app = readJson("app.json");
  const name = app.expo?.android?.package ?? app.android?.package;
  if (!name) fail("android.package absent de app.json");
  return name;
}

export function appVersion() {
  const app = readJson("app.json");
  return app.expo?.version ?? app.version ?? null;
}

// Clé du compte de service : --key, sinon PLAY_SERVICE_ACCOUNT_KEY, sinon le chemin d'eas.json
// (submit › production › android › serviceAccountKeyPath). Elle doit rester hors du dépôt.
export function keyPath(args) {
  let key = typeof args.key === "string" ? args.key : process.env.PLAY_SERVICE_ACCOUNT_KEY;
  if (!key && existsSync(path.join(ROOT, "eas.json"))) {
    key = readJson("eas.json").submit?.production?.android?.serviceAccountKeyPath;
  }
  if (!key) fail("Clé du compte de service introuvable : --key=<chemin>, PLAY_SERVICE_ACCOUNT_KEY ou eas.json");
  const resolved = path.resolve(ROOT, key);
  const relative = path.relative(ROOT, resolved);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    fail(`La clé ${resolved} est dans le projet : déplace-la hors du dépôt (ex. C:\\secrets\\).`);
  }
  if (!existsSync(resolved)) fail(`Clé du compte de service introuvable : ${resolved}`);
  return resolved;
}

export function client(args) {
  const key = JSON.parse(readFileSync(keyPath(args), "utf8"));
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return google.androidpublisher({ version: "v3", auth });
}

// Ouvre une modification (edit) ; elle est abandonnée si elle n'a pas été validée
export async function withEdit(api, packageName, work) {
  const { data } = await api.edits.insert({ packageName });
  // « committed » non énumérable : { ...edit } ne transmet à l'API que packageName et editId
  const edit = Object.defineProperty({ packageName, editId: data.id }, "committed", { value: false, writable: true });
  try {
    return await work(edit);
  } finally {
    if (!edit.committed) await api.edits.delete({ packageName, editId: edit.editId }).catch(() => {});
  }
}

// Valide la modification. Sans --send-for-review, les changements restent en attente dans la
// Play Console (« Envoyer les modifications pour examen » à faire à la main).
export async function commit(api, edit, sendForReview) {
  try {
    await api.edits.commit({
      packageName: edit.packageName,
      editId: edit.editId,
      ...(sendForReview ? {} : { changesNotSentForReview: true }),
    });
  } catch (e) {
    if (!sendForReview && /must not be set|sent for review automatically/i.test(apiMessage(e))) {
      fail(
        "La Play Console de cette app envoie les modifications à l'examen automatiquement : " +
          "rien n'a été envoyé. Active « Publication gérée » dans la Play Console, ou relance avec --send-for-review."
      );
    }
    throw e;
  }
  edit.committed = true;
}

export const apiMessage = (e) => e?.response?.data?.error?.message ?? e?.message ?? String(e);

// Erreurs de l'API en clair
export function explain(e, packageName) {
  const status = e?.response?.status ?? e?.code;
  const message = apiMessage(e);
  if (status === 403 || status === 401) {
    return (
      `Accès refusé (${status}) : l'accès du compte de service n'est pas encore actif ` +
      `(invitation dans Play Console › Utilisateurs et autorisations, droits sur ${packageName}, ` +
      `ou API Google Play Android Developer à activer ; quelques heures d'attente possibles).\n  ${message}`
    );
  }
  if (status === 404) return `${packageName} introuvable dans la Play Console (404).\n  ${message}`;
  return message;
}

export async function run(main) {
  try {
    await main();
  } catch (e) {
    fail(explain(e, safePackageName()));
  }
}

function safePackageName() {
  try {
    return packageName();
  } catch {
    return "l'app";
  }
}

// Longueur comptée comme la Play Console : en caractères (emoji et accents compris)
export const length = (text) => [...text].length;

// Fichier texte du store : fins de ligne normalisées, espaces de fin retirés
export function readText(file) {
  return existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n?/g, "\n").trim() : null;
}

// Notes de version : store/release-notes-<langue>.txt (500 caractères maximum chacune)
export const RELEASE_NOTES_MAX = 500;
export function releaseNotes() {
  const notes = [];
  for (const file of readdirSync(STORE).sort()) {
    const match = /^release-notes-(.+)\.txt$/.exec(file);
    if (!match) continue;
    const text = readText(path.join(STORE, file));
    if (!text) fail(`${file} est vide`);
    if (length(text) > RELEASE_NOTES_MAX) {
      fail(`${file} : ${length(text)} caractères, ${RELEASE_NOTES_MAX} maximum`);
    }
    notes.push({ language: match[1], text });
  }
  if (notes.length === 0) fail("Aucune note de version : store/release-notes-<langue>.txt");
  return notes;
}
