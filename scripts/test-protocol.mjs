import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyPatch, canonicalJson, collectNodeIds, decodeCompactPatch, decodeGraph, decodeTree, decodeTuple,
  encodeCompactPatch, encodeGraph, encodeTree, encodeTuple, migrateEnvelope, validateArtifact,
} from "../packages/protocol/dist/index.js";

const artifact = {
  protocol: "facet", version: 1, revision: 0, id: "protocol-test", title: "Protocol test",
  theme: "precision-canvas", capabilities: ["annotate section", "approve scope"],
  nodes: [
    { id: "summary", type: "section", title: "Summary", text: "Canonical content", children: [{ id: "risk", type: "risk", title: "Risk", text: "Stable nested ID" }] },
    { id: "decision", type: "decision", title: "Decision", text: "Choose a direction", data: { options: ["Continue", "Revise"] } },
  ],
};

assert.equal(validateArtifact(artifact).valid, true);
for (const [encoded, decode] of [[encodeTree(artifact), decodeTree], [encodeGraph(artifact), decodeGraph], [encodeTuple(artifact), decodeTuple]]) {
  assert.equal(canonicalJson(decode(encoded)), canonicalJson(artifact));
}

const revision1Patch = { artifactId: artifact.id, baseRevision: 0, nextRevision: 1, operations: [{ op: "spliceText", id: "summary", start: artifact.nodes[0].text.length, deleteCount: 0, value: " revised" }] };
assert.deepEqual(decodeCompactPatch(encodeCompactPatch(revision1Patch)), revision1Patch);
const revision1 = applyPatch(artifact, revision1Patch);
const revision2Patch = { artifactId: artifact.id, baseRevision: 1, nextRevision: 2, operations: [{ op: "move", id: "decision", parentId: null, index: 0 }] };
const revision2a = applyPatch(revision1, revision2Patch);
const revision2b = applyPatch(revision1, revision2Patch);
assert.equal(canonicalJson(revision2a), canonicalJson(revision2b));
assert.deepEqual(new Set(collectNodeIds(revision2a)), new Set(collectNodeIds(artifact)));
assert.throws(() => applyPatch(revision1, { ...revision2Patch, baseRevision: 0 }), /expects revision/);

const migrated = migrateEnvelope({ schemaVersion: 0, document: { id: artifact.id, title: artifact.title, blocks: artifact.nodes, actions: artifact.capabilities } });
assert.equal(canonicalJson(migrated), canonicalJson(artifact));
const invalid = structuredClone(artifact); invalid.nodes.push({ ...invalid.nodes[0] });
assert.equal(validateArtifact(invalid).valid, false);

const fixture = async (path) => JSON.parse(await readFile(new URL(`../packages/protocol/fixtures/${path}`, import.meta.url), "utf8"));
const minimalTuple = await fixture("valid/minimal-tuple.json");
assert.equal(validateArtifact(decodeTuple(minimalTuple)).valid, true);
const legacyFixture = await fixture("valid/legacy-v0.json");
assert.equal(migrateEnvelope(legacyFixture).revision, 3);
const invalidTuple = await fixture("invalid/unknown-node-type-tuple.json");
assert.throws(() => decodeTuple(invalidTuple), /Unknown compact node type index/);
const tupleSchema = JSON.parse(await readFile(new URL("../packages/protocol/schema/facet-tuple-v1.schema.json", import.meta.url), "utf8"));
assert.equal(tupleSchema.$defs.artifact.prefixItems[0].const, "ft1");

console.log("Protocol tests passed: candidates and fixtures conform, migration is lossless, patches are deterministic, and stale revisions fail.");
