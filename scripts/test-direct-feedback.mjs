import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore } from "../packages/core/dist/index.js";
import { compileIntent } from "../packages/protocol/dist/index.js";
import { startFacetServer } from "../packages/cli/dist/server.js";

const root = await mkdtemp(join(tmpdir(), "facet-direct-feedback-"));
const store = new FileSessionStore(root);
const artifact = compileIntent(["fi1","direct-feedback-test","Direct feedback",["review"],[["section","Plan","Review this plan."]]]);
const session = await store.create(artifact);
const cli = "packages/cli/dist/index.js";

try {
  const poll = spawn(process.execPath,[cli,"poll",session.id,"--data-dir",root],{stdio:["ignore","pipe","pipe"]});
  let stdout = "", stderr = "";
  poll.stdout.setEncoding("utf8"); poll.stderr.setEncoding("utf8");
  poll.stdout.on("data",chunk=>stdout+=chunk); poll.stderr.on("data",chunk=>stderr+=chunk);
  for (let attempt=0; attempt<40 && !(await store.agentListening(session.id)); attempt+=1) await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(await store.agentListening(session.id),true,"poll should advertise an active listener");

  const running = await startFacetServer({store,sessionId:session.id});
  try {
    const origin = new URL(running.url).origin;
    const api = `${origin}/api/s/${session.id}`;
    const headers = {"content-type":"application/json",origin};
    const comment = await fetch(`${api}/comments`,{method:"POST",headers,body:JSON.stringify({nodeId:"plan",body:"Split this into smaller phases",anchorRevision:0})});
    assert.equal(comment.status,201);
    const submitted = await fetch(`${api}/submit`,{method:"POST",headers,body:JSON.stringify({end:false})});
    assert.equal(submitted.status,201);
  } finally { await running.close(); }

  const [code] = await once(poll,"close");
  assert.equal(code,0,stderr);
  const packet = JSON.parse(stdout.trim());
  assert.equal(packet[0],"fs1");
  assert.equal(packet[1],"direct-feedback-test");
  assert.equal(packet[4],0);
  assert.equal(packet[5][0][2],"Split this into smaller phases");
  assert.equal(await store.agentListening(session.id),false,"listener presence should clear after delivery");
  console.log("Direct-feedback tests passed: browser submit wakes the CLI poll with a compact fs1 packet and accurate presence.");
} finally {
  await rm(root,{recursive:true,force:true});
}
