import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const root=resolve(import.meta.dirname,'..');
const candidate=JSON.parse(await readFile(join(root,'.release/latest.json'),'utf8'));
assert.equal(createHash('sha256').update(await readFile(candidate.tarball)).digest('hex'),candidate.sha256);
const npmCli=process.env.npm_execpath ?? join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const sandbox=await mkdtemp(join(tmpdir(),'facet-release-'));
const start=performance.now();
const npm=(...args)=>execFileSync(process.execPath,[npmCli,'--cache',join(sandbox,'cache'),'--offline','--ignore-scripts','--no-audit','--no-fund',...args],{cwd:sandbox,encoding:'utf8',windowsHide:true,timeout:90_000});
const cli=join(sandbox,'node_modules/facet-review/runtime/cli/index.js');
const data=join(sandbox,'review data');
let child;
try {
  await writeFile(join(sandbox,'package.json'),'{"name":"isolated-facet-consumer","private":true}\n');
  const npxHelp=npm('exec','--yes',`--package=${candidate.tarball}`,'--','facet','--help');
  assert.match(npxHelp,/Facet: open/,'npm exec must actually invoke the bin entrypoint');
  npm('install',candidate.tarball);
  const manifest=JSON.parse(await readFile(join(sandbox,'node_modules/facet-review/package.json'),'utf8'));
  assert.deepEqual(manifest.dependencies??{},{});
  assert.deepEqual(manifest.scripts??{},{});
  assert.match(execFileSync(process.execPath,[cli,'--help'],{encoding:'utf8'}),/Facet: open/);
  const diagnostics=JSON.parse(execFileSync(process.execPath,[cli,'doctor'],{encoding:'utf8'}));
  assert.equal(diagnostics.supportedNode,true);
  assert.equal(diagnostics.telemetry,'disabled — no diagnostic data transmitted');
  const example=join(sandbox,'node_modules/facet-review/examples/phase3-demo.facet.json');
  child=spawn(process.execPath,[cli,'open',example,'--no-browser','--data-dir',data],{cwd:sandbox,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const startup=await new Promise((resolveStartup,reject)=>{
    let buffer='',errors='';
    const timer=setTimeout(()=>reject(new Error('Packaged CLI startup timed out: '+errors)),15_000);
    child.once('error',error=>{clearTimeout(timer);reject(error)});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Packaged CLI exited ${code}: ${errors}`))});
    child.stderr.on('data',data=>errors+=data);
    child.stdout.on('data',data=>{buffer+=data;if(buffer.includes('\n')){clearTimeout(timer);try{resolveStartup(JSON.parse(buffer.split('\n')[0]))}catch(error){reject(error)}}});
  });
  const response=await fetch(startup.url);
  assert.equal(response.status,200);assert.match(await response.text(),/Feedback inbox/);
  const elapsedMs=Math.round(performance.now()-start);
  assert.ok(elapsedMs<180_000,'Local archive install-to-first-artifact budget exceeded');
  const api=new URL(startup.url).origin+'/api/s/'+startup.sessionId;
  const comment=await fetch(api+'/comments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId:'summary',body:'Installed archive feedback'})});
  assert.equal(comment.status,201);
  child.kill();await new Promise(resolveExit=>child.once('exit',resolveExit));child=undefined;
  npm('uninstall','facet-review');
  assert.match(await readFile(join(data,'sessions',startup.sessionId,'snapshot.json'),'utf8'),/Installed archive feedback/);
  npm('install',candidate.tarball);
  const inbox=JSON.parse(execFileSync(process.execPath,[cli,'inbox',startup.sessionId,'--data-dir',data],{encoding:'utf8'}));
  assert.equal(inbox.openComments[0].body,'Installed archive feedback');
  const exported=join(sandbox,'export');
  execFileSync(process.execPath,[cli,'export',startup.sessionId,exported,'--data-dir',data]);
  assert.match(await readFile(join(exported,'review.html'),'utf8'),/Installed archive feedback/);
  const result={passed:true,platform:process.platform,node:process.version,version:candidate.version,tarballSha256:candidate.sha256,installToFirstArtifactMs:elapsedMs,npmExec:true,offlineInstall:true,isolatedConsumer:true,uninstallPreservesData:true,sameVersionReinstallRecovery:true,crossVersionRollback:'pending prior release',publicRegistryInstall:'not tested — unpublished'};
  await writeFile(join(dirname(candidate.tarball),'install-test.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  if(child && child.exitCode===null){child.kill();await new Promise(resolveExit=>child.once('exit',resolveExit));}
  await rm(sandbox,{recursive:true,force:true});
}
