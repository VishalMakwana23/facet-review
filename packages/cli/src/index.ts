#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { FileSessionStore } from "@facet-review/core";
import {
  decodeCandidate,
  decodeCompactPatch,
  compileIntent,
  inspectArtifact,
  migrateEnvelope,
  type ArtifactEnvelope,
  type CompactPatchEnvelope,
  type FacetArtifact,
  type PatchEnvelope,
  type ProtocolCandidate,
  type CompactIntent,
} from "@facet-review/protocol";
import { renderProductArtifact } from "@facet-review/renderer";
import { startFacetServer, type RunningFacetServer } from "./server.js";

export { startFacetServer, type RunningFacetServer } from "./server.js";

export function parseArtifact(input: unknown): FacetArtifact {
  if (Array.isArray(input) && input[0] === "fi1") return compileIntent(input as CompactIntent);
  if (Array.isArray(input)) return decodeCandidate(input as ProtocolCandidate);
  if (!input || typeof input !== "object") throw new Error("Artifact must be a JSON object or tuple");
  if ("format" in input || "f" in input) return decodeCandidate(input as ProtocolCandidate);
  return migrateEnvelope(input as ArtifactEnvelope);
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, subject, ...rest] = argv;
  if (command === "mcp") {
    const { runMcpServer } = await import("./mcp.js");
    return runMcpServer();
  }
  if (command === "doctor") {
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    const supported = major > 22 || (major === 22 && minor >= 14);
    process.stdout.write(`${JSON.stringify({ node: process.versions.node, platform: process.platform, architecture: process.arch, supportedNode: supported, protocol: "ft1", telemetry: "disabled — no diagnostic data transmitted" }, null, 2)}\n`);
    return supported ? 0 : 1;
  }
  if (command === "--help" || command === "help" || command === "-h") {
    process.stdout.write("Facet: compile <fi1|->, lint <artifact|->, render <artifact|->, open <artifact>, resume <session>, poll <session>, inbox <session>, digest <session>, apply <session> <patch>, resolve-comment <session> <comment>, resolve <session>, export <session> <new-directory>, repair-journal <session> --confirm, doctor, mcp\nOptions: --data-dir <directory>, poll: --after <sequence>, open/resume: --no-browser --port <port>\n");
    return 0;
  }
  if (command === "compile") {
    if (!subject) return usage("Missing compact intent path or - for stdin");
    const intent = JSON.parse(await readInput(subject)) as CompactIntent;
    process.stdout.write(`${JSON.stringify(compileIntent(intent))}\n`);
    return 0;
  }
  if (command === "render") {
    if (!subject) return usage("Missing artifact path or - for stdin");
    const raw: unknown = JSON.parse(await readInput(subject));
    const artifact = Array.isArray(raw) && raw[0] === "fi1" ? compileIntent(raw as CompactIntent) : parseArtifact(raw);
    process.stdout.write(renderProductArtifact(artifact));
    return 0;
  }
  if (command === "lint") {
    if (!subject) return usage("Missing artifact path or - for stdin");
    const raw: unknown = JSON.parse(await readInput(subject));
    const artifact = Array.isArray(raw) && raw[0] === "fi1" ? compileIntent(raw as CompactIntent) : parseArtifact(raw);
    const report = inspectArtifact(artifact);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report.valid ? 0 : 1;
  }
  const dataDirectory = option(rest, "--data-dir") ?? resolve(homedir(), ".facet-review");
  const store = new FileSessionStore(dataDirectory);

  if (command === "open") {
    if (!subject) return usage("Missing artifact path");
    const artifact = parseArtifact(JSON.parse(await readFile(resolve(subject), "utf8")));
    const session = await store.create(artifact);
    const running = await startReviewServer(store, session.id, option(rest, "--port"));
    process.stdout.write(`${JSON.stringify({ sessionId: session.id, url: running.url, dataDirectory })}\n`);
    if (!rest.includes("--no-browser")) await openBrowser(running.url);
    await waitForShutdown(running);
    return 0;
  }

  if (command === "resume") {
    if (!subject) return usage("Missing session ID");
    await store.load(subject);
    const running = await startReviewServer(store, subject, option(rest, "--port"));
    process.stdout.write(`${JSON.stringify({ sessionId: subject, url: running.url, dataDirectory })}\n`);
    if (!rest.includes("--no-browser")) await openBrowser(running.url);
    await waitForShutdown(running);
    return 0;
  }

  if (command === "inbox") {
    if (!subject) return usage("Missing session ID");
    process.stdout.write(`${JSON.stringify(await store.inbox(subject), null, 2)}\n`);
    return 0;
  }

  if (command === "digest") {
    if (!subject) return usage("Missing session ID");
    process.stdout.write(`${JSON.stringify(await store.digest(subject))}\n`);
    return 0;
  }

  if (command === "poll") {
    if (!subject) return usage("Missing session ID");
    const after = Number(option(rest, "--after") ?? "0");
    if (!Number.isSafeInteger(after) || after < 0) return usage("--after must be a non-negative integer");
    const token = randomUUID();
    await store.setAgentPresence(subject, token);
    const heartbeat = setInterval(() => { void store.setAgentPresence(subject, token).catch(() => undefined); }, 2_000);
    heartbeat.unref();
    try {
      while (true) {
        const submission = await store.feedbackSubmission(subject, after);
        if (submission) { process.stdout.write(`${JSON.stringify(submission)}\n`); return 0; }
        await delay(250);
      }
    } finally {
      clearInterval(heartbeat);
      await store.clearAgentPresence(subject, token);
    }
  }

  if (command === "repair-journal") {
    if (!subject || !rest.includes("--confirm")) return usage("Usage: facet repair-journal <session-id> --confirm [--data-dir <path>]. Backs up the journal before removing its unterminated tail.");
    process.stdout.write(`${JSON.stringify(await store.repairJournal(subject))}\n`);
    return 0;
  }

  if (command === "apply") {
    const patchPath = positional(rest);
    if (!subject || !patchPath) return usage("Usage: facet apply <session-id> <patch.json>");
    const encoded: unknown = JSON.parse(await readFile(resolve(patchPath), "utf8"));
    const patch = Array.isArray(encoded) ? decodeCompactPatch(encoded as CompactPatchEnvelope) : encoded as PatchEnvelope;
    const updated = await store.applyArtifactPatch(subject, patch);
    process.stdout.write(`${JSON.stringify({ sessionId: subject, revision: updated.artifact.revision })}\n`);
    return 0;
  }

  if (command === "resolve-comment") {
    const commentId = positional(rest);
    if (!subject || !commentId) return usage("Usage: facet resolve-comment <session-id> <comment-id>");
    await store.resolveComment(subject, commentId);
    process.stdout.write(`${JSON.stringify({ sessionId: subject, commentId, status: "resolved" })}\n`);
    return 0;
  }

  if (command === "resolve") {
    if (!subject) return usage("Missing session ID");
    await store.resolveSession(subject);
    process.stdout.write(`${JSON.stringify({ sessionId: subject, status: "resolved" })}\n`);
    return 0;
  }

  if (command === "export") {
    const outputDirectory = positional(rest);
    if (!subject || !outputDirectory) return usage("Usage: facet export <session-id> <output-directory>");
    await store.exportBundle(subject, outputDirectory, session => {
      const html = renderProductArtifact(session.artifact, { comments: session.comments, decisions: session.decisions, changes: session.revisionChanges, sessionState: session.state, sequence: session.sequence });
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => `'sha256-${createHash("sha256").update(match[1] ?? "").digest("base64")}'`).join(" ");
      return html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${hashes}; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`);
    });
    process.stdout.write(`${JSON.stringify({ sessionId: subject, outputDirectory: resolve(outputDirectory) })}\n`);
    return 0;
  }

  return usage(command ? `Unknown command: ${command}` : undefined);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
function positional(args: string[]): string | undefined {
  const optionValues = new Set(args.flatMap((value, index) => value.startsWith("--") ? [args[index + 1]] : []).filter((value): value is string => Boolean(value)));
  return args.find((value) => !value.startsWith("--") && !optionValues.has(value));
}
function usage(error?: string): number {
  if (error) process.stderr.write(`${error}\n`);
  process.stderr.write("Facet commands: compile <fi1|->, lint <artifact|->, render <artifact|->, open <artifact>, resume <session>, poll <session>, inbox <session>, apply <session> <patch>, resolve-comment <session> <comment>, resolve <session>, export <session> <directory>, mcp\n");
  return 2;
}
async function readInput(subject: string): Promise<string> {
  if (subject !== "-") return readFile(resolve(subject), "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
async function startReviewServer(store: FileSessionStore, sessionId: string, requestedPort?: string): Promise<RunningFacetServer> {
  if (requestedPort !== undefined) return startFacetServer({ store, sessionId, port: Number(requestedPort) });
  const hash = createHash("sha256").update(sessionId).digest();
  const preferredPort = 49_152 + (hash.readUInt32BE(0) % 12_000);
  try { return await startFacetServer({ store, sessionId, port: preferredPort }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    return startFacetServer({ store, sessionId, port: 0 });
  }
}
async function waitForShutdown(running: RunningFacetServer): Promise<void> {
  await new Promise<void>((resolveShutdown) => {
    const stop = (): void => { void running.close().finally(resolveShutdown) };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

const entry = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === entry) {
  runCli().then((code) => { process.exitCode = code }).catch((error: unknown) => {
    process.stderr.write(`Facet error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
