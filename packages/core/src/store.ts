import { appendFile, mkdir, readFile, rename, writeFile, rmdir, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
  applyPatch,
  assertValidArtifact,
  collectNodeIds,
  type FacetArtifact,
  type PatchEnvelope,
} from "@facet-review/protocol";

export type SessionState = "open" | "resolved";

export type ReviewAnchor =
  | { kind: "node" }
  | { kind: "text"; start: number; end: number; quote: string }
  | { kind: "code"; lineStart: number; lineEnd: number; quote: string };

export interface ReviewComment {
  id: string;
  nodeId: string;
  body: string;
  anchorRevision: number;
  anchor?: ReviewAnchor;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  parentId?: string;
}

export interface ReviewDecision {
  id: string;
  nodeId: string;
  selection: string;
  revision: number;
  createdAt: string;
  rationale?: string;
  confidence?: number;
  owner?: string;
  dueDate?: string;
}

export interface RevisionChange {
  revision: number;
  nodeIds: string[];
  operations: PatchEnvelope["operations"];
  details?: Array<{ nodeId: string; before: string; after: string }>;
}

export interface FeedbackSubmission {
  id: string;
  sequence: number;
  revision: number;
  end: boolean;
  createdAt: string;
}

interface EventBase { id: string; sequence: number; at: string }
export type ReviewEvent =
  | EventBase & { type: "comment.created"; comment: ReviewComment }
  | EventBase & { type: "comment.resolved"; commentId: string }
  | EventBase & { type: "decision.recorded"; decision: ReviewDecision }
  | EventBase & { type: "artifact.patched"; patch: PatchEnvelope }
  | EventBase & { type: "feedback.submitted"; submission: FeedbackSubmission }
  | EventBase & { type: "session.resolved" };

export interface ReviewSession {
  schemaVersion: 1;
  id: string;
  state: SessionState;
  artifact: FacetArtifact;
  comments: ReviewComment[];
  decisions: ReviewDecision[];
  revisionChanges: RevisionChange[];
  submissions: FeedbackSubmission[];
  sequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackInbox {
  sessionId: string;
  artifactId: string;
  artifactRevision: number;
  state: SessionState;
  openComments: ReviewComment[];
  resolvedComments: ReviewComment[];
  decisions: ReviewDecision[];
}

export type CompactFeedbackDigest = ["fd1", string, number, Array<[string, string, string, string | 0]>, Array<[string, string, number]>];
export type CompactFeedbackSubmission = ["fs1", string, number, number, 0 | 1, Array<[string, string, string, string | 0]>, Array<[string, string, number]>];

export class FileSessionStore {
  readonly root: string;
  readonly #locks = new Map<string, Promise<unknown>>();

  constructor(root: string) { this.root = resolve(root) }

  async create(artifact: FacetArtifact, now = new Date().toISOString()): Promise<ReviewSession> {
    assertValidArtifact(artifact);
    const id = randomBytes(24).toString("base64url");
    const session: ReviewSession = { schemaVersion: 1, id, state: "open", artifact: structuredClone(artifact), comments: [], decisions: [], revisionChanges: [], submissions: [], sequence: 0, createdAt: now, updatedAt: now };
    await mkdir(this.sessionDir(id), { recursive: true });
    await this.writeSnapshot(session);
    await writeFile(this.eventsPath(id), "", { encoding: "utf8", flag: "wx" });
    return structuredClone(session);
  }

  async load(id: string): Promise<ReviewSession> {
    return this.withLock(id, () => this.loadUnlocked(id));
  }

  private async loadUnlocked(id: string): Promise<ReviewSession> {
    this.assertSessionId(id);
    const snapshot = JSON.parse(await readFile(this.snapshotPath(id), "utf8")) as ReviewSession;
    snapshot.revisionChanges ??= [];
    snapshot.submissions ??= [];
    assertValidArtifact(snapshot.artifact);
    const events = await this.readEvents(id);
    if (!Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 0 || snapshot.sequence > events.length) throw new Error("Snapshot is ahead of or inconsistent with the event journal");
    let recovered = snapshot;
    for (const event of events.filter((entry) => entry.sequence > recovered.sequence).sort((a, b) => a.sequence - b.sequence)) {
      if (event.sequence !== recovered.sequence + 1) throw new Error(`Event sequence gap in session ${id}`);
      recovered = reduceEvent(recovered, event);
    }
    // Reads replay in memory only: a reader must not overwrite a newer writer snapshot.
    return structuredClone(recovered);
  }

