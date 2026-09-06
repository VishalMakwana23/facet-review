import assert from "node:assert/strict";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const artifact = { protocol:"facet",version:1,revision:0,id:"visual-test",title:"Decision intelligence",theme:"precision-canvas",capabilities:["review"],nodes:[
  {id:"score",type:"chart",title:"Weighted score",data:{kind:"scorecard",summary:"Cloud leads on mandatory access",options:["Local","Cloud"],rows:[["Cross-device",1,5],["Privacy",5,3]],max:5}},
  {id:"risk",type:"chart",title:"Risk map",data:{kind:"risk-matrix",summary:"Account compromise is the highest exposure",items:[{label:"Device loss",likelihood:3,impact:4},{label:"Account compromise",likelihood:2,impact:5}]}},
  {id:"tokens",type:"chart",title:"Token flow",data:{kind:"token-waterfall",summary:"Compact intent avoids repeated context",items:[["Initial intent",420],["Digest reuse",-260]]}},
  {id:"time",type:"timeline",title:"Milestones",data:{items:[{label:"Prototype",detail:"Local proof"},{label:"Validate",status:"Ready"}]}},
  {id:"deps",type:"dependency",title:"Dependencies",data:{items:[{from:"Evidence",to:"Recommendation"},{from:"Recommendation",to:"Decision"}]}},
]};

const html = renderArtifact(artifact);
for (const marker of ["scorecard","risk-matrix","token-waterfall","semantic-timeline","dependency-map"]) assert.match(html,new RegExp(marker));
assert.equal((html.match(/View accessible data table/g) ?? []).length,3);
assert.match(html,/Values are also available in the data table/);
assert.match(html,/Likelihood \(1–5\)/);
assert.match(html,/How to read it:/);
assert.match(html,/Higher impact ↑/);
assert.match(html,/More likely →/);
assert.match(html,/Act now/);
assert.match(html,/What to address first/);
assert.match(html,/Exposure 12\/25/);
assert.doesNotMatch(html,/<ol class="matrix-key"/);
assert.doesNotMatch(html,/<svg|<canvas/);
console.log("Visualization-intelligence tests passed: explanatory risk matrix, direct labels, ranked priorities, semantic views, and accessible data-table fallbacks.");
