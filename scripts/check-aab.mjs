// Vérifie un AAB de production avant de le promouvoir : widgets Android déclarés et intacts,
// permissions attendues. Lecture seule, rien n'est envoyé.
//
//   node scripts/check-aab.mjs <app.aab>
//
// Contrôles :
// - un récepteur par widget d'app.json (react-native-android-widget), dans <application>, avec
//   l'action APPWIDGET_UPDATE et la meta-data android.appwidget.provider vers son XML ;
// - XML du widget présent dans l'AAB (pas retiré par R8 ni shrinkResources), avec les attributs
//   android: compilés (minWidth, minHeight, initialLayout, previewImage, widgetCategory…) ;
// - aperçu et chaîne du libellé présents ; classe Java du récepteur dans le code compilé ;
// - permissions : FOREGROUND_SERVICE absente ; aucune permission demandée hors de la liste connue.
// Code de sortie 1 au moindre écart.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Permissions demandées connues (build 12, 1.6.0, identiques à la 1.5.0) ; toute autre est signalée
export const EXPECTED_PERMISSIONS = [
  "android.permission.ACCESS_NETWORK_STATE", // Google Sign-In, WorkManager
  "android.permission.INTERNET",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.READ_APP_BADGE",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.RECORD_AUDIO", // dictée (1.5)
  "android.permission.VIBRATE",
  "android.permission.WAKE_LOCK",
  "com.google.android.c2dm.permission.RECEIVE", // expo-notifications (Firebase)
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
];
// Pastilles d'icône des lanceurs (ShortcutBadger, expo-notifications), présentes depuis la 1.1
const BADGE_PERMISSION = /^(com\.(anddoes|htc|huawei\.android|majeur|oppo|sec\.android\.provider|sonyericsson|sonymobile)\.[a-z.]*|me\.everything\.badger)\.permission\.[A-Z_]+$/;

// ---- XML compilé d'aapt2 (protobuf, Resources.proto › XmlNode) ----

function varint(buf, pos) {
  let result = 0n;
  let shift = 0n;
  for (;;) {
    const b = buf[pos++];
    result |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) return [result, pos];
    shift += 7n;
  }
}

function fields(buf) {
  const out = [];
  let pos = 0;
  while (pos < buf.length) {
    let key;
    [key, pos] = varint(buf, pos);
    const field = Number(key >> 3n);
    const wire = Number(key & 7n);
    if (wire === 0) {
      let value;
      [value, pos] = varint(buf, pos);
      out.push({ field, value });
    } else if (wire === 2) {
      let len;
      [len, pos] = varint(buf, pos);
      out.push({ field, value: buf.subarray(pos, pos + Number(len)) });
      pos += Number(len);
    } else if (wire === 5) pos += 4;
    else if (wire === 1) pos += 8;
    else throw new Error(`Format protobuf inattendu (wire ${wire})`);
  }
  return out;
}

const text = (b) => b.toString("utf8");

// Élément : { name, attrs: { nom: { value, resourceId } }, children }
export function parseXml(buf) {
  const element = (b) => {
    const f = fields(b);
    const attrs = {};
    for (const a of f.filter((x) => x.field === 4)) {
      const af = fields(a.value);
      const name = af.find((x) => x.field === 2);
      const value = af.find((x) => x.field === 3);
      const id = af.find((x) => x.field === 5);
      if (name) attrs[text(name.value)] = { value: value ? text(value.value) : "", resourceId: id ? Number(id.value) : 0 };
    }
    const children = f
      .filter((x) => x.field === 5)
      .flatMap((c) => fields(c.value).filter((x) => x.field === 1).map((x) => element(x.value)));
    const name = f.find((x) => x.field === 3);
    return { name: name ? text(name.value) : "", attrs, children };
  };
  const root = fields(buf).find((x) => x.field === 1);
  if (!root) throw new Error("XML compilé illisible");
  return element(root.value);
}

const find = (el, name) => el.children.filter((c) => c.name === name);
const attr = (el, name) => el.attrs[name]?.value;

// ---- Vérifications ----

