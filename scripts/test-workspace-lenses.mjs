import assert from "node:assert/strict";
import { renderArtifact } from "../packages/renderer/dist/index.js";

const artifact = { protocol:"facet", version:1, revision:2, id:"lens-test", title:"Lens test", theme:"precision-canvas", capabilities:["review"], nodes:[
  { id:"summary", type:"section", title:"Summary", text:"Overview" },
  { id:"evidence", type:"citation", title:"Evidence", text:"Measured result", data:{source:"Primary source",confidence:"high"} },
  { id:"assumption", type:"risk", title:"Unverified assumption", text:"May change", data:{severity:"Medium",mitigation:"Validate"} },
  { id:"recommendation", type:"callout", title:"Recommendation", text:"Proceed carefully" },
  { id:"decision", type:"decision", title:"Decision", text:"Choose", data:{options:["Proceed","Pause"]} },
] };
const html = renderArtifact(artifact, {
  comments:[{id:"c1",nodeId:"assumption",body:"Validate first",anchorRevision:2,status:"open"}],
  decisions:[{id:"d1",nodeId:"decision",selection:"Proceed",revision:2,confidence:4,owner:"Team"}],
  changes:[{revision:2,nodeIds:["assumption"],operations:[{op:"setText"}]}],
});

for (const lens of ["all","summary","evidence","risk","change","decision","story","board","focus"]) assert.match(html,new RegExp(`data-lens="${lens}"`));
assert.match(html,/Decision cockpit/);
assert.match(html,/data-evidence-gravity="strong"/);
assert.match(html,/data-evidence-gravity="provisional"/);
assert.match(html,/data-changed="true"/);
assert.match(html,/Revision 2/);
assert.match(html,/No artifact regeneration used/);

console.log("Workspace-lens tests passed: nine local lenses, Decision Cockpit, Evidence Gravity, and Revision Radar hooks render from one artifact.");
