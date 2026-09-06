import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, "benchmarks/competitive/manifest.json"), "utf8"));
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.frozen, true);
assert.equal(manifest.cases.length, 5);
assert.equal(new Set(manifest.cases.map((entry) => entry.id)).size, manifest.cases.length);
for (const entry of manifest.cases) {
  assert.ok(entry.prompt.length > 100, `${entry.id} prompt must be substantive`);
  assert.ok(entry.revisionPrompt.length > 50, `${entry.id} revision prompt must be substantive`);
  assert.ok(entry.requiredContent.length >= 7, `${entry.id} must define content parity`);
  assert.ok(entry.requiredInteractions.length >= 3, `${entry.id} must define interaction parity`);
}
const capture = JSON.parse(await readFile(resolve(root, "benchmarks/competitive/captures/expense-tracker-storage-review/capture.json"), "utf8"));
assert.equal(capture.caseId, manifest.cases[0].id);
assert.equal(capture.status, "partial");
assert.equal(capture.evaluation.contentParity, "pending");
assert.equal(capture.variants.facet.initialTurnUsage, null);
assert.equal(capture.variants.lavish.initialTurnUsage, null);
console.log("Competitive benchmark contracts passed.");
