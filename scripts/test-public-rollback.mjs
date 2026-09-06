import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';

const previousVersion = process.env.FACET_PREVIOUS_VERSION ?? '0.1.0-alpha.1';
const currentVersion = process.env.FACET_CURRENT_VERSION ?? '0.1.0-alpha.5';
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const sandbox = await mkdtemp(join(tmpdir(), 'facet-public-rollback-'));
const dataDir = join(sandbox, 'review-data');
let child;

const npm = (...args) => execFileSync(
  process.execPath,
  [npmCli, '--cache', join(sandbox, 'cache'), '--ignore-scripts', '--no-audit', '--no-fund', ...args],
  { cwd: sandbox, encoding: 'utf8', windowsHide: true, timeout: 120_000 },
);

const cliPath = () => join(sandbox, 'node_modules/facet-review/runtime/cli/index.js');

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function startCli(args) {
  child = spawn(process.execPath, [cliPath(), ...args], {
    cwd: sandbox,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timer = setTimeout(() => reject(new Error(`Facet startup timed out: ${errors}`)), 20_000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Facet exited ${code}: ${errors}`));
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (!output.includes('\n')) return;
      clearTimeout(timer);
      try {
        resolve(JSON.parse(output.split('\n')[0]));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function stopCli() {
  if (!child || child.exitCode !== null) return;
  const exiting = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await exiting;
  child = undefined;
}

try {
  await writeFile(join(sandbox, 'package.json'), '{"name":"facet-public-rollback","private":true}\n');

  npm('install', `facet-review@${previousVersion}`);
  const example = join(sandbox, 'node_modules/facet-review/examples/phase3-demo.facet.json');
  const initial = await startCli(['open', example, '--no-browser', '--port', String(await availablePort()), '--data-dir', dataDir]);
  const api = `${new URL(initial.url).origin}/api/s/${initial.sessionId}`;
  const comment = await fetch(`${api}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nodeId: 'summary', body: 'Cross-version rollback evidence' }),
  });
  assert.equal(comment.status, 201);
  await stopCli();

  npm('install', `facet-review@${currentVersion}`);
  let inbox = JSON.parse(execFileSync(process.execPath, [cliPath(), 'inbox', initial.sessionId, '--data-dir', dataDir], { encoding: 'utf8' }));
  assert.equal(inbox.openComments[0].body, 'Cross-version rollback evidence');
  const upgraded = await startCli(['resume', initial.sessionId, '--no-browser', '--port', String(await availablePort()), '--data-dir', dataDir]);
  assert.equal((await fetch(upgraded.url)).status, 200);
  await stopCli();

  npm('install', `facet-review@${previousVersion}`);
  inbox = JSON.parse(execFileSync(process.execPath, [cliPath(), 'inbox', initial.sessionId, '--data-dir', dataDir], { encoding: 'utf8' }));
  assert.equal(inbox.openComments[0].body, 'Cross-version rollback evidence');
  const exportDir = join(sandbox, 'rollback-export');
  execFileSync(process.execPath, [cliPath(), 'export', initial.sessionId, exportDir, '--data-dir', dataDir]);
  assert.match(await readFile(join(exportDir, 'review.html'), 'utf8'), /Cross-version rollback evidence/);

  console.log(JSON.stringify({
    passed: true,
    previousVersion,
    currentVersion,
    upgradeResume: true,
    rollbackInbox: true,
    rollbackExport: true,
  }, null, 2));
} finally {
  await stopCli();
  await rm(sandbox, { recursive: true, force: true });
}
