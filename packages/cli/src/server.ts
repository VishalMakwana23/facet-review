import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { FileSessionStore, ReviewAnchor } from "@facet-review/core";
import { decodeCompactPatch, type CompactPatchEnvelope, type PatchEnvelope } from "@facet-review/protocol";
import { renderProductArtifact } from "@facet-review/renderer";

export interface StartFacetServerOptions { store: FileSessionStore; sessionId: string; port?: number }
export interface RunningFacetServer { server: Server; url: string; sessionId: string; close(): Promise<void> }

export async function startFacetServer(options: StartFacetServerOptions): Promise<RunningFacetServer> {
  const session = await options.store.load(options.sessionId);
  const server = createServer((request, response) => { void handleRequest(options.store, session.id, request, response) });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => { server.off("error", reject); resolveListen() });
  });
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}/s/${session.id}`;
  return { server, url, sessionId: session.id, close: () => new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose())) };
}

async function handleRequest(store: FileSessionStore, sessionId: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (request.headers.host !== `127.0.0.1:${request.socket.localPort}`) return sendJson(response, 403, { error: "Invalid local Host header" });
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === `/s/${sessionId}` && request.method === "GET") {
      const session = await store.load(sessionId);
      const html = renderProductArtifact(session.artifact, { apiBase: `/api/s/${sessionId}`, comments: session.comments, decisions: session.decisions, changes: session.revisionChanges, sessionState: session.state, sequence: session.sequence });
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => `'sha256-${createHash("sha256").update(match[1] ?? "").digest("base64")}'`).join(" ");
      response.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; script-src ${hashes}; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
      return send(response, 200, html, "text/html; charset=utf-8");
    }
    if (!url.pathname.startsWith(`/api/s/${sessionId}`)) return sendJson(response, 404, { error: "Not found" });
    if (request.method !== "GET" && !sameOrigin(request)) return sendJson(response, 403, { error: "Cross-origin mutation rejected" });
    const action = url.pathname.slice(`/api/s/${sessionId}`.length);
    if (request.method === "GET" && action === "") return sendJson(response, 200, await store.load(sessionId));
    if (request.method === "GET" && action === "/inbox") return sendJson(response, 200, await store.inbox(sessionId));
    if (request.method === "GET" && action === "/presence") return sendJson(response, 200, { listening: await store.agentListening(sessionId) });
    if (request.method === "GET" && action === "/export/html") {
      const session = await store.load(sessionId);
      const html = standaloneReviewHtml(renderProductArtifact(session.artifact, { comments: session.comments, decisions: session.decisions, changes: session.revisionChanges, sessionState: session.state, sequence: session.sequence }));
      response.setHeader("Content-Disposition", `attachment; filename="${exportFilename(session.artifact.id, session.artifact.revision)}"`);
      response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
      return send(response, 200, html, "text/html; charset=utf-8");
    }
    if (request.method === "POST" && action === "/comments") {
      const body = await jsonBody(request);
      const input: { nodeId: string; body: string; anchorRevision?: number; anchor?: ReviewAnchor; parentId?: string } = { nodeId: stringField(body, "nodeId"), body: stringField(body, "body") };
      const anchorRevision = numberField(body, "anchorRevision");
      if (anchorRevision !== undefined) input.anchorRevision = anchorRevision;
      const anchor = objectField(body, "anchor");
      if (anchor !== undefined) input.anchor = anchor as unknown as ReviewAnchor;
      const parentId = optionalStringField(body, "parentId");
      if (parentId !== undefined) input.parentId = parentId;
      const session = await store.addComment(sessionId, input);
      return sendJson(response, 201, session.comments.at(-1));
    }
    if (request.method === "POST" && action === "/decisions") {
      const body = await jsonBody(request);
      const revision = numberField(body, "revision");
      const confidence = numberField(body, "confidence");
      const rationale = optionalStringField(body, "rationale"), owner = optionalStringField(body, "owner"), dueDate = optionalStringField(body, "dueDate");
      const session = await store.recordDecision(sessionId, { nodeId: stringField(body, "nodeId"), selection: stringField(body, "selection"), ...(revision === undefined ? {} : { revision }), ...(confidence === undefined ? {} : { confidence }), ...(rationale === undefined ? {} : { rationale }), ...(owner === undefined ? {} : { owner }), ...(dueDate === undefined ? {} : { dueDate }) });
      return sendJson(response, 201, session.decisions.at(-1));
    }
    if (request.method === "POST" && action === "/submit") {
      const body = await jsonBody(request);
      const end = booleanField(body, "end") ?? false;
      const session = await store.submitFeedback(sessionId, end);
      return sendJson(response, 201, session.submissions.at(-1));
    }
    const commentMatch = action.match(/^\/comments\/([0-9a-f-]+)\/resolve$/);
    if (request.method === "POST" && commentMatch?.[1]) {
      await store.resolveComment(sessionId, commentMatch[1]);
      return sendJson(response, 200, { status: "resolved" });
    }
    if (request.method === "POST" && action === "/patch") {
      const body = await jsonBody(request);
      const patch = Array.isArray(body) ? decodeCompactPatch(body as CompactPatchEnvelope) : body as unknown as PatchEnvelope;
      const session = await store.applyArtifactPatch(sessionId, patch);
      return sendJson(response, 200, { revision: session.artifact.revision });
    }
    if (request.method === "POST" && action === "/resolve") {
      const session = await store.resolveSession(sessionId);
      return sendJson(response, 200, { state: session.state });
    }
    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function jsonBody(request: IncomingMessage): Promise<Record<string, unknown> | unknown[]> {
  if (request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw new Error("Content-Type must be application/json");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body exceeds 64 KiB");
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object") throw new Error("JSON body must be an object or tuple");
  return parsed as Record<string, unknown> | unknown[];
}

function sameOrigin(request: IncomingMessage): boolean {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  return origin === `http://${request.headers.host}`;
}
function stringField(body: Record<string, unknown> | unknown[], key: string): string {
  const value = Array.isArray(body) ? undefined : body[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}
function optionalStringField(body: Record<string, unknown> | unknown[], key: string): string | undefined {
  const value = Array.isArray(body) ? undefined : body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  return value;
}
function numberField(body: Record<string, unknown> | unknown[], key: string): number | undefined {
  const value = Array.isArray(body) ? undefined : body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  return value;
}
function booleanField(body: Record<string, unknown> | unknown[], key: string): boolean | undefined {
  const value = Array.isArray(body) ? undefined : body[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  return value;
}
function objectField(body: Record<string, unknown> | unknown[], key: string): Record<string, unknown> | undefined {
  const value = Array.isArray(body) ? undefined : body[key];
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${key} must be an object`);
  return value as Record<string, unknown>;
}
function standaloneReviewHtml(html: string): string {
  const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => `'sha256-${createHash("sha256").update(match[1] ?? "").digest("base64")}'`).join(" ");
  const policy = `default-src 'none'; style-src 'unsafe-inline'; script-src ${hashes}; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
  return html.replace("<head>", `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
}
function exportFilename(artifactId: string, revision: number): string {
  const safeId = artifactId.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "facet-review";
  return `${safeId}-revision-${revision}.html`;
}
function sendJson(response: ServerResponse, status: number, body: unknown): void { send(response, status, `${JSON.stringify(body)}\n`, "application/json; charset=utf-8") }
function send(response: ServerResponse, status: number, body: string, contentType: string): void { response.statusCode = status; response.setHeader("Content-Type", contentType); response.end(body) }
