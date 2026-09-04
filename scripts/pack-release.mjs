import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile, chmod } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const manifest = JSON.parse(await readFile(join(root,'release/package.json'),'utf8'));
if (manifest.private !== true) throw new Error('Local release staging requires private:true until publication is explicitly configured');
await mkdir(join(root,'.release'),{recursive:true});
const output = await mkdtemp(join(root,'.release','candidate-'));
const stage = join(output,'package');
await mkdir(stage);
const names = ['protocol','renderer','core','cli'];
for (const name of names) {
  const destination=join(stage,'runtime',name);
  await mkdir(destination,{recursive:true});
  for (const file of await readdir(join(root,'packages',name,'dist'))) {
    if (!file.endsWith('.js')) continue;
    let source=await readFile(join(root,'packages',name,'dist',file),'utf8');
    // Closed allowlist: ship local JS modules, not unresolved private workspace packages.
    for(const dependency of names) source=source.replaceAll(`"@facet-review/${dependency}"`,`"../${dependency}/index.js"`);
    source=source.replace(/^\/\/# sourceMappingURL=.*$/gm,'');
    if (source.includes('"@facet-review/')) throw new Error(`Unresolved runtime import in ${name}/${file}`);
    await writeFile(join(destination,file),source,{flag:'wx'});
  }
}
await chmod(join(stage,'runtime/cli/index.js'),0o755);
await writeFile(join(stage,'package.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
await cp(join(root,'plugins/facet-review'),join(stage,'plugin'),{recursive:true,errorOnExist:true});
await cp(join(root,'examples'),join(stage,'examples'),{recursive:true,errorOnExist:true});
for(const name of ['LICENSE','SECURITY.md']) await cp(join(root,name),join(stage,name));
await cp(join(root,'release/README.md'),join(stage,'README.md'));
const packed=JSON.parse(execFileSync(process.execPath,[npmCli,'pack','--json','--ignore-scripts','--pack-destination',output],{cwd:stage,encoding:'utf8',windowsHide:true}))[0];
if (!packed || !/^[a-z0-9.-]+\.tgz$/.test(packed.filename)) throw new Error('Unexpected npm pack result');
for(const entry of packed.files) {
  if (!/^(runtime\/|plugin\/|examples\/|package\.json$|README\.md$|LICENSE$|SECURITY\.md$)/.test(entry.path) || /(?:^|\/)(?:node_modules|\.env|\.git)(?:\/|$)/.test(entry.path)) throw new Error(`Unexpected packed path: ${entry.path}`);
}
const tarball=join(output,packed.filename);
const result={version:manifest.version,packageName:manifest.name,private:manifest.private,tarball,sha256:createHash('sha256').update(await readFile(tarball)).digest('hex'),bytes:packed.size,fileCount:packed.files.length,files:packed.files.map(f=>f.path)};
await writeFile(join(output,'manifest.json'),JSON.stringify(result,null,2)+'\n');
await writeFile(join(root,'.release/latest.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