  async addComment(id: string, input: { nodeId: string; body: string; anchorRevision?: number; anchor?: ReviewAnchor; parentId?: string }): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      if (session.state !== "open") throw new Error("Cannot comment on a resolved session");
      if (!collectNodeIds(session.artifact).includes(input.nodeId)) throw new Error(`Unknown comment anchor: ${input.nodeId}`);
      const body = input.body.trim();
      if (!body) throw new Error("Comment body is required");
      if (body.length > 20_000) throw new Error("Comment body exceeds 20000 characters");
      const anchorRevision = input.anchorRevision ?? session.artifact.revision;
      if (!Number.isSafeInteger(anchorRevision) || anchorRevision < 0) throw new Error("Invalid anchor revision");
      if (anchorRevision !== session.artifact.revision) throw new Error("Artifact changed: reload and review the selection before commenting");
      const anchor = validateAnchor(input.anchor, findNode(session.artifact.nodes, input.nodeId));
      if (input.parentId) {
        const parent = session.comments.find((entry) => entry.id === input.parentId);
        if (!parent) throw new Error(`Unknown parent comment: ${input.parentId}`);
        if (parent.nodeId !== input.nodeId) throw new Error("Replies must use the parent comment anchor");
      }
      const comment: ReviewComment = { id: randomUUID(), nodeId: input.nodeId, body, anchorRevision, status: "open", createdAt: at };
      if (anchor) comment.anchor = anchor;
      if (input.parentId) comment.parentId = input.parentId;
      return { type: "comment.created", id: randomUUID(), sequence, at, comment };
    });
  }

  async resolveComment(id: string, commentId: string): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      const comment = session.comments.find((entry) => entry.id === commentId);
      if (!comment) throw new Error(`Unknown comment: ${commentId}`);
      if (comment.status === "resolved") throw new Error("Comment is already resolved");
      return { type: "comment.resolved", id: randomUUID(), sequence, at, commentId };
    });
  }

  async recordDecision(id: string, input: { nodeId: string; selection: string; revision?: number; rationale?: string; confidence?: number; owner?: string; dueDate?: string }): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      if (session.state !== "open") throw new Error("Cannot decide on a resolved session");
      if (input.revision !== undefined && input.revision !== session.artifact.revision) throw new Error("Artifact changed: reload before recording a decision");
      const node = findNode(session.artifact.nodes, input.nodeId);
      if (!node || node.type !== "decision") throw new Error(`Unknown decision node: ${input.nodeId}`);
      const options = Array.isArray(node.data?.options) ? node.data.options.map(String) : [];
      if (!options.includes(input.selection)) throw new Error("Decision selection is not an available option");
      const rationale = optionalText(input.rationale, "Decision rationale", 4_000);
      const owner = optionalText(input.owner, "Decision owner", 200);
      const dueDate = optionalText(input.dueDate, "Decision due date", 40);
      if (input.confidence !== undefined && (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 5)) throw new Error("Decision confidence must be an integer from 1 to 5");
      const decision: ReviewDecision = { id: randomUUID(), nodeId: input.nodeId, selection: input.selection, revision: session.artifact.revision, createdAt: at };
      if (rationale) decision.rationale = rationale;
      if (input.confidence !== undefined) decision.confidence = input.confidence;
      if (owner) decision.owner = owner;
      if (dueDate) decision.dueDate = dueDate;
      return { type: "decision.recorded", id: randomUUID(), sequence, at, decision };
    });
  }

  async applyArtifactPatch(id: string, patch: PatchEnvelope): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      if (session.state !== "open") throw new Error("Cannot patch a resolved session");
      applyPatch(session.artifact, patch);
      return { type: "artifact.patched", id: randomUUID(), sequence, at, patch: structuredClone(patch) };
    });
  }

  async submitFeedback(id: string, end = false): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      if (session.state !== "open") throw new Error("Cannot submit feedback on a resolved session");
      const previous = session.submissions.at(-1)?.sequence ?? 0;
      if (session.sequence <= previous) throw new Error("No new feedback to send");
      const submission: FeedbackSubmission = { id: randomUUID(), sequence, revision: session.artifact.revision, end, createdAt: at };
      return { type: "feedback.submitted", id: randomUUID(), sequence, at, submission };
    });
  }

  async feedbackSubmission(id: string, afterSequence = 0): Promise<CompactFeedbackSubmission | undefined> {
    const session = await this.load(id);
    const submission = session.submissions.find((entry) => entry.sequence > afterSequence);
    if (!submission) return undefined;
    return ["fs1", session.artifact.id, submission.revision, submission.sequence, submission.end ? 1 : 0,
      session.comments.filter((comment) => comment.status === "open" && comment.createdAt <= submission.createdAt).map((comment) => [comment.id, comment.nodeId, comment.body, comment.parentId ?? 0]),
      session.decisions.filter((decision) => decision.createdAt <= submission.createdAt).map((decision) => [decision.nodeId, decision.selection, decision.revision])];
  }

  async setAgentPresence(id: string, token: string): Promise<void> {
    this.assertSessionId(id);
    await writeFile(this.presencePath(id), JSON.stringify({ token, at: Date.now() }), "utf8");
  }

  async clearAgentPresence(id: string, token: string): Promise<void> {
    this.assertSessionId(id);
    try {
      const current = JSON.parse(await readFile(this.presencePath(id), "utf8")) as { token?: string };
      if (current.token === token) await unlink(this.presencePath(id));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }

  async agentListening(id: string): Promise<boolean> {
    this.assertSessionId(id);
    try {
      const current = JSON.parse(await readFile(this.presencePath(id), "utf8")) as { at?: number };
      return typeof current.at === "number" && Date.now() - current.at < 5_000;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
  }

  async resolveSession(id: string): Promise<ReviewSession> {
    return this.mutate(id, (session, sequence, at) => {
      if (session.state === "resolved") throw new Error("Session is already resolved");
      if (session.comments.some((comment) => comment.status === "open")) throw new Error("Resolve all comments before resolving the session");
      return { type: "session.resolved", id: randomUUID(), sequence, at };
    });
  }

  async inbox(id: string): Promise<FeedbackInbox> {
    const session = await this.load(id);
    return {
      sessionId: session.id,
      artifactId: session.artifact.id,
      artifactRevision: session.artifact.revision,
      state: session.state,
      openComments: session.comments.filter((comment) => comment.status === "open"),
      resolvedComments: session.comments.filter((comment) => comment.status === "resolved"),
      decisions: session.decisions,
    };
  }

  async digest(id: string): Promise<CompactFeedbackDigest> {
    const session = await this.load(id);
    return ["fd1", session.artifact.id, session.artifact.revision,
      session.comments.filter((comment) => comment.status === "open").map((comment) => [comment.id, comment.nodeId, comment.body, comment.parentId ?? 0]),
      session.decisions.map((decision) => [decision.nodeId, decision.selection, decision.revision])];
  }

  async exportBundle(id: string, outputDirectory: string, render?: (session: ReviewSession) => string): Promise<void> {
    const session = await this.load(id);
    // Reserve a new directory exclusively. Never replace files in a user's existing directory.
    const destination = resolve(outputDirectory);
    await mkdir(destination);
    const feedback: FeedbackInbox = { sessionId: session.id, artifactId: session.artifact.id, artifactRevision: session.artifact.revision, state: session.state, openComments: session.comments.filter(c => c.status === "open"), resolvedComments: session.comments.filter(c => c.status === "resolved"), decisions: session.decisions };
    const files: Record<string, string> = { "artifact.json": pretty(session.artifact), "feedback.json": pretty(feedback), "session.json": pretty(session) };
    if (render) files["review.html"] = render(structuredClone(session));
    const checksums: Record<string, string> = {};
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(destination, name), content, { encoding: "utf8", flag: "wx" });
      checksums[name] = createHash("sha256").update(content).digest("hex");
    }
    // Written last: missing manifest means incomplete export, never a valid bundle.
    await writeFile(join(destination, "manifest.json"), pretty({ format: "facet-export-1", sessionId: session.id, sequence: session.sequence, revision: session.artifact.revision, sha256: checksums }), { encoding: "utf8", flag: "wx" });
  }

  async repairJournal(id: string): Promise<{ repaired: boolean; backupPath?: string }> {
    return this.withLock(id, async () => {
      const target = this.eventsPath(id);
      const original = await readFile(target);
      if (!original.length || original.at(-1) === 10) {
        await this.loadUnlocked(id);
        return { repaired: false };
      }
      const boundary = original.lastIndexOf(10) + 1;
      const prefix = original.subarray(0, boundary);
      const events = parseEvents(prefix.toString("utf8"));
      const snapshot = JSON.parse(await readFile(this.snapshotPath(id), "utf8")) as ReviewSession;
      snapshot.revisionChanges ??= [];
      assertValidArtifact(snapshot.artifact);
      if ((events.at(-1)?.sequence ?? 0) < snapshot.sequence) throw new Error("Repair would discard a snapshotted event; manual recovery required");
      let recovered = snapshot;
      for (const event of events) {
        if (event.sequence <= snapshot.sequence) continue;
        if (event.sequence !== recovered.sequence + 1) throw new Error("Cannot repair a journal sequence gap");
        recovered = reduceEvent(recovered, event);
      }
      const backupPath = `${target}.${randomUUID()}.backup`;
      await writeFile(backupPath, original, { flag: "wx" });
      const temporary = `${target}.${randomUUID()}.tmp`;
      await writeFile(temporary, prefix, { flag: "wx" });
      await rename(temporary, target);
      await this.writeSnapshot(recovered);
      return { repaired: true, backupPath };
    });
  }

  private async mutate(id: string, makeEvent: (session: ReviewSession, sequence: number, at: string) => ReviewEvent): Promise<ReviewSession> {
    return this.withLock(id, async () => {
      const session = await this.loadUnlocked(id);
      const event = makeEvent(session, session.sequence + 1, new Date().toISOString());
      const next = reduceEvent(session, event);
      await appendFile(this.eventsPath(id), `${JSON.stringify(event)}\n`, "utf8");
      await this.writeSnapshot(next);
      return structuredClone(next);
    });
  }

  private async withLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const lockPath = join(this.sessionDir(id), "transaction.lock");
      const deadline = Date.now() + 3000;
      while (true) {
        try { await mkdir(lockPath); break } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          // Windows can report delete-pending lock directories as EPERM rather than
          // EEXIST. Retry without stealing/removing another process's lock.
          if (code !== "EEXIST" && !(process.platform === "win32" && (code === "EPERM" || code === "EACCES"))) throw error;
          if (Date.now() >= deadline) throw new Error("Session busy or interrupted lock: stop all session processes before inspecting transaction.lock");
          await delay(25);
        }
      }
      try { return await operation() } finally { await rmdir(lockPath) }
    });
    this.#locks.set(id, current);
    try { return await current } finally { if (this.#locks.get(id) === current) this.#locks.delete(id) }
  }

  private async readEvents(id: string): Promise<ReviewEvent[]> {
    const raw = await readFile(this.eventsPath(id), "utf8");
    if (raw && !raw.endsWith("\n")) throw new Error("Incomplete event journal: repair required before further writes");
    return parseEvents(raw);
  }

  private async writeSnapshot(session: ReviewSession): Promise<void> {
    const target = this.snapshotPath(session.id);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, pretty(session), "utf8");
    await rename(temporary, target);
  }

  private sessionDir(id: string): string { this.assertSessionId(id); return join(this.root, "sessions", id) }
  private snapshotPath(id: string): string { return join(this.sessionDir(id), "snapshot.json") }
  private eventsPath(id: string): string { return join(this.sessionDir(id), "events.ndjson") }
  private presencePath(id: string): string { return join(this.sessionDir(id), "agent-presence.json") }
  private assertSessionId(id: string): void { if (!/^[A-Za-z0-9_-]{20,80}$/.test(id)) throw new Error("Invalid session ID") }
}

