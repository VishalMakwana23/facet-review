import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decodeCandidate, decodeCompactPatch, applyPatch } from "../packages/protocol/dist/index.js";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const base = decodeCandidate(JSON.parse(await readFile(new URL("../expense-tracker-storage-review.facet.json", import.meta.url), "utf8")));
const patch = decodeCompactPatch(JSON.parse(await readFile(new URL("../expense-tracker-storage-review-rev1.patch.json", import.meta.url), "utf8")));
const artifact = applyPatch(base, patch);
const html = renderArtifact(artifact);

assert.match(html, /data-recipe="option-showdown"/);
assert.match(html, /data-layout-recipe="option-showdown"/);
assert.equal((html.match(/class="option-card"/g) ?? []).length, 2);
assert.match(html, /class="risk-details"/);
assert.match(html, /Recommended direction/);
assert.match(html, /Choose cloud sync for launch/);
assert.match(html, /Choose local-only storage/);
assert.match(html, /Choose cloud sync/);
for (const id of ["local-benefits", "local-risks", "cloud-benefits", "cloud-risks", "recommendation", "storage-decision"]) {
  assert.match(html, new RegExp(`data-node-id="${id}"`));
}

console.log("Option Showdown tests passed: deterministic recipe, paired option cards, visible risk details, recommendation, decisions, and stable anchors.");
