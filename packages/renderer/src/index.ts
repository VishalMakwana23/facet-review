import { productBehavior } from "./runtime.js";
import { assertValidArtifact, type FacetArtifact, type FacetNode, type JsonValue } from "@facet-review/protocol";

export const RENDERER_PACKAGE = "@facet-review/renderer" as const;

export type ReviewAnchorView = { kind: "node" } | { kind: "text"; start: number; end: number; quote: string } | { kind: "code"; lineStart: number; lineEnd: number; quote: string };
export interface ReviewCommentView { id: string; nodeId: string; body: string; anchorRevision: number; anchor?: ReviewAnchorView; status: "open" | "resolved" }
export interface ReviewDecisionView { id: string; nodeId: string; selection: string; revision: number }
export interface RevisionChangeView { revision: number; nodeIds: string[]; operations: Array<{ op: string }>; details?: Array<{ nodeId: string; before: string; after: string }> }
export interface RenderArtifactOptions { apiBase?: string; comments?: ReviewCommentView[]; decisions?: ReviewDecisionView[]; changes?: RevisionChangeView[]; sessionState?: "open" | "resolved"; sequence?: number }

export function renderArtifact(artifact: FacetArtifact, options: RenderArtifactOptions = {}): string {
  assertValidArtifact(artifact);
  const navigation = artifact.nodes.map((node) => `<a href="#node-${escapeAttribute(node.id)}">${escapeHtml(node.title ?? humanize(node.type))}</a>`).join("");
  const body = artifact.nodes.map(renderNode).join("");
  const capabilities = artifact.capabilities.map((capability) => `<span class="capability-label" data-capability="${escapeAttribute(capability)}">${escapeHtml(capability)}</span>`).join("");
  const comments = options.comments ?? [];
  const decisions = options.decisions ?? [];
  const changes = options.changes ?? [];
  const inbox = comments.map((comment) => `<li data-comment-id="${escapeAttribute(comment.id)}" class="comment ${comment.status}"><span class="comment-anchor">${escapeHtml(anchorLabel(comment))} · ${anchorState(artifact, comment)}</span>${comment.anchor && comment.anchor.kind !== "node" ? `<blockquote>${escapeHtml(comment.anchor.quote)}</blockquote>` : ""}<p>${escapeHtml(comment.body)}</p>${comment.status === "open" ? `<button data-resolve-comment="${escapeAttribute(comment.id)}">Resolve</button>` : `<span class="resolved-label">Resolved</span>`}</li>`).join("");
  const decisionInbox = decisions.map((decision) => `<li class="comment"><span class="comment-anchor">${escapeHtml(decision.nodeId)} · r${decision.revision}</span><p>${escapeHtml(decision.selection)}</p></li>`).join("");
  const changeSummary = changes.length ? `<details class="change-summary"><summary>What changed across ${changes.length} revision${changes.length === 1 ? "" : "s"}</summary><ol>${changes.map((change) => `<li><strong>Revision ${change.revision}</strong><span>${escapeHtml(change.operations.map((operation) => operation.op).join(", "))} · ${escapeHtml(change.nodeIds.join(", "))}</span>${(change.details ?? []).map(detail => `<details><summary>${escapeHtml(detail.nodeId)} — before / after</summary><h3>Before</h3><pre>${escapeHtml(detail.before)}</pre><h3>After</h3><pre>${escapeHtml(detail.after)}</pre></details>`).join("")}</li>`).join("")}</ol></details>` : "";
  const runtime = safeJson({ apiBase: options.apiBase ?? null, revision: artifact.revision, sequence: options.sequence ?? 0, state: options.sessionState ?? "open" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(artifact.title)}</title><style>${styles}${productStyles}${qualityStyles}</style></head><body><a class="skip-link" href="#artifact">Skip to artifact</a><header><div class="brand">Facet</div><nav aria-label="Artifact sections">${navigation}</nav><button class="quiet-command" data-open-commands aria-keyshortcuts="Control+K Meta+K">Commands <kbd>⌘K</kbd></button><div class="mode" role="group" aria-label="Interaction mode"><button data-mode="explore">Explore</button><button class="active" data-mode="review">Review</button><button data-mode="decide">Decide</button></div><button class="feedback-toggle" data-toggle-review aria-expanded="false" aria-controls="review-panel">Feedback <span>${comments.filter((comment) => comment.status === "open").length}</span></button></header><div id="connection-status" class="connection-status" role="status">Changes saved locally</div><main><article id="artifact"><p class="kicker">${escapeHtml(artifact.id)} · revision ${artifact.revision}</p><h1>${escapeHtml(artifact.title)}</h1><div class="capabilities" role="group" aria-label="Available interactions">${capabilities}</div>${changeSummary}${body}</article><div role="complementary" id="review-panel" tabindex="0" aria-label="Review panel"><div class="review-heading"><div><p class="eyebrow">Local review</p><h2>Feedback inbox</h2></div><span class="session-state">${escapeHtml(options.sessionState ?? "open")}</span></div><button class="close-review" data-toggle-review aria-label="Close feedback panel">Close</button><p id="review-help">Select a section or highlight text, then add anchored feedback.</p><output id="selected-anchor">No section selected</output><label for="comment">Comment</label><textarea id="comment" maxlength="20000" aria-describedby="review-help"></textarea><button id="save-comment" data-action="comment">Save comment</button><h3>Comments <span id="comment-count">${comments.filter((comment) => comment.status === "open").length}</span></h3><ol id="feedback-inbox">${inbox || `<li class="empty">No feedback yet.</li>`}</ol><h3>Decisions <span>${decisions.length}</span></h3><ol class="decision-inbox">${decisionInbox || `<li class="empty">No decisions yet.</li>`}</ol></div></main><dialog id="command-palette" aria-labelledby="command-title"><form method="dialog"><div class="palette-heading"><div><p class="eyebrow">Quick actions</p><h2 id="command-title">Command palette</h2></div><button aria-label="Close command palette">Close</button></div><label for="command-search">Find a command</label><input id="command-search" autocomplete="off"><div class="command-list"><button value="cancel" data-command="review">Enter Review mode</button><button value="cancel" data-command="decide">Enter Decide mode</button><button value="cancel" data-command="comment">Focus comment field</button><button value="cancel" data-command="feedback">Toggle feedback panel</button></div></form></dialog><div id="status" role="status" aria-live="polite"></div><script>window.__FACET_SESSION__=${runtime};${productBehavior}</script></body></html>`;
}

export function renderProductArtifact(artifact: FacetArtifact, options: RenderArtifactOptions = {}): string {
  return renderArtifact(artifact, options);
}

function renderNode(node: FacetNode): string {
  const title = node.title ? `<h2>${escapeHtml(node.title)}</h2>` : "";
  const text = node.text ? `<p data-anchor-text>${escapeHtml(node.text)}</p>` : "";
  const children = node.children?.map(renderNode).join("") ?? "";
  const content = renderData(node);
  return `<section id="node-${escapeAttribute(node.id)}" data-node-id="${escapeAttribute(node.id)}" data-node-type="${node.type}" tabindex="0" class="node node-${node.type}">${title}${text}${content}${children}</section>`;
}

function renderData(node: FacetNode): string {
  const data = node.data ?? {};
  if (node.type === "metric") return `<strong class="metric">${escapeHtml(String(data.value ?? "—"))}</strong><span>${escapeHtml(String(data.label ?? "Metric"))}</span>`;
  if (["timeline", "checklist", "navigation", "legend", "dependency"].includes(node.type)) return renderList(data.items, node.type === "checklist");
  if (["table", "comparison"].includes(node.type)) return renderTable(data, node.title ?? node.id);
  if (["code", "diff"].includes(node.type)) return `<div class="code-tools"><span>${escapeHtml(String(data.language ?? "Code"))}</span><button data-code-action="copy">Copy code</button><button data-code-action="wrap" aria-pressed="false">Wrap lines</button></div><pre tabindex="0" aria-label="${humanize(node.type)}"><code>${escapeHtml(String(data.code ?? data.value ?? ""))}</code></pre>`;
  if (node.type === "decision") return renderDecision(node.id, data.options);
  if (node.type === "progress") {
    const value = numberValue(data.value, 0); return `<label>${escapeHtml(String(data.label ?? "Progress"))}<progress value="${value}" max="100">${value}%</progress></label>`;
  }
  if (node.type === "chart") return `<figure aria-label="${escapeAttribute(String(data.summary ?? "Chart"))}"><div class="chart" aria-hidden="true">${renderBars(data.values)}</div><figcaption>${escapeHtml(String(data.summary ?? "Chart data"))}: ${escapeHtml(arrayValue(data.values).map(String).join(", "))}</figcaption></figure>`;
  if (node.type === "diagram") return `<figure><div class="diagram" role="img" aria-label="${escapeAttribute(String(data.summary ?? "System diagram"))}">${renderList(data.items, false)}</div><figcaption>${escapeHtml(String(data.summary ?? "Diagram"))}</figcaption></figure>`;
  if (node.type === "image") return `<figure class="image-placeholder" aria-label="${escapeAttribute(String(data.alt ?? "Design preview"))}"><span>Image not embedded — text alternative</span><figcaption>${escapeHtml(String(data.alt ?? "Design preview"))}</figcaption></figure>`;
  if (node.type === "filter") return `<label>${escapeHtml(String(data.label ?? "Filter"))}<select>${arrayValue(data.options).map((item) => `<option>${escapeHtml(String(item))}</option>`).join("")}</select></label>`;
  if (node.type === "citation") return `<cite>${escapeHtml(String(data.source ?? data.value ?? "Source"))}</cite>`;
  if (node.type === "status") return `<span class="badge">${escapeHtml(String(data.value ?? "Pending"))}</span>`;
  if (node.type === "persona") return `<dl><dt>Role</dt><dd>${escapeHtml(String(data.role ?? "User"))}</dd><dt>Need</dt><dd>${escapeHtml(String(data.need ?? "Complete the review"))}</dd></dl>`;
  return data.value === undefined ? "" : `<p>${escapeHtml(String(data.value))}</p>`;
}

function renderList(value: JsonValue | undefined, checklist: boolean): string {
  const items = arrayValue(value);
  return `<ul>${items.map((item, index) => `<li>${checklist ? `<label><input type="checkbox">` : ""}${escapeHtml(String(item))}${checklist ? "</label>" : ""}</li>`).join("")}</ul>`;
}

function renderTable(data: Record<string, JsonValue>, label: string): string {
  const headers = arrayValue(data.headers).map(String);
  const rows = arrayValue(data.rows).filter(Array.isArray) as JsonValue[][];
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escapeAttribute(label)} — scrollable table"><table><thead><tr>${headers.map((item) => `<th scope="col">${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(String(item))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderDecision(id: string, value: JsonValue | undefined): string {
  return `<fieldset data-decision-id="${escapeAttribute(id)}"><legend>Choose one option</legend>${arrayValue(value).map((item) => `<label><input type="radio" name="${escapeAttribute(id)}" value="${escapeAttribute(String(item))}">${escapeHtml(String(item))}</label>`).join("")}<button data-action="decision">Record decision</button></fieldset>`;
}

function renderBars(value: JsonValue | undefined): string {
  return arrayValue(value).map((item) => `<span style="height:${Math.max(8, Math.min(100, numberValue(item, 20)))}%"></span>`).join("");
}
function arrayValue(value: JsonValue | undefined): JsonValue[] { return Array.isArray(value) ? value : [] }
function numberValue(value: JsonValue | undefined, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback }
function humanize(value: string): string { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;") }
function escapeAttribute(value: string): string { return escapeHtml(value) }
function safeJson(value: unknown): string { return JSON.stringify(value).replaceAll("<", "\\u003c") }
function anchorLabel(comment: ReviewCommentView): string {
  if (!comment.anchor || comment.anchor.kind === "node") return `${comment.nodeId} · r${comment.anchorRevision}`;
  if (comment.anchor.kind === "code") return `${comment.nodeId} · lines ${comment.anchor.lineStart}–${comment.anchor.lineEnd} · r${comment.anchorRevision}`;
  return `${comment.nodeId} · characters ${comment.anchor.start}–${comment.anchor.end} · r${comment.anchorRevision}`;
}

const productStyles = `.skip-link{position:fixed;top:8px;left:8px;z-index:20;padding:9px 12px;background:var(--focus);color:#071015;border-radius:7px;transform:translateY(-160%)}.skip-link:focus{transform:none}.quiet-command,.feedback-toggle{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:7px;padding:6px 9px}.quiet-command{margin-left:auto}.quiet-command kbd{margin-left:6px;color:#d7dcea}.feedback-toggle{display:none}.connection-status{position:fixed;left:18px;bottom:16px;z-index:3;padding:6px 9px;border:1px solid var(--line);border-radius:7px;background:#11151c;color:var(--muted);font-size:12px}.connection-status.offline{border-color:#f0b762;color:#f0b762}.change-summary{margin:18px 0;border:1px solid var(--paper-line);border-radius:8px;background:#fff}.change-summary summary{cursor:pointer;padding:11px 13px;font-weight:650}.change-summary ol{display:grid;gap:8px;margin:0;padding:0 13px 13px 34px}.change-summary li span{display:block;color:var(--canvas-muted,#667085);font-size:12px}.comment blockquote{margin:8px 0;padding:7px 9px;border-left:2px solid var(--action);background:#1b202b;color:#d8dcea;font-size:12px}.close-review{display:none}dialog{width:min(520px,calc(100% - 32px));border:1px solid #303746;border-radius:12px;background:var(--surface);color:var(--ink);padding:0;box-shadow:0 30px 100px #000a}dialog::backdrop{background:#020408b8;backdrop-filter:blur(3px)}dialog form{padding:20px}.palette-heading{display:flex;align-items:start;justify-content:space-between;gap:16px}.palette-heading h2,.palette-heading p{margin:0}.palette-heading button{border:0;background:transparent;color:var(--muted);padding:8px}dialog label{display:block;margin:18px 0 7px}#command-search{width:100%;padding:11px;border:1px solid #303746;border-radius:7px;background:var(--surface-2);color:var(--ink);font:inherit}.command-list{display:grid;gap:6px;margin-top:12px}.command-list button{text-align:left;padding:11px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--ink)}.command-list button:hover,.command-list button:focus-visible{background:#1b202b;border-color:#303746}#review-panel{position:sticky;top:52px;height:calc(100vh - 52px);overflow:auto}.node[data-has-selection=true]{box-shadow:inset 3px 0 var(--focus)}@media(max-width:760px){body{padding-bottom:72px}.quiet-command{display:none}.feedback-toggle{display:block;margin-left:0}.feedback-toggle span{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:3px;border-radius:10px;background:#242a37;color:white;font-size:11px}main{display:block}#review-panel{position:fixed;z-index:10;left:0;right:0;bottom:0;top:auto;height:min(78vh,680px);padding:22px 16px max(22px,env(safe-area-inset-bottom));border:1px solid var(--line);border-radius:14px 14px 0 0;box-shadow:0 -24px 60px #0009;transform:translateY(calc(100% - 64px));transition:transform 240ms cubic-bezier(.2,.8,.2,1)}#review-panel.open{transform:none}.close-review{display:block;position:absolute;right:16px;top:74px;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:7px;padding:7px 9px}.connection-status{left:10px;bottom:78px}.mode{margin-left:auto}.brand{display:none}}@media(max-width:430px){header{gap:6px}.mode button{padding-inline:7px}.feedback-toggle{padding-inline:7px}}@media(prefers-reduced-motion:reduce){#review-panel{transition:none}}`;


const styles = `:root{color-scheme:dark;--bg:#080a0e;--surface:#0f1218;--surface-2:#141821;--line:#242a36;--ink:#eef1f8;--muted:#9ba4b7;--action:#7c6cff;--focus:#44d5ee;--success:#4ed28a;--paper:#f7f8fb;--paper-ink:#171a23;--paper-line:#e3e7ee}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 Inter,system-ui,sans-serif}header{height:52px;display:flex;align-items:center;gap:20px;padding:0 18px;border-bottom:1px solid var(--line);background:var(--surface);position:sticky;top:0;z-index:2}.brand{font-weight:800}nav{display:flex;gap:12px;overflow:auto}nav a{color:var(--muted);text-decoration:none;white-space:nowrap}.mode{display:flex;margin-left:auto;border:1px solid var(--line);border-radius:8px;padding:2px}.mode button,button,select,textarea{font:inherit}.mode button{border:0;background:transparent;color:var(--muted);padding:5px 9px;border-radius:6px}.mode .active{background:#242a37;color:white}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.55}main{display:grid;grid-template-columns:minmax(0,1fr) 320px;min-height:calc(100vh - 52px)}article{width:min(820px,calc(100% - 40px));margin:24px auto;background:var(--paper);color:var(--paper-ink);border-radius:12px;padding:44px;box-shadow:0 24px 70px #0006}.kicker,.eyebrow{text-transform:uppercase;letter-spacing:.13em;color:#6959de;font-size:10px;font-weight:800}h1{font-size:42px;line-height:1.04;letter-spacing:-.045em}h2{font-size:21px;letter-spacing:-.02em}.capabilities{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0 24px}.capabilities button{border:1px solid var(--paper-line);border-radius:7px;background:white;color:#525c6d;padding:7px 9px}.node{border-top:1px solid var(--paper-line);padding:22px 0}.node.selected{background:#e9e5ff;box-shadow:0 0 0 8px #e9e5ff}.node-callout,.node-risk{border:1px solid #ddd7ff;border-left:3px solid var(--action);padding:15px;border-radius:8px;background:#f1efff}.metric{display:block;font-size:28px}.badge{display:inline-block;padding:4px 7px;border-radius:5px;background:#e8f8ef;color:#237a4b}ul{padding-left:20px}.table-wrap{overflow:auto;border:1px solid var(--paper-line);border-radius:8px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid var(--paper-line)}pre{overflow:auto;padding:14px;border-radius:8px;background:#10141b;color:#eef1f8}.chart{height:130px;display:flex;align-items:end;gap:8px}.chart span{flex:1;background:var(--action);border-radius:4px 4px 0 0}.diagram{border:1px dashed #aeb6c4;border-radius:8px;padding:10px}.image-placeholder{height:180px;display:grid;place-items:center;border:1px dashed #aeb6c4;border-radius:8px;background:white}fieldset{display:grid;gap:8px;border:1px solid var(--paper-line);border-radius:8px;padding:14px}fieldset button,[data-action]{justify-self:start;border:0;border-radius:7px;background:var(--action);color:white;padding:9px 12px}#review-panel{border-left:1px solid var(--line);background:var(--surface);padding:20px;min-width:0}.review-heading{display:flex;justify-content:space-between;align-items:start;gap:12px}.review-heading h2,.review-heading p{margin:0}.session-state{padding:3px 7px;border:1px solid #354055;border-radius:5px;color:var(--success);font-size:12px}.eyebrow{color:#a99fff}#review-panel>p{color:var(--muted)}#selected-anchor{display:block;margin:14px 0;padding:8px 10px;background:var(--surface-2);border:1px solid var(--line);border-radius:7px;color:#cbd2df;font-family:ui-monospace,monospace;font-size:12px}#review-panel label,#review-panel textarea{display:block;width:100%}#review-panel textarea{height:100px;margin:7px 0 10px;background:var(--surface-2);color:white;border:1px solid #303746;border-radius:7px;padding:10px;resize:vertical}#review-panel h3{display:flex;justify-content:space-between;margin-top:28px;font-size:14px}#feedback-inbox{list-style:none;padding:0;display:grid;gap:10px}.comment{padding:11px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)}.comment p{margin:6px 0 10px;overflow-wrap:anywhere}.comment-anchor{font:11px ui-monospace,monospace;color:var(--muted)}.comment button{border:1px solid #394256;border-radius:6px;background:transparent;color:var(--ink);padding:6px 9px}.comment.resolved{opacity:.68}.resolved-label{color:var(--success);font-size:12px}.empty{color:var(--muted);padding:14px 0}:focus-visible{outline:2px solid var(--focus);outline-offset:2px}#status{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:#171c25;border:1px solid #303746;border-radius:7px;padding:8px 11px;display:none;z-index:4}@media(max-width:760px){header{padding:0 10px}header nav{display:none}main{display:block}#review-panel{position:static;border-left:0;border-top:1px solid var(--line);padding:24px 16px}article{width:calc(100% - 20px);padding:28px 22px}h1{font-size:34px}button,select{min-height:44px}.mode button{min-height:38px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`;
function anchorState(artifact: FacetArtifact, comment: ReviewCommentView): string {
  const find = (nodes: FacetNode[]): FacetNode | undefined => {
    for (const node of nodes) { if (node.id === comment.nodeId) return node; const child = find(node.children ?? []); if (child) return child; }
    return undefined;
  };
  const node = find(artifact.nodes);
  if (!node) return "Orphaned — original section missing";
  const anchor = comment.anchor;
  if (!anchor || anchor.kind === "node") return comment.anchorRevision === artifact.revision ? "Current" : "Section retained — review newer revision";
  const text = anchor.kind === "text" ? (node.text ?? "").slice(anchor.start, anchor.end) : String(node.data?.code ?? node.data?.value ?? "").split("\n").slice(anchor.lineStart - 1, anchor.lineEnd).join("\n");
  return text === anchor.quote ? "Selection retained" : "Stale — original quote preserved";
}

const qualityStyles = `
:root{--action-fill:#6250d5}html{scroll-padding-top:72px}
fieldset button,[data-action]{background:var(--action-fill)}
header nav{min-width:0;flex:1}.mode,.quiet-command{flex-shrink:0}
article{overflow-wrap:anywhere}.node{scroll-margin-top:72px}
.capability-label{padding:6px 9px;border:1px solid var(--paper-line);border-radius:6px;color:#525c6d;background:white}
.comment.resolved{opacity:1}.comment-anchor{overflow-wrap:anywhere}
.code-tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:12px}
.code-tools button{background:white;color:#343d50;border:1px solid #aeb6c4;border-radius:6px;padding:6px 10px}
.wrap-code{white-space:pre-wrap;overflow-wrap:anywhere}
.command-list button[hidden]{display:none}
#status{max-width:min(600px,90vw);pointer-events:none;z-index:30;font-size:13px}
body[data-interaction-mode=decide] .node-decision{border:2px solid var(--action-fill);padding:16px;border-radius:8px}
button,input,select,textarea{accent-color:var(--action-fill)}
@media(max-width:760px){
 #review-panel:not(.open){visibility:hidden;transform:translateY(100%)}
 #review-panel.open{visibility:visible;padding-top:68px}
 .close-review{top:14px;right:16px;min-height:44px}
 #status{bottom:8px}.connection-status{bottom:60px;max-width:calc(100vw - 20px)}
 .mode button{min-height:44px}article{padding-bottom:100px}
}
`;
