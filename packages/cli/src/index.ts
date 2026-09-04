#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FileSessionStore } from "@facet-review/core";
import {
  decodeCandidate,
  decodeCompactPatch,
  migrateEnvelope,
  type ArtifactEnvelope,
  type CompactPatchEnvelope,
  type FacetArtifact,
  type PatchEnvelope,
  type ProtocolCandidate,
} from "@facet-review/protocol";
import { renderProductArtifact } from "@facet-review/renderer";
import { startFacetServer, type RunningFacetServer } from "./server.js";

export { startFacetServer, type RunningFacetServer } from "./server.js";

export function parseArtifact(input: unknown): FacetArtifact {
  if (Array.isArray(input)) return decodeCandidate(input as ProtocolCandidate);
  if (!input || typeof input !== "object") throw new Error("Artifact must be a JSON object or tuple");
  if ("format" in input || "f" in input) return decodeCandidate(input as ProtocolCandidate);
  return migrateEnvelope(input as ArtifactEnvelope);
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const [command, subject, ...rest] = argv;
  const dataDirectory = option(rest, "--data-dir") ?? resolve(homedir(), ".facet-review");
  const store = new FileSessionStore(dataDirectory);

  if (command === "open") {
    if (!subject) return usage("Missing artifact path");
    const artifact = parseArtifact(JSON.parse(await readFile(resolve(subject), "utf8")));
    const session = await store.create(artifact);
    const running = await startFacetServer({ store, sessionId: session.id, port: Number(option(rest, "--port") ?? "0") });
    process.stdout.write(`${JSON.stringify({ sessionId: session.id, url: running.url, dataDirectory })}\n`);
    if (!rest.includes("--no-browser")) await openBrowser(running.url);
    await waitForShutdown(running);
    return 0;
  }

  if (command === "resume") {
    if (!subject) return usage("Missing session ID");
    await store.load(subject);
    const running = await startFacetServer({ store, sessionId: subject, port: Number(option(rest, "--port") ?? "0") });
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
  process.stderr.write("Facet commands: open <artifact>, resume <session>, inbox <session>, apply <session> <patch>, resolve-comment <session> <comment>, resolve <session>, export <session> <directory>\n");
  return 2;
}
async function openBrowser(url: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
async function waitForShutdown(running: RunningFacetServer): Promise<void> {
  await new Promise<void>((resolveShutdown) => {
    const stop = (): void => { void running.close().finally(resolveShutdown) };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  runCli().then((code) => { process.exitCode = code }).catch((error: unknown) => {
    process.stderr.write(`Facet error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
