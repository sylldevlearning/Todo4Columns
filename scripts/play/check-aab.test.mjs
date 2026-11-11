// Vérification d'un AAB (scripts/check-aab.mjs) : les écarts sont bien signalés
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPermissions, checkWidgets } from "../check-aab.mjs";

const el = (name, attrs = {}, children = []) => ({
  name,
  attrs: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { value: v, resourceId: 1 }])),
  children,
});
const receiver = (name) =>
  el("receiver", { name: `com.example.app.widget.${name}`, label: "@string/x" }, [
    el("intent-filter", {}, [el("action", { name: "android.appwidget.action.APPWIDGET_UPDATE" })]),
    el("meta-data", { name: "android.appwidget.provider", resource: `@xml/widgetprovider_${name.toLowerCase()}` }),
  ]);
const widgets = [{ name: "Hello", minWidth: "110dp", minHeight: "110dp" }];
const files = Object.assign([], { root: "" });

test("récepteur absent du manifeste : signalé", () => {
  const manifest = el("manifest", {}, [el("application", {}, [])]);
  const errors = checkWidgets({ manifest, files, resources: "", dex: "", widgets, packageName: "com.example.app" });
  assert.deepEqual(errors, ["Hello : récepteur com.example.app.widget.Hello absent"]);
});

test("XML du widget retiré de l'AAB : signalé", () => {
  const manifest = el("manifest", {}, [el("application", {}, [receiver("Hello")])]);
  const errors = checkWidgets({ manifest, files, resources: "", dex: "", widgets, packageName: "com.example.app" });
  assert.deepEqual(errors, ["Hello : base/res/xml/widgetprovider_hello.xml absent de l'AAB"]);
});

test("FOREGROUND_SERVICE ou permission inconnue : signalées ; pastilles des lanceurs acceptées", () => {
  const perm = (name) => el("uses-permission", { name });
  const manifest = el("manifest", {}, [
    perm("android.permission.INTERNET"),
    perm("android.permission.FOREGROUND_SERVICE"),
    perm("android.permission.CAMERA"),
    perm("com.huawei.android.launcher.permission.CHANGE_BADGE"),
  ]);
  assert.deepEqual(checkPermissions(manifest), [
    "FOREGROUND_SERVICE demandée (elle devait être bloquée)",
    "permission demandée inattendue : android.permission.CAMERA",
    "permission demandée inattendue : android.permission.FOREGROUND_SERVICE",
  ]);
});