function reduceEvent(source: ReviewSession, event: ReviewEvent): ReviewSession {
  const session = structuredClone(source);
  if (event.type === "comment.created") session.comments.push(structuredClone(event.comment));
  if (event.type === "comment.resolved") {
    const comment = session.comments.find((entry) => entry.id === event.commentId);
    if (!comment) throw new Error(`Cannot resolve missing comment: ${event.commentId}`);
    comment.status = "resolved";
    comment.resolvedAt = event.at;
  }
  if (event.type === "decision.recorded") session.decisions.push(structuredClone(event.decision));
  if (event.type === "artifact.patched") {
    const before = session.artifact;
    session.artifact = applyPatch(session.artifact, event.patch);
    const ids = [...new Set(event.patch.operations.map((operation) => operation.op === "insert" ? operation.node.id : operation.id))];
    session.revisionChanges.push({
      revision: event.patch.nextRevision,
      nodeIds: [...new Set(event.patch.operations.map((operation) => operation.op === "insert" ? operation.node.id : operation.id))],
      operations: structuredClone(event.patch.operations),
      details: ids.map(nodeId => ({ nodeId, before: describeNode(before.nodes, nodeId), after: describeNode(session.artifact.nodes, nodeId) })),
    });
  }
  if (event.type === "feedback.submitted") session.submissions.push(structuredClone(event.submission));
  if (event.type === "session.resolved") session.state = "resolved";
  session.sequence = event.sequence;
  session.updatedAt = event.at;
  return session;
}

