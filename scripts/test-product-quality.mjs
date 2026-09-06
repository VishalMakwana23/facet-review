import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { compileIntent, inspectArtifact } from "../packages/protocol/dist/index.js";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const intent = JSON.parse(await readFile("examples/world-class-decision.fi1.json","utf8"));
const artifact = compileIntent(intent);
const inspection = inspectArtifact(artifact);
assert.equal(inspection.recipe,"option-showdown");
assert.equal(inspection.valid,true);
assert.ok(inspection.score >= 95,JSON.stringify(inspection));
const first = renderArtifact(artifact), second = renderArtifact(artifact);
assert.equal(first,second);
assert.match(first,/Cloud sync leads because cross-device access is mandatory/);
assert.equal((first.match(/View accessible data table/g) ?? []).length,2);

const milestoneIntent = JSON.parse(await readFile("examples/nextjs-ping-pong-plan.fi1.json","utf8"));
const milestoneArtifact = compileIntent(milestoneIntent);
const milestoneHtml = renderArtifact(milestoneArtifact);
assert.match(milestoneHtml,/data-recipe="milestone-path"/);
assert.match(milestoneHtml,/class="artifact-overview"/);
assert.match(milestoneHtml,/6 phases/);
assert.match(milestoneHtml,/class="architecture-map"/);
assert.match(milestoneHtml,/class="risk-grid"/);
assert.match(milestoneHtml,/Review the decision/);

const large = structuredClone(artifact);
large.id="quality-stress";
large.nodes = Array.from({length:600},(_,index)=>({id:`section-${index}`,type:"section",title:`Evidence ${index+1}`,text:"Bounded deterministic review content."}));
const started=performance.now();
const largeHtml=renderArtifact(large);
const elapsed=performance.now()-started;
assert.equal((largeHtml.match(/data-node-id=/g) ?? []).length,600);
assert.ok(elapsed < 500,`600-node render took ${elapsed.toFixed(1)}ms`);
console.log(`Product-quality tests passed: world-class fixture score ${inspection.score}/100, deterministic semantic visuals, and 600-node render in ${elapsed.toFixed(1)}ms.`);