export function checkWidgets({ manifest, files, resources, dex, widgets, packageName }) {
  const errors = [];
  const app = find(manifest, "application")[0];
  if (!app) return ["<application> absent du manifeste"];
  const receivers = find(app, "receiver");
  for (const w of widgets) {
    const lower = w.name.toLowerCase();
    const className = `${packageName}.widget.${w.name}`;
    const receiver = receivers.find((r) => attr(r, "name") === className);
    if (!receiver) {
      errors.push(`${w.name} : récepteur ${className} absent`);
      continue;
    }
    const actions = find(receiver, "intent-filter").flatMap((f) => find(f, "action").map((a) => attr(a, "name")));
    if (!actions.includes("android.appwidget.action.APPWIDGET_UPDATE")) errors.push(`${w.name} : action APPWIDGET_UPDATE absente`);
    const meta = find(receiver, "meta-data").find((m) => attr(m, "name") === "android.appwidget.provider");
    if (!meta) errors.push(`${w.name} : meta-data android.appwidget.provider absente`);
    else if (attr(meta, "resource") !== `@xml/widgetprovider_${lower}`) errors.push(`${w.name} : meta-data vers ${attr(meta, "resource")}`);
    if (!attr(receiver, "label")) errors.push(`${w.name} : libellé absent`);

    const xmlPath = `base/res/xml/widgetprovider_${lower}.xml`;
    if (!files.includes(xmlPath)) {
      errors.push(`${w.name} : ${xmlPath} absent de l'AAB`);
      continue;
    }
    const provider = parseXml(readFileSync(path.join(files.root, xmlPath)));
    if (provider.name !== "appwidget-provider") errors.push(`${w.name} : racine ${provider.name}`);
    for (const name of ["minWidth", "minHeight", "initialLayout", "resizeMode", "widgetCategory", "previewImage"]) {
      const a = provider.attrs[name];
      if (!a) errors.push(`${w.name} : attribut ${name} absent`);
      else if (a.resourceId === 0) errors.push(`${w.name} : attribut ${name} sans identifiant android: (ignoré par Android)`);
    }
    if (attr(provider, "minWidth") !== w.minWidth) errors.push(`${w.name} : minWidth ${attr(provider, "minWidth")} ≠ ${w.minWidth}`);
    if (attr(provider, "minHeight") !== w.minHeight) errors.push(`${w.name} : minHeight ${attr(provider, "minHeight")} ≠ ${w.minHeight}`);
    if (!/home_screen/.test(attr(provider, "widgetCategory") ?? "")) errors.push(`${w.name} : widgetCategory sans home_screen`);
    if (!files.some((f) => f.startsWith("base/res/drawable") && f.endsWith(`/${lower}_preview.png`))) errors.push(`${w.name} : aperçu absent`);
    if (!resources.includes(`widget_${lower}_label`)) errors.push(`${w.name} : chaîne widget_${lower}_label absente`);
    if (!dex.includes(`L${className.replace(/\./g, "/")};`)) errors.push(`${w.name} : classe ${className} absente du code compilé`);
  }
  return errors;
}

export function requestedPermissions(manifest) {
  return find(manifest, "uses-permission").map((p) => attr(p, "name")).sort();
}

export function checkPermissions(manifest) {
  const errors = [];
  const requested = requestedPermissions(manifest);
  if (requested.includes("android.permission.FOREGROUND_SERVICE")) errors.push("FOREGROUND_SERVICE demandée (elle devait être bloquée)");
  for (const p of requested) {
    if (!EXPECTED_PERMISSIONS.includes(p) && !BADGE_PERMISSION.test(p) && !/DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION$/.test(p)) {
      errors.push(`permission demandée inattendue : ${p}`);
    }
  }
  return errors;
}

// ---- Lancement ----

function main(aab) {
  const dir = mkdtempSync(path.join(tmpdir(), "dofirst-aab-"));
  try {
    execFileSync("tar", ["-xf", path.resolve(aab), "-C", dir, "base/manifest", "base/res", "base/resources.pb", "base/dex"], {
      stdio: "ignore",
    });
    const walk = (d, rel = "") =>
      readdirSync(path.join(d, rel), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(d, path.posix.join(rel, e.name)) : [path.posix.join(rel, e.name)]
      );
    const files = walk(dir);
    files.root = dir;
    const manifest = parseXml(readFileSync(path.join(dir, "base/manifest/AndroidManifest.xml")));
    const appJson = JSON.parse(readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;
    const plugin = appJson.plugins.find((p) => Array.isArray(p) && p[0] === "react-native-android-widget");
    const dex = readdirSync(path.join(dir, "base/dex"))
      .map((f) => readFileSync(path.join(dir, "base/dex", f)).toString("latin1"))
      .join("\n");
    const errors = [
      ...checkWidgets({
        manifest,
        files,
        resources: readFileSync(path.join(dir, "base/resources.pb")).toString("latin1"),
        dex,
        widgets: plugin ? plugin[1].widgets : [],
        packageName: appJson.android.package,
      }),
      ...checkPermissions(manifest),
    ];
    console.log(`${attr(manifest, "package")} ${attr(manifest, "versionName")} (${attr(manifest, "versionCode")})`);
    console.log(`Permissions demandées : ${requestedPermissions(manifest).join(", ")}`);
    if (errors.length) {
      console.error(`✘ ${errors.length} écart(s) :\n  ${errors.join("\n  ")}`);
      process.exitCode = 1;
    } else console.log(`✔ ${plugin ? plugin[1].widgets.length : 0} widgets déclarés et intacts, permissions attendues`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error("Usage : node scripts/check-aab.mjs <app.aab>");
    process.exit(2);
  }
  main(process.argv[2]);
}
