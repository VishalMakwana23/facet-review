import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { FileSessionStore } from '../packages/core/dist/index.js';
import { renderProductArtifact } from '../packages/renderer/dist/index.js';
import { validateArtifact, applyPatch, decodeCompactPatch } from '../packages/protocol/dist/index.js';
import { runCli, startFacetServer } from '../packages/cli/dist/index.js';

const root = await mkdtemp(join(tmpdir(), 'facet-phase4-'));
const artifact = { protocol:'facet', version:1, revision:0, id:'phase4', title:'Quality tests', theme:'precision-canvas', capabilities:[], nodes:[
  {id:'artifact',type:'section',title:'No shell ID collision',text:'Original text'},
  {id:'code',type:'code',data:{code:'first line\nsecond line\nthird line'}},
  {id:'decision',type:'decision',data:{options:['Accept','Revise']}},
] };
try {
  const store = new FileSessionStore(root), session = await store.create(artifact);
  const comment = anchor => store.addComment(session.id,{nodeId:'artifact',body:'A review',anchor});
  for (const anchor of [null,{kind:'bogus'},{kind:'text',start:0,end:100,quote:'Original'}, {kind:'text',start:0,end:8,quote:'Forged!!'}, {kind:'text',start:0.5,end:8,quote:'Original'},{kind:'code',lineStart:1,lineEnd:1,quote:'Original text'}]) await assert.rejects(comment(anchor));
  assert.equal((await store.load(session.id)).sequence,0,'Rejected anchors cannot mutate state');
  await comment({kind:'text',start:0,end:8,quote:'Original'});
  await assert.rejects(store.addComment(session.id,{nodeId:'code',body:'Bad bounds',anchor:{kind:'code',lineStart:1,lineEnd:8,quote:'first line'}}));
  await assert.rejects(store.addComment(session.id,{nodeId:'code',body:'Partial line',anchor:{kind:'code',lineStart:1,lineEnd:1,quote:'first'}}));
  await store.addComment(session.id,{nodeId:'code',body:'Two lines',anchor:{kind:'code',lineStart:1,lineEnd:2,quote:'first line\nsecond line'}});
  await store.applyArtifactPatch(session.id,{artifactId:'phase4',baseRevision:0,nextRevision:1,operations:[{op:'setText',id:'artifact',value:'Revised text'}]});
  await assert.rejects(store.addComment(session.id,{nodeId:'artifact',body:'Old revision',anchorRevision:0}),/Artifact changed/);
  await assert.rejects(store.recordDecision(session.id,{nodeId:'decision',selection:'Accept',revision:0}),/Artifact changed/);
  const current = await store.load(session.id);
  assert.match(current.revisionChanges[0].details[0].before,/Original text/);
  assert.match(current.revisionChanges[0].details[0].after,/Revised text/);
  const html = renderProductArtifact(current.artifact,{comments:current.comments,changes:current.revisionChanges});
  assert.match(html,/Stale — original quote preserved/);
  assert.equal((html.match(/\sid="artifact"/g)||[]).length,1);
  assert.match(html,/id="node-artifact"/);
  assert.match(renderProductArtifact(artifact,{comments:[{...current.comments[0],nodeId:'missing'}]}),/Orphaned/);
  for(const operations of [[{op:'setText',id:'artifact'}],[{op:'spliceText',id:'artifact',start:0,deleteCount:0,value:1}]]) assert.throws(()=>applyPatch(artifact,{artifactId:artifact.id,baseRevision:0,nextRevision:1,operations}));
  assert.throws(()=>decodeCompactPatch(['fp1',artifact.id,0,1,[['t','artifact','text','extra']]]));
  const evil = structuredClone(artifact); evil.nodes[0].text = '</script><script>alert(1)</script><img src=x onerror=alert(1)>';
  const safe = renderProductArtifact(evil);
  assert.equal((safe.match(/<script>/g)||[]).length,1);
  assert.ok(!safe.includes('<img src=x'));
  for (const data of [1,[],{number:Infinity},{fn:()=>0}]) { const bad=structuredClone(artifact);bad.nodes[0].data=data;assert.equal(validateArtifact(bad).valid,false); }
  const cyclic={};cyclic.self=cyclic;const bad=structuredClone(artifact);bad.nodes[0].data=cyclic;assert.equal(validateArtifact(bad).valid,false);
  const output=join(root,'bundle');
  assert.equal(await runCli(['export',session.id,output,'--data-dir',root]),0);
  const manifest=JSON.parse(await readFile(join(output,'manifest.json'),'utf8'));
  assert.equal(manifest.sequence,current.sequence);
  for(const [name,checksum] of Object.entries(manifest.sha256)) assert.equal(createHash('sha256').update(await readFile(join(output,name))).digest('hex'),checksum);
  assert.match(await readFile(join(output,'review.html'),'utf8'),/A review/);
  assert.match(await readFile(join(output,'review.html'),'utf8'),/"apiBase":null/);
  await assert.rejects(store.exportBundle(session.id,output),/EEXIST/);
  const corrupted=await store.create(artifact);
  const journal=join(root,'sessions',corrupted.id,'events.ndjson');
  await writeFile(journal,'null\n');
  await assert.rejects(store.load(corrupted.id),/Invalid event journal/);
  assert.equal(await readFile(journal,'utf8'),'null\n');
  await writeFile(journal,'');
  await store.addComment(corrupted.id,{nodeId:'artifact',body:'Persisted'});
  await writeFile(journal,'');
  await assert.rejects(store.load(corrupted.id),/Snapshot is ahead/);
  assert.equal(JSON.parse(await readFile(join(output,'feedback.json'),'utf8')).artifactRevision,1);
  const running=await startFacetServer({store,sessionId:session.id});
  try {
    const origin=new URL(running.url).origin;
    const path=origin+'/api/s/'+session.id+'/comments';
    const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json',origin:'null'},body:'{}'});
    assert.equal(response.status,403);
    const tooLarge=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId:'artifact',body:'x'.repeat(70_000)})});
    assert.equal(tooLarge.status,400);
    assert.equal((await store.load(session.id)).sequence,current.sequence);
  } finally { await running.close(); }
  console.log('Phase 4 tests passed: exact anchors, stale revision rejection, semantic diffs, safe immutable exports, injection escaping and bounded validation.');
} finally { await rm(root,{recursive:true,force:true}); }
