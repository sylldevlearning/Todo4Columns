// node --test scripts/play/   (npm run test:scripts)
import assert from "node:assert/strict";
import { test } from "node:test";
import { pendingUploads, UPLOAD_WINDOW_MS } from "./guard.mjs";

const NOW = Date.parse("2026-11-07T12:00:00Z");
const build = (over) => ({
  id: "b",
  platform: "ANDROID",
  distribution: "STORE",
  status: "FINISHED",
  appBuildVersion: "9",
  completedAt: "2026-11-07T11:00:00Z",
  ...over,
});

test("build en cours : envoi possible", () => {
  const pending = pendingUploads([build({ status: "IN_PROGRESS", completedAt: null })], new Set(["8"]), NOW);
  assert.equal(pending.length, 1);
  assert.match(pending[0].reason, /en cours/);
});

test("build terminé récemment, versionCode absent des canaux : envoi possible", () => {
  assert.equal(pendingUploads([build()], new Set(["8"]), NOW).length, 1);
});

test("versionCode déjà sur un canal : rien en cours", () => {
  assert.deepEqual(pendingUploads([build()], new Set(["8", "9"]), NOW), []);
});

test("build terminé depuis plus longtemps que la fenêtre : rien en cours", () => {
  const old = new Date(NOW - UPLOAD_WINDOW_MS - 1000).toISOString();
  assert.deepEqual(pendingUploads([build({ completedAt: old })], new Set(), NOW), []);
});

test("builds en échec, annulés, iOS ou hors store : ignorés", () => {
  const builds = [
    build({ status: "ERRORED" }),
    build({ status: "CANCELED" }),
    build({ platform: "IOS", status: "IN_PROGRESS" }),
    build({ distribution: "INTERNAL", status: "IN_PROGRESS" }),
  ];
  assert.deepEqual(pendingUploads(builds, new Set(), NOW), []);
});
