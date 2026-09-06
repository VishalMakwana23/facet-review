import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileIntent } from "../packages/protocol/dist/index.js";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const intent = JSON.parse(await readFile("examples/nextjs-ping-pong-plan.fi1.json", "utf8"));
const html = renderArtifact(compileIntent(intent));
assert.match(html, /data-recipe="milestone-path"/);
assert.match(html, /class="artifact-overview"/);
assert.match(html, /6 phases/);
assert.equal((html.match(/<li><span>0[1-6]<\/span><div><small>Phase/g) ?? []).length, 6);
assert.equal((html.match(/class="node node-risk/g) ?? []).length, 3);
assert.match(html, /class="architecture-map"/);
assert.match(html, /Inspect 8 implementation modules/);
assert.match(html, /class="overview-action"/);
assert.match(html, /class="risk-grid"/);
assert.match(html, /Final gate/);
console.log("Milestone-path tests passed: answer-first overview, system flow, phases, grouped risks, and decision runway render deterministically.");