function findNode(nodes: FacetArtifact["nodes"], id: string): FacetArtifact["nodes"][number] | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = node.children ? findNode(node.children, id) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function validateAnchor(anchor: ReviewAnchor | undefined, node: FacetArtifact["nodes"][number] | undefined): ReviewAnchor | undefined {
  if (anchor === undefined) return undefined;
  if (!anchor || typeof anchor !== "object") throw new Error("Invalid anchor");
  if (anchor.kind === "node") return { kind: "node" };
  if (anchor.kind !== "text" && anchor.kind !== "code") throw new Error("Unknown anchor kind");
  if (!node) throw new Error("Cannot validate anchor without its node");
  if (typeof anchor.quote !== "string" || !anchor.quote.trim() || anchor.quote.length > 2_000) throw new Error("Selection quote must contain 1–2000 characters");
  if (anchor.kind === "text") {
    const text = node.text ?? "";
    if (!Number.isSafeInteger(anchor.start) || !Number.isSafeInteger(anchor.end) || anchor.start < 0 || anchor.end <= anchor.start || anchor.end > text.length) throw new Error("Invalid text anchor range");
    if (text.slice(anchor.start, anchor.end) !== anchor.quote) throw new Error("Text anchor quote does not match the artifact");
    return structuredClone(anchor);
  }
  if (node.type !== "code" && node.type !== "diff") throw new Error("Code anchors require a code or diff node");
  const lines = String(node.data?.code ?? node.data?.value ?? "").split("\n");
  if (!Number.isSafeInteger(anchor.lineStart) || !Number.isSafeInteger(anchor.lineEnd) || anchor.lineStart < 1 || anchor.lineEnd < anchor.lineStart || anchor.lineEnd > lines.length) throw new Error("Invalid code line anchor");
  if (lines.slice(anchor.lineStart - 1, anchor.lineEnd).join("\n") !== anchor.quote) throw new Error("Code anchor quote does not match complete lines");
  return structuredClone(anchor);
}

