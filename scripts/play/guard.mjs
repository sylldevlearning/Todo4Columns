// Garde contre les modifications (edits) concurrentes.
//
// Google Play n'accepte qu'une modification ouverte à la fois : en ouvrir une, même pour une simple
// lecture, invalide celle qu'un envoi EAS est en train de remplir (« The Google Play edit is no
// longer valid »). Avant d'ouvrir une modification, on vérifie donc qu'aucun envoi EAS ne peut être
// en cours : build de production encore en cours (l'envoi automatique suivra), ou build terminé
// récemment dont le versionCode n'est encore sur aucun canal.
//
// Les canaux sont lus par applications.tracks.releases.list, qui n'ouvre pas de modification.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const TRACKS = ["internal", "alpha", "beta", "production"];
// Délai après la fin d'un build pendant lequel son envoi peut encore être en cours
export const UPLOAD_WINDOW_MS = 3 * 60 * 60 * 1000;
const RUNNING = new Set(["NEW", "IN_QUEUE", "IN_PROGRESS", "PENDING_CANCEL"]);

// Builds de production qui peuvent avoir un envoi en cours (fonction pure, testée)
export function pendingUploads(builds, knownCodes, now = Date.now(), windowMs = UPLOAD_WINDOW_MS) {
  const pending = [];
  // Un build plus ancien que la version la plus récente des canaux a été remplacé, pas en cours
  const highest = Math.max(0, ...[...knownCodes].map(Number).filter(Number.isFinite));
  for (const build of builds) {
    if (build.platform && build.platform !== "ANDROID") continue;
    if (build.distribution && build.distribution !== "STORE") continue;
    const code = String(build.appBuildVersion ?? "");
    if (RUNNING.has(build.status)) {
      pending.push({ id: build.id, versionCode: code, reason: "build en cours (l'envoi automatique peut suivre)" });
      continue;
    }
    if (build.status !== "FINISHED" || !code || knownCodes.has(code) || Number(code) < highest) continue;
    const finished = Date.parse(build.completedAt ?? "");
    if (Number.isFinite(finished) && now - finished < windowMs) {
      pending.push({ id: build.id, versionCode: code, reason: "build terminé, versionCode absent des canaux" });
    }
  }
  return pending;
}

// versionCodes présents sur les canaux, sans ouvrir de modification
export async function publishedCodes(api, packageName, tracks = TRACKS) {
  const codes = new Set();
  for (const track of tracks) {
    try {
      const { data } = await api.applications.tracks.releases.list({ parent: `applications/${packageName}/tracks/${track}` });
      for (const release of data.releases ?? []) {
        for (const artifact of release.activeArtifacts ?? []) codes.add(String(artifact.versionCode));
      }
    } catch (e) {
      if ((e?.response?.status ?? e?.code) !== 404) throw e; // canal jamais utilisé
    }
  }
  return codes;
}

// Derniers builds Android (eas build:list) ; null si EAS n'est pas utilisé par le projet
function easBuilds(root) {
  if (!existsSync(path.join(root, "eas.json"))) return null;
  const result = spawnSync(
    "npx",
    ["eas-cli", "build:list", "--platform", "android", "--limit", "5", "--json", "--non-interactive"],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32", timeout: 120_000 }
  );
  if (result.status !== 0) {
    throw new Error(`eas build:list a échoué : ${(result.stderr || result.stdout || "").trim().split("\n").pop()}`);
  }
  const start = result.stdout.indexOf("[");
  return JSON.parse(result.stdout.slice(start));
}

// Refuse d'ouvrir une modification si un envoi EAS peut être en cours (--skip-upload-check pour passer outre)
export async function assertNoPendingUpload(api, packageName, args, { root = process.cwd(), fail }) {
  if (args["skip-upload-check"] === true) {
    console.log("  (vérification des envois EAS ignorée : --skip-upload-check)");
    return;
  }
  let builds;
  try {
    builds = easBuilds(root);
  } catch (e) {
    fail(
      `Impossible de vérifier les envois EAS en cours, aucune modification ouverte.\n  ${e.message}\n` +
        "  Relance avec --skip-upload-check si aucun envoi n'est en cours."
    );
  }
  if (!builds) return;
  const pending = pendingUploads(builds, await publishedCodes(api, packageName));
  if (pending.length === 0) return;
  fail(
    "Un envoi EAS est peut-être en cours : ouvrir une modification l'invaliderait. Rien n'a été ouvert.\n" +
      pending.map((p) => `  build ${p.id}, versionCode ${p.versionCode} : ${p.reason}`).join("\n") +
      "\n  Attends la fin de l'envoi (le versionCode apparaît en test interne), ou relance avec " +
      "--skip-upload-check si l'envoi a échoué."
  );
}
