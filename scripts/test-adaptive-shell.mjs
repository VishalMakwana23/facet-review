import assert from "node:assert/strict";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const artifact = { protocol:"facet",version:1,revision:0,id:"shell-test",title:"Adaptive shell",theme:"precision-canvas",capabilities:["review"],nodes:[
  {id:"overview",type:"section",title:"Overview",text:"A readable overview."},
  {id:"decision",type:"decision",title:"Decision",text:"Choose.",data:{options:["Approve","Revise"]}},
]};
const html = renderArtifact(artifact,{comments:[{id:"c1",nodeId:"overview",body:"Clarify",anchorRevision:0,status:"open"}]});
assert.match(html,/id="section-navigator"/);
assert.match(html,/data-toggle-sections/);
assert.match(html,/data-review-width/);
for (const density of ["comfortable","compact","presentation"]) assert.match(html,new RegExp(`data-density="${density}"`));
assert.match(html,/class="nav-count"/);
assert.match(html,/IntersectionObserver/);
assert.match(html,/matchMedia\('\(min-width:0px\)'\)/);
assert.match(html,/class="artifact-overview"/);
console.log("Adaptive-shell tests passed: collapsible section map, resizable review rail, density modes, active-location tracking, and comment indicators.");
