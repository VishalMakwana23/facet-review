import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileIntent, representationReceipt, optimizePatch, applyPatch } from "../packages/protocol/dist/index.js";
import { FileSessionStore } from "../packages/core/dist/index.js";

const intent = ["fi1", "storage-choice", "Storage choice", ["compare", "decide"], [
  ["section", "Context", "Choose a durable storage model."],
  ["comparison", "Comparison", "Compare both approaches.", { headers: ["Criterion", "Local", "Cloud"], rows: [["Access", "One device", "Many devices"]] }],
  ["decision", "Decision", "Choose one.", { options: ["Local", "Cloud"] }],
  ["section", "Context", "A deliberately repeated heading."],
]];
const first = compileIntent(intent), second = compileIntent(intent);
assert.deepEqual(first, second);
assert.deepEqual(first.nodes.map(node => node.id), ["context", "comparison", "decision", "context-2"]);
const receipt = representationReceipt(first);
assert.equal(receipt.basis, "estimated-from-characters");
assert.ok(receipt.compactCharacters < receipt.canonicalCharacters);

const noisy = { artifactId: first.id, baseRevision: 0, nextRevision: 1, operations: [
  { op: "setText", id: "context", value: "Draft" },
  { op: "setText", id: "context", value: "Final" },
  { op: "setData", id: "decision", key: "state", value: "draft" },
  { op: "setData", id: "decision", key: "state", value: "ready" },
] };
const optimized = optimizePatch(noisy);
assert.equal(optimized.operations.length, 2);
assert.deepEqual(applyPatch(first, noisy), applyPatch(first, optimized));

const root = await mkdtemp(join(tmpdir(), "facet-digest-"));
try {
  const store = new FileSessionStore(root), session = await store.create(first);
  const parent = (await store.addComment(session.id, { nodeId: "context", body: "Add evidence" })).comments.at(-1);
  await store.addComment(session.id, { nodeId: "context", body: "Linked source", parentId: parent.id });
  await store.recordDecision(session.id, { nodeId: "decision", selection: "Cloud", confidence: 5 });
  const digest = await store.digest(session.id);
  assert.equal(digest[0], "fd1");
  assert.equal(digest[3].length, 2);
  assert.equal(digest[3][1][3], parent.id);
  assert.deepEqual(digest[4][0].slice(0, 2), ["decision", "Cloud"]);
} finally { await rm(root, { recursive: true, force: true }); }

console.log("Token-system tests passed: deterministic intent compilation, honest estimates, lossless patch optimization, and compact feedback digests.");