function describeNode(nodes: FacetArtifact["nodes"], id: string, parent: string | null = null): string {
  for (const [index, node] of nodes.entries()) {
    if (node.id === id) { const { children, ...content } = node; return pretty({ parent, index, ...content }); }
    const nested = describeNode(node.children ?? [], id, node.id);
    if (nested !== "Not present") return nested;
  }
  return "Not present";
}

function pretty(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n` }
function optionalText(value: string | undefined, label: string, maximum: number): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const result = value.trim();
  if (result.length > maximum) throw new Error(`${label} exceeds ${maximum} characters`);
  return result;
}

function parseEvents(raw: string): ReviewEvent[] {
  const lines = raw.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) => {
    const event = JSON.parse(line) as ReviewEvent;
    if (!event || typeof event !== "object" || !["comment.created", "comment.resolved", "decision.recorded", "artifact.patched", "feedback.submitted", "session.resolved"].includes(event.type) || event.sequence !== index + 1 || typeof event.id !== "string" || typeof event.at !== "string") throw new Error("Invalid event journal record or sequence gap");
    if (event.type === "comment.created" && (!event.comment || typeof event.comment.id !== "string" || typeof event.comment.body !== "string")) throw new Error("Invalid comment event");
    if (event.type === "comment.resolved" && typeof event.commentId !== "string") throw new Error("Invalid resolution event");
    if (event.type === "decision.recorded" && (!event.decision || typeof event.decision.selection !== "string")) throw new Error("Invalid decision event");
    if (event.type === "artifact.patched" && (!event.patch || !Array.isArray(event.patch.operations))) throw new Error("Invalid patch event");
    if (event.type === "feedback.submitted" && (!event.submission || event.submission.sequence !== event.sequence || typeof event.submission.end !== "boolean")) throw new Error("Invalid feedback submission event");
    return event;
  });
}
