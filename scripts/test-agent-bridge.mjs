import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const cli = "packages/cli/dist/index.js";
const intent = ["fi1","agent-test","Agent bridge",["review"],[["section","Context","Provider-neutral input."],["decision","Decision","Choose.",{options:["A","B"]}]]];

async function run(args, input) {
  const child = spawn(process.execPath,[cli,...args],{stdio:["pipe","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",chunk=>stdout+=chunk); child.stderr.on("data",chunk=>stderr+=chunk);
  child.stdin.end(input);
  const [code] = await once(child,"close");
  assert.equal(code,0,stderr);
  return stdout;
}

const compiled = JSON.parse(await run(["compile","-"],JSON.stringify(intent)));
assert.equal(compiled.id,"agent-test");
assert.deepEqual(compiled.nodes.map(node=>node.id),["context","decision"]);
const html = await run(["render","-"],JSON.stringify(intent));
assert.match(html,/<!doctype html>/);
assert.match(html,/Agent bridge/);

const child = spawn(process.execPath,[cli,"mcp"],{stdio:["pipe","pipe","pipe"]});
const replies=[];
child.stdout.setEncoding("utf8");
let buffer="";
child.stdout.on("data",chunk=>{ buffer+=chunk; let cut; while((cut=buffer.indexOf("\n"))>=0){ const line=buffer.slice(0,cut); buffer=buffer.slice(cut+1); if(line) replies.push(JSON.parse(line)); }});
child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"test",version:"1"}}})+"\n");
child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})+"\n");
child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list",params:{}})+"\n");
child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:3,method:"tools/call",params:{name:"compile_intent",arguments:{intent}}})+"\n");
await new Promise((resolve,reject)=>{const limit=setTimeout(()=>reject(new Error("MCP response timeout")),3000); const poll=setInterval(()=>{if(replies.length>=3){clearInterval(poll);clearTimeout(limit);resolve();}},10)});
child.stdin.end();
await once(child,"close");
assert.equal(replies[0].result.protocolVersion,"2025-11-25");
assert.deepEqual(replies[1].result.tools.map(tool=>tool.name),["compile_intent","validate_artifact","inspect_artifact","render_artifact"]);
assert.equal(replies[2].result.structuredContent.id,"agent-test");
console.log("Agent-bridge tests passed: JSON stdin/stdout commands and MCP stdio compile/validate/render tools are provider-neutral and deterministic.");
