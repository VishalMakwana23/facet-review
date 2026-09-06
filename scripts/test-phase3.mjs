import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "../packages/core/dist/index.js";
import { encodeCompactPatch } from "../packages/protocol/dist/index.js";
import { startFacetServer } from "../packages/cli/dist/index.js";
import { spawn } from "node:child_process";

const root = await mkdtemp(join(tmpdir(), "facet-phase3-"));
const output = join(root, "export");
const artifact = {
  protocol: "facet", version: 1, revision: 0, id: "phase3-test", title: "Offline vertical slice", theme: "precision-canvas",
  capabilities: ["annotate section", "approve scope"],
  nodes: [
    { id: "summary", type: "section", title: "Summary", text: "Original plan" },
    { id: "approval", type: "decision", title: "Approval", text: "Choose the outcome", data: { options: ["Approve", "Revise"] } },
  ],
};

try {
  const initialStore = new FileSessionStore(root);
  const created = await initialStore.create(artifact, "2026-09-04T00:00:00.000Z");

  const recoveredComment = { id: "00000000-0000-4000-8000-000000000001", nodeId: "summary", body: "Recovered after interrupted snapshot write", anchorRevision: 0, status: "open", createdAt: "2026-09-04T00:00:01.000Z" };
  const recoveredEvent = { type: "comment.created", id: "00000000-0000-4000-8000-000000000002", sequence: 1, at: recoveredComment.createdAt, comment: recoveredComment };
  await appendFile(join(root, "sessions", created.id, "events.ndjson"), `${JSON.stringify(recoveredEvent)}\n`, "utf8");

  const store = new FileSessionStore(root);
  const recovered = await store.load(created.id);
  assert.equal(recovered.sequence, 1);
  assert.equal(recovered.comments[0].body, recoveredComment.body);

  const running = await startFacetServer({ store, sessionId: created.id });
  const origin = new URL(running.url).origin;
  try {
    const page = await fetch(running.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.match(page.headers.get("content-security-policy"), /script-src 'sha256-/);
    assert.doesNotMatch(page.headers.get("content-security-policy"), /script-src 'unsafe-inline'/);
    assert.match(await page.text(), /Feedback inbox/);
    const endpoint = `${origin}/api/s/${created.id}/comments`;
    assert.equal((await post(endpoint, "https://foreign.example", { nodeId: "summary", body: "reject" })).status, 403);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { "content-type": "text/plain" }, body: '{}' })).status, 400);
    assert.equal((await post(`${origin}/api/s/${created.id}/patch`, origin, ["fp1", artifact.id, 0, 1, [["unknown", "summary", 0, 0]]])).status, 400);
    assert.equal((await store.load(created.id)).sequence, 1);

    const commentResponse = await post(`${origin}/api/s/${created.id}/comments`, origin, { nodeId: "summary", body: "Add a measurable success condition", anchorRevision: 0, anchor: { kind: "text", start: 0, end: 8, quote: "Original" } });
    assert.equal(commentResponse.status, 201);
    const comment = await commentResponse.json();

    const replyResponse = await post(`${origin}/api/s/${created.id}/comments`, origin, { nodeId: "summary", body: "Agreed — use a 90% completion target", anchorRevision: 0, anchor: { kind: "node" }, parentId: comment.id });
    assert.equal(replyResponse.status, 201);
    const reply = await replyResponse.json();
    assert.equal(reply.parentId, comment.id);

    const decisionResponse = await post(`${origin}/api/s/${created.id}/decisions`, origin, { nodeId: "approval", selection: "Revise", rationale: "The success condition is not measurable yet", confidence: 4, owner: "Product", dueDate: "2026-09-12" });
    assert.equal(decisionResponse.status, 201);
    const recordedDecision = await decisionResponse.json();
    assert.equal(recordedDecision.confidence, 4);
    assert.equal(recordedDecision.owner, "Product");

    const patch = encodeCompactPatch({ artifactId: artifact.id, baseRevision: 0, nextRevision: 1, operations: [{ op: "setText", id: "summary", value: "Original plan with a measurable success condition" }] });
    const patchResponse = await post(`${origin}/api/s/${created.id}/patch`, origin, patch);
    assert.equal(patchResponse.status, 200);

    const secondPatch = encodeCompactPatch({ artifactId: artifact.id, baseRevision: 1, nextRevision: 2, operations: [{ op: "move", id: "approval", parentId: null, index: 0 }] });
    assert.equal((await post(`${origin}/api/s/${created.id}/patch`, origin, secondPatch)).status, 200);

    const afterPatch = await store.inbox(created.id);
    assert.equal(afterPatch.artifactRevision, 2);
    assert.equal(afterPatch.openComments.length, 3);
    assert.equal(afterPatch.openComments.find(entry => entry.id === comment.id).anchor.quote, "Original");
    assert.equal(afterPatch.openComments.find(entry => entry.id === reply.id).parentId, comment.id);
    assert.equal(afterPatch.decisions[0].selection, "Revise");
    assert.equal(afterPatch.decisions[0].rationale, "The success condition is not measurable yet");
    assert.deepEqual((await store.load(created.id)).revisionChanges.map((change) => change.revision), [1, 2]);

    const intelligentPage = await fetch(running.url);
    const intelligentHtml = await intelligentPage.text();
    assert.match(intelligentHtml, /class="annotation-pin"/);
    assert.match(intelligentHtml, /data-feedback-filter="open"/);
    assert.match(intelligentHtml, /class="reply-list"/);
    assert.match(intelligentHtml, /Decision ledger/);

    assert.equal((await post(`${origin}/api/s/${created.id}/comments/${comment.id}/resolve`, origin, {})).status, 200);
    assert.equal((await post(`${origin}/api/s/${created.id}/comments/${reply.id}/resolve`, origin, {})).status, 200);
    await store.resolveComment(created.id, recoveredComment.id);
    assert.equal((await post(`${origin}/api/s/${created.id}/resolve`, origin, {})).status, 200);
  } finally {
    await running.close();
  }

  const restartedStore = new FileSessionStore(root);
  const restarted = await restartedStore.load(created.id);
  assert.equal(restarted.state, "resolved");
  assert.equal(restarted.artifact.revision, 2);
  assert.equal(restarted.comments.every((comment) => comment.status === "resolved"), true);
  await assert.rejects(restartedStore.applyArtifactPatch(created.id, { artifactId: artifact.id, baseRevision: 2, nextRevision: 3, operations: [] }), /resolved session/);
  await restartedStore.exportBundle(created.id, output);
  assert.equal(JSON.parse(await readFile(join(output, "feedback.json"), "utf8")).state, "resolved");
  const damaged = await store.create(artifact);
  const journal = join(root, "sessions", damaged.id, "events.ndjson");
  await appendFile(journal, '{"incomplete":', 'utf8');
  await assert.rejects(store.addComment(damaged.id, { nodeId: "summary", body: "must not append" }), /Incomplete event journal/);
  assert.equal(await readFile(journal, 'utf8'), '{"incomplete":');
  const repair = await store.repairJournal(damaged.id);
  assert.equal(repair.repaired, true);
  assert.equal(await readFile(repair.backupPath, 'utf8'), '{"incomplete":');
  await store.addComment(damaged.id, { nodeId: 'summary', body: 'After repair' });
  assert.equal((await store.load(damaged.id)).sequence, 1);
  assert.equal((await store.repairJournal(damaged.id)).repaired, false);
  const snapshottedJournal = await readFile(journal);
  await writeFile(journal, snapshottedJournal.subarray(0, snapshottedJournal.length - 1));
  await assert.rejects(store.repairJournal(damaged.id), /snapshotted event/);
  assert.deepEqual(await readFile(journal), snapshottedJournal.subarray(0, snapshottedJournal.length - 1));

  const interrupted = await store.create(artifact);
  await mkdir(join(root, 'sessions', interrupted.id, 'transaction.lock'));
  await assert.rejects(store.addComment(interrupted.id, { nodeId: 'summary', body: 'must wait' }), /Session busy or interrupted lock/);
  assert.equal(await readFile(join(root, 'sessions', interrupted.id, 'events.ndjson'), 'utf8'), '');

  const concurrent = await store.create(artifact);
  const moduleUrl = new URL('../packages/core/dist/index.js', import.meta.url).href;
  const workers = await Promise.allSettled(Array.from({ length: 4 }, (_, worker) => new Promise((resolveWorker, reject) => {
    const code = `import {FileSessionStore} from ${JSON.stringify(moduleUrl)}; const store = new FileSessionStore(${JSON.stringify(root)}); for(let i=0;i<8;i++) await store.addComment(${JSON.stringify(concurrent.id)}, {nodeId:'summary', body:${JSON.stringify('worker-' + worker + '-')}+i});`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', (chunk) => errors += chunk);
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolveWorker() : reject(new Error(errors)));
  })));
  for (const worker of workers) if (worker.status === 'rejected') throw worker.reason;
  const combined = await store.load(concurrent.id);
  assert.equal(combined.sequence, 32);
  assert.equal(new Set(combined.comments.map((comment) => comment.body)).size, 32);
  const records = (await readFile(join(root, 'sessions', concurrent.id, 'events.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(records.map((event) => event.sequence), Array.from({ length: 32 }, (_, i) => i + 1));
  console.log("Phase 3 tests passed: crash recovery, HTTP review, feedback, decision, patch, resolve, restart, and export work offline.");
} finally {
  await rm(root, { recursive: true, force: true });
}

function post(url, origin, body) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
}
