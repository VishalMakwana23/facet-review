import assert from "node:assert/strict";
import { compileIntent, inspectArtifact } from "../packages/protocol/dist/index.js";

const comparison = compileIntent(["fi1","storage","Storage",["review","decide"],[
  ["comparison","Comparison","Compare.",{headers:["Criterion","Local","Cloud"],rows:[["Access","One","Many"]]}],
  ["risk","Local: risk","Device loss.",{severity:"high"}],
  ["risk","Cloud: risk","Account compromise.",{severity:"high",mitigation:"Strong authentication"}],
  ["decision","Decision","Choose.",{options:["Local","Cloud"]}],
]]);
const report = inspectArtifact(comparison);
assert.equal(report.kind,"comparison");
assert.equal(report.recipe,"option-showdown");
assert.ok(report.issues.some(issue=>issue.code==="risk-mitigation"));
assert.equal(report.valid,true);

const invalidDecision = structuredClone(comparison);
invalidDecision.nodes.at(-1).data.options=["Only choice"];
const invalidReport = inspectArtifact(invalidDecision);
assert.equal(invalidReport.valid,false);
assert.ok(invalidReport.score < report.score);
console.log("Skill-intelligence tests passed: model-free classification, recipe routing, and actionable quality gates.");
