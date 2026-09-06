import { productBehavior } from "./runtime.js";
import { rendererStyles } from "./styles.js";
import { assertValidArtifact, representationReceipt, type FacetArtifact, type FacetNode, type JsonValue } from "@facet-review/protocol";

export const RENDERER_PACKAGE = "@facet-review/renderer" as const;

export type ReviewAnchorView = { kind: "node" } | { kind: "text"; start: number; end: number; quote: string } | { kind: "code"; lineStart: number; lineEnd: number; quote: string };
export interface ReviewCommentView { id: string; nodeId: string; body: string; anchorRevision: number; anchor?: ReviewAnchorView; status: "open" | "resolved"; parentId?: string }
export interface ReviewDecisionView { id: string; nodeId: string; selection: string; revision: number; rationale?: string; confidence?: number; owner?: string; dueDate?: string }
export interface RevisionChangeView { revision: number; nodeIds: string[]; operations: Array<{ op: string }>; details?: Array<{ nodeId: string; before: string; after: string }> }
export interface RenderArtifactOptions { apiBase?: string; comments?: ReviewCommentView[]; decisions?: ReviewDecisionView[]; changes?: RevisionChangeView[]; sessionState?: "open" | "resolved"; sequence?: number }

export function renderArtifact(artifact: FacetArtifact, options: RenderArtifactOptions = {}): string {
  assertValidArtifact(artifact);
  const recipe = selectRecipe(artifact);
  const navigation = artifact.nodes.map((node, index) => {
    const count = (options.comments ?? []).filter((comment) => comment.nodeId === node.id && comment.status === "open").length;
    return `<a href="#node-${escapeAttribute(node.id)}"><span class="nav-index">${String(index + 1).padStart(2, "0")}</span><span class="nav-copy"><strong>${escapeHtml(node.title ?? humanize(node.type))}</strong><small>${escapeHtml(humanize(node.type))}</small></span>${count ? `<span class="nav-count" aria-label="${count} open comment${count === 1 ? "" : "s"}">${count}</span>` : ""}</a>`;
  }).join("");
  const capabilities = artifact.capabilities.map((capability) => `<span class="capability-label" data-capability="${escapeAttribute(capability)}">${escapeHtml(capability)}</span>`).join("");
  const comments = options.comments ?? [];
  const decisions = options.decisions ?? [];
  const changes = options.changes ?? [];
  const changedIds = new Set(changes.flatMap((change) => change.nodeIds));
  const body = renderArtifactNodes(artifact.nodes, recipe, comments, changedIds);
  const inbox = renderCommentThread(artifact, comments);
  const decisionInbox = decisions.map((decision) => `<li class="comment decision-record"><span class="comment-anchor">${escapeHtml(decision.nodeId)} · r${decision.revision}</span><p><strong>${escapeHtml(decision.selection)}</strong></p>${decision.rationale ? `<p>${escapeHtml(decision.rationale)}</p>` : ""}<dl class="decision-meta">${decision.confidence ? `<div><dt>Confidence</dt><dd>${decision.confidence}/5</dd></div>` : ""}${decision.owner ? `<div><dt>Owner</dt><dd>${escapeHtml(decision.owner)}</dd></div>` : ""}${decision.dueDate ? `<div><dt>Due</dt><dd>${escapeHtml(decision.dueDate)}</dd></div>` : ""}</dl></li>`).join("");
  const changeSummary = changes.length ? `<details class="change-summary"><summary>What changed across ${changes.length} revision${changes.length === 1 ? "" : "s"}</summary><ol>${changes.map((change) => `<li><strong>Revision ${change.revision}</strong><span>${escapeHtml(change.operations.map((operation) => operation.op).join(", "))} · ${escapeHtml(change.nodeIds.join(", "))}</span>${(change.details ?? []).map(detail => `<details><summary>${escapeHtml(detail.nodeId)} — before / after</summary><h3>Before</h3><pre>${escapeHtml(detail.before)}</pre><h3>After</h3><pre>${escapeHtml(detail.after)}</pre></details>`).join("")}</li>`).join("")}</ol></details>` : "";
  const runtime = safeJson({ apiBase: options.apiBase ?? null, revision: artifact.revision, sequence: options.sequence ?? 0, state: options.sessionState ?? "open" });
  const receipt = representationReceipt(artifact);
  const tokenReceipt = `<details class="token-receipt"><summary>Token receipt</summary><dl><div><dt>Compact estimate</dt><dd>${receipt.estimatedCompactTokens} tokens</dd></div><div><dt>Canonical estimate</dt><dd>${receipt.estimatedCanonicalTokens} tokens</dd></div><div><dt>Representation change</dt><dd>${receipt.estimatedReductionPercent}% smaller</dd></div></dl><p>Estimated locally from character counts; excludes prompts, retries, and skill loading.</p></details>`;
  const openCount = comments.filter((comment) => comment.status === "open").length;
  const riskCount = artifact.nodes.filter((node) => node.type === "risk").length;
  const decisionNode = artifact.nodes.find((node) => node.type === "decision");
  const milestoneNode = artifact.nodes.find((node) => node.type === "timeline");
  const milestoneCount = arrayValue(milestoneNode?.data?.items).length;
  const lead = artifact.nodes.find((node) => node.text)?.text ?? "Review the evidence, risks, and decision before work begins.";
  const overview = `<section class="artifact-overview" aria-label="Report at a glance"><div class="overview-copy"><span>Start here</span><p>${escapeHtml(lead)}</p></div><dl><div><dt>Delivery path</dt><dd>${milestoneCount ? `${milestoneCount} phases` : `${artifact.nodes.length} sections`}</dd></div><div><dt>Risks tracked</dt><dd>${riskCount}</dd></div><div><dt>Decision gates</dt><dd>${decisionNode ? "1 required" : "None"}</dd></div></dl>${decisionNode ? `<a class="overview-action" href="#node-${escapeAttribute(decisionNode.id)}">Review the decision <span aria-hidden="true">→</span></a>` : ""}</section>`;
  const recommendation = artifact.nodes.find((node) => nodeRole(node) === "recommendation")?.text ?? "Review the evidence and record a decision.";
  const latestDecision = decisions.at(-1);
  const cockpit = `<section class="decision-cockpit" aria-labelledby="cockpit-title"><p class="eyebrow">Decision cockpit</p><h3 id="cockpit-title">${latestDecision ? escapeHtml(latestDecision.selection) : "Ready for review"}</h3><p>${escapeHtml(recommendation)}</p><dl><div><dt>Open concerns</dt><dd>${openCount}</dd></div><div><dt>Changed sections</dt><dd>${changedIds.size}</dd></div><div><dt>Confidence</dt><dd>${latestDecision?.confidence ? `${latestDecision.confidence}/5` : "—"}</dd></div></dl></section>`;
  const lenses = ["all", "summary", "evidence", "risk", "change", "decision", "story", "board", "focus"].map((lens) => `<button class="${lens === "all" ? "active" : ""}" data-lens="${lens}">${humanize(lens)}</button>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090b10"><title>${escapeHtml(artifact.title)}</title><style>${rendererStyles}</style></head><body data-recipe="${recipe}" data-lens="all" data-density="comfortable"><a class="skip-link" href="#artifact">Skip to artifact</a><aside id="section-navigator" aria-label="Section navigator"><div class="section-nav-heading"><div><p class="eyebrow">Artifact map</p><h2>Sections</h2></div><button data-toggle-sections aria-label="Collapse section navigator">Close</button></div><nav>${navigation}</nav></aside><header class="app-bar"><a class="brand" href="#artifact" aria-label="Facet review home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>Facet</span></a><button class="nav-toggle" data-toggle-sections aria-expanded="false" aria-controls="section-navigator">Sections</button><span class="current-artifact">${escapeHtml(artifact.title)}</span><button class="quiet-command" data-open-commands aria-keyshortcuts="Control+K Meta+K"><span>Commands</span><kbd>⌘K</kbd></button><div class="mode" role="group" aria-label="Interaction mode"><button data-mode="explore">Explore</button><button class="active" data-mode="review">Review</button><button data-mode="decide">Decide</button></div><button class="feedback-toggle" data-toggle-review aria-expanded="true" aria-controls="review-panel">Review <span>${openCount}</span></button></header><div id="connection-status" class="connection-status" role="status"><span aria-hidden="true"></span>Changes saved locally</div><main><article id="artifact" data-layout-recipe="${recipe}"><div class="artifact-hero"><div class="hero-meta"><p class="kicker">${escapeHtml(artifact.id)} <span>·</span> revision ${artifact.revision}</p><span class="recipe-label">${escapeHtml(humanize(recipe))}</span></div><h1>${escapeHtml(artifact.title)}</h1>${overview}<div class="capabilities" role="group" aria-label="Available interactions">${capabilities}</div>${tokenReceipt}</div><div class="lens-bar" role="toolbar" aria-label="Review lenses"><span>Lens</span>${lenses}<span class="toolbar-divider" aria-hidden="true"></span><span>Density</span><button class="active" data-density="comfortable">Comfortable</button><button data-density="compact">Compact</button><button data-density="presentation">Present</button></div>${changeSummary}<div class="artifact-body">${body}</div></article><aside id="review-panel" tabindex="0" aria-label="Review panel"><div class="review-heading"><div><p class="eyebrow">Local review</p><h2>Feedback inbox</h2></div><span class="session-state">${escapeHtml(options.sessionState ?? "open")}</span></div><button class="close-review" data-toggle-review aria-label="Close feedback panel">Close</button>${cockpit}<ol class="review-progress" aria-label="Review progress"><li class="done"><span>1</span>Read</li><li class="${openCount ? "current" : "done"}"><span>2</span>Resolve ${openCount}</li><li class="${openCount ? "" : "current"}"><span>3</span>Decide</li></ol><div class="review-composer"><p id="review-help">Select a section or highlight text, then add anchored feedback.</p><output id="selected-anchor">No section selected</output><label for="comment">Comment</label><textarea id="comment" name="comment" autocomplete="off" maxlength="20000" aria-describedby="review-help" placeholder="Describe what should change and why…"></textarea><button id="save-comment" data-action="comment">Save comment</button></div><div class="inbox-section"><h3>Comments <span id="comment-count">${openCount}</span></h3><div class="feedback-filters" role="group" aria-label="Filter comments"><button class="active" data-feedback-filter="all">All</button><button data-feedback-filter="open">Open</button><button data-feedback-filter="resolved">Resolved</button></div><ol id="feedback-inbox">${inbox || `<li class="empty">No feedback yet.</li>`}</ol></div><div class="inbox-section"><h3>Decision ledger <span>${decisions.length}</span></h3><ol class="decision-inbox">${decisionInbox || `<li class="empty">No decisions yet.</li>`}</ol></div><div class="panel-preferences"><label for="review-width">Review panel width</label><input id="review-width" data-review-width type="range" min="300" max="480" step="12" value="352"></div></aside></main><dialog id="command-palette" aria-labelledby="command-title"><form method="dialog"><div class="palette-heading"><div><p class="eyebrow">Quick actions</p><h2 id="command-title">Command palette</h2></div><button aria-label="Close command palette">Close</button></div><label for="command-search">Find a command</label><input id="command-search" name="command-search" autocomplete="off" placeholder="Search commands…"><div class="command-list"><button value="cancel" data-command="review">Enter Review mode</button><button value="cancel" data-command="decide">Enter Decide mode</button><button value="cancel" data-command="comment">Focus comment field</button><button value="cancel" data-command="feedback">Toggle feedback panel</button></div></form></dialog><div id="status" role="status" aria-live="polite"></div><script>window.__FACET_SESSION__=${runtime};${productBehavior}</script></body></html>`;
}

export function renderProductArtifact(artifact: FacetArtifact, options: RenderArtifactOptions = {}): string {
  return renderArtifact(artifact, options);
}

type LayoutRecipe = "option-showdown" | "milestone-path" | "reading-flow";

function selectRecipe(artifact: FacetArtifact): LayoutRecipe {
  const types = new Set(artifact.nodes.map((node) => node.type));
  const riskCount = artifact.nodes.filter((node) => node.type === "risk").length;
  if (types.has("comparison") && types.has("decision") && riskCount >= 2) return "option-showdown";
  if (types.has("timeline") && types.has("dependency") && types.has("decision")) return "milestone-path";
  return "reading-flow";
}

function renderArtifactNodes(nodes: FacetNode[], recipe: LayoutRecipe, comments: ReviewCommentView[], changedIds: Set<string>): string {
  if (recipe === "milestone-path") {
    const risks = nodes.filter((node) => node.type === "risk");
    let risksRendered = false;
    return nodes.map((node) => {
      if (node.type !== "risk") return renderNode(node, false, comments, changedIds);
      if (risksRendered) return "";
      risksRendered = true;
      return `<div class="risk-grid" aria-label="Risks and mitigations">${risks.map((risk) => renderNode(risk, false, comments, changedIds)).join("")}</div>`;
    }).join("");
  }
  if (recipe !== "option-showdown") return nodes.map((node) => renderNode(node, false, comments, changedIds)).join("");
  const optionGroups = new Map<string, FacetNode[]>();
  for (const node of nodes) {
    const key = optionKey(node);
    if (key) optionGroups.set(key, [...(optionGroups.get(key) ?? []), node]);
  }
  const groupedIds = new Set([...optionGroups.values()].flat().map((node) => node.id));
  let groupsRendered = false;
  return nodes.map((node) => {
    if (!groupedIds.has(node.id)) return renderNode(node, false, comments, changedIds);
    if (groupsRendered) return "";
    groupsRendered = true;
    const cards = [...optionGroups.entries()].map(([label, group]) => `<section class="option-card" aria-labelledby="option-${escapeAttribute(slug(label))}"><div class="option-card-heading"><span class="option-index" aria-hidden="true">${escapeHtml(label.slice(0, 1).toUpperCase())}</span><h2 id="option-${escapeAttribute(slug(label))}">${escapeHtml(label)}</h2></div>${group.map((child) => renderNode(child, true, comments, changedIds)).join("")}</section>`).join("");
    return `<div class="option-grid" aria-label="Options">${cards}</div>`;
  }).join("");
}

function optionKey(node: FacetNode): string | null {
  if (node.type !== "risk" && !/benefits?$/i.test(node.title ?? "")) return null;
  const match = (node.title ?? "").match(/^([^:—]+)(?::|—)/);
  return match?.[1]?.trim() || null;
}

function renderNode(node: FacetNode, nested = false, comments: ReviewCommentView[] = [], changedIds = new Set<string>()): string {
  const title = node.title ? `<h2>${escapeHtml(node.title)}</h2>` : "";
  const text = node.text ? `<p data-anchor-text>${escapeHtml(node.text)}</p>` : "";
  const children = node.children?.map((child) => renderNode(child, false, comments, changedIds)).join("") ?? "";
  const content = renderData(node);
  const openComments = comments.filter((comment) => comment.nodeId === node.id && comment.status === "open").length;
  const pin = openComments ? `<span class="annotation-pin" aria-label="${openComments} open comment${openComments === 1 ? "" : "s"}">${openComments}</span>` : "";
  const role = nodeRole(node);
  const tags = lensTags(node, role, changedIds.has(node.id));
  const gravity = evidenceGravity(node);
  return `<section id="node-${escapeAttribute(node.id)}" data-node-id="${escapeAttribute(node.id)}" data-node-type="${node.type}" data-block-role="${role}" data-lens-tags="${tags}" data-evidence-gravity="${gravity}"${changedIds.has(node.id) ? ` data-changed="true"` : ""} tabindex="0" class="node node-${node.type}${nested ? " node-nested" : ""}">${pin}${gravity !== "neutral" ? `<span class="gravity-label">${humanize(gravity)} evidence</span>` : ""}${title}${text}${content}${children}</section>`;
}

function renderData(node: FacetNode): string {
  const data = node.data ?? {};
  if (node.type === "metric") return `<strong class="metric">${escapeHtml(String(data.value ?? "—"))}</strong><span>${escapeHtml(String(data.label ?? "Metric"))}</span>`;
  if (node.type === "timeline") return renderTimeline(data.items);
  if (node.type === "dependency") return renderDependencies(data.items);
  if (["checklist", "navigation", "legend"].includes(node.type)) return renderList(data.items, node.type === "checklist");
  if (["table", "comparison"].includes(node.type)) return renderTable(data, node.title ?? node.id);
  if (["code", "diff"].includes(node.type)) return `<div class="code-tools"><span>${escapeHtml(String(data.language ?? "Code"))}</span><button data-code-action="copy">Copy code</button><button data-code-action="wrap" aria-pressed="false">Wrap lines</button></div><pre tabindex="0" aria-label="${humanize(node.type)}"><code>${escapeHtml(String(data.code ?? data.value ?? ""))}</code></pre>`;
  if (node.type === "decision") return renderDecision(node.id, data.options);
  if (node.type === "progress") {
    const value = numberValue(data.value, 0); return `<label>${escapeHtml(String(data.label ?? "Progress"))}<progress value="${value}" max="100">${value}%</progress></label>`;
  }
  if (node.type === "chart") return renderChart(data, node.title ?? node.id);
  if (node.type === "diagram") return renderDiagram(data);
  if (node.type === "image") return `<figure class="image-placeholder" aria-label="${escapeAttribute(String(data.alt ?? "Design preview"))}"><span>Image not embedded — text alternative</span><figcaption>${escapeHtml(String(data.alt ?? "Design preview"))}</figcaption></figure>`;
  if (node.type === "filter") return `<label>${escapeHtml(String(data.label ?? "Filter"))}<select>${arrayValue(data.options).map((item) => `<option>${escapeHtml(String(item))}</option>`).join("")}</select></label>`;
  if (node.type === "citation") return `<cite>${escapeHtml(String(data.source ?? data.value ?? "Source"))}</cite>`;
  if (node.type === "status") return `<span class="badge">${escapeHtml(String(data.value ?? "Pending"))}</span>`;
  if (node.type === "risk") return `<dl class="risk-details"><div><dt>Severity</dt><dd>${escapeHtml(String(data.severity ?? "Review required"))}</dd></div><div><dt>Mitigation</dt><dd>${escapeHtml(String(data.mitigation ?? "Mitigation not recorded"))}</dd></div></dl>`;
  if (node.type === "callout" && data.status !== undefined) return `<span class="callout-status">${escapeHtml(String(data.status))}</span>`;
  if (node.type === "persona") return `<dl><dt>Role</dt><dd>${escapeHtml(String(data.role ?? "User"))}</dd><dt>Need</dt><dd>${escapeHtml(String(data.need ?? "Complete the review"))}</dd></dl>`;
  return data.value === undefined ? "" : `<p>${escapeHtml(String(data.value))}</p>`;
}

function renderList(value: JsonValue | undefined, checklist: boolean): string {
  const items = arrayValue(value);
  return `<ul${checklist ? ` class="checklist-list"` : ""}>${items.map((item) => `<li>${checklist ? `<label><input type="checkbox">` : ""}${escapeHtml(String(item))}${checklist ? "</label>" : ""}</li>`).join("")}</ul>`;
}

function renderDiagram(data: Record<string, JsonValue>): string {
  const summary = String(data.summary ?? "System diagram");
  const flow = arrayValue(data.flow);
  const modules = arrayValue(data.items);
  if (!flow.length) return `<figure><div class="diagram" role="img" aria-label="${escapeAttribute(summary)}">${renderList(data.items, false)}</div><figcaption>${escapeHtml(summary)}</figcaption></figure>`;
  const steps = flow.map((item, index) => {
    const record = objectValue(item);
    const label = Object.keys(record).length ? String(record.label ?? `Step ${index + 1}`) : String(item);
    const detail = Object.keys(record).length ? String(record.detail ?? "") : "";
    return `<li><span>${index + 1}</span><div><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</div></li>`;
  }).join("");
  return `<figure class="architecture-map"><figcaption><span>System flow</span><strong>${escapeHtml(summary)}</strong></figcaption><ol>${steps}</ol>${modules.length ? `<details><summary>Inspect ${modules.length} implementation modules</summary>${renderList(modules, false)}</details>` : ""}</figure>`;
}

function renderTable(data: Record<string, JsonValue>, label: string): string {
  const headers = arrayValue(data.headers).map(String);
  const rows = arrayValue(data.rows).filter(Array.isArray) as JsonValue[][];
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escapeAttribute(label)} — scrollable table"><table><thead><tr>${headers.map((item) => `<th scope="col">${escapeHtml(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((item) => `<td>${escapeHtml(String(item))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderChart(data: Record<string, JsonValue>, label: string): string {
  const kind = String(data.kind ?? "bars");
  const summary = String(data.summary ?? `${label} visualization`);
  if (kind === "scorecard") return renderScorecard(data, label, summary);
  if (kind === "risk-matrix") return renderRiskMatrix(data, label, summary);
  if (kind === "token-waterfall") return renderTokenWaterfall(data, label, summary);
  const values = arrayValue(data.values).map((value) => numberValue(value, 0));
  const labels = arrayValue(data.labels).map(String);
  const rows = values.map((value, index) => [labels[index] ?? `Item ${index + 1}`, value]);
  const maximum = Math.max(1, ...values.map(Math.abs));
  const visual = rows.map(([item, raw]) => {
    const value = Number(raw);
    return `<div class="chart-row"><span>${escapeHtml(String(item))}</span><i style="--value:${Math.max(2, Math.round(Math.abs(value) / maximum * 100))}%"></i><strong>${value}</strong></div>`;
  }).join("");
  return chartFrame("bar-chart", label, summary, visual, ["Item", "Value"], rows);
}

function renderScorecard(data: Record<string, JsonValue>, label: string, summary: string): string {
  const options = arrayValue(data.options).map(String);
  const rows = arrayValue(data.rows).filter(Array.isArray) as JsonValue[][];
  const numeric = rows.flatMap((row) => row.slice(1).map((value) => numberValue(value, 0)));
  const maximum = Math.max(1, numberValue(data.max, 0), ...numeric);
  const visual = rows.map((row) => `<div class="score-row"><strong>${escapeHtml(String(row[0] ?? "Criterion"))}</strong><div>${options.map((option, index) => {
    const value = numberValue(row[index + 1], 0);
    return `<span><em>${escapeHtml(option)}</em><i style="--value:${Math.max(2, Math.round(value / maximum * 100))}%"></i><b>${value}</b></span>`;
  }).join("")}</div></div>`).join("");
  return chartFrame("scorecard", label, summary, visual, ["Criterion", ...options], rows);
}

function renderRiskMatrix(data: Record<string, JsonValue>, label: string, summary: string): string {
  const items = arrayValue(data.items).map((item, index) => {
    const record = objectValue(item);
    const likelihood = clampScale(record.likelihood);
    const impact = clampScale(record.impact);
    return { name: String(record.label ?? record.name ?? `Risk ${index + 1}`), likelihood, impact, exposure: likelihood * impact };
  }).sort((left, right) => right.exposure - left.exposure || right.impact - left.impact);
  const ticks = [1, 2, 3, 4, 5].map((value) => `<span>${value}</span>`).join("");
  const points = items.map((item, index) => {
    const x = 6 + (item.likelihood - 1) * 22;
    const y = 94 - (item.impact - 1) * 22;
    return `<span class="matrix-point" style="--x:${x}%;--y:${y}%"><b>${index + 1}</b><em>${escapeHtml(item.name)}</em></span>`;
  }).join("");
  const priorities = items.map((item, index) => `<li><b>${index + 1}</b><span><strong>${escapeHtml(item.name)}</strong><small>Impact ${item.impact}/5 · Likelihood ${item.likelihood}/5</small></span><em>Exposure ${item.exposure}/25</em></li>`).join("");
  const visual = `<p class="matrix-reading-guide"><strong>How to read it:</strong> risks farther up and right need attention sooner.</p><div class="matrix-layout"><div class="matrix-y-title"><strong>Impact</strong><span>Higher impact ↑</span></div><div class="matrix-y-ticks" aria-hidden="true">${[5, 4, 3, 2, 1].map((value) => `<span>${value}</span>`).join("")}</div><div class="matrix-grid"><span class="matrix-zone matrix-zone-act">Act now</span><span class="matrix-zone matrix-zone-manage">Manage</span><span class="matrix-zone matrix-zone-monitor">Monitor</span>${points}</div><div class="matrix-x-ticks" aria-hidden="true">${ticks}</div><div class="matrix-x-title"><strong>Likelihood</strong><span>More likely →</span></div></div><div class="matrix-priority-heading"><strong>What to address first</strong><span>Ranked by impact × likelihood</span></div><ol class="matrix-priorities">${priorities}</ol>`;
  return chartFrame("risk-matrix", label, summary, visual, ["Risk", "Likelihood (1–5)", "Impact (1–5)"], items.map((item) => [item.name, item.likelihood, item.impact]));
}

function renderTokenWaterfall(data: Record<string, JsonValue>, label: string, summary: string): string {
  const rows = arrayValue(data.items).map((item, index) => {
    if (Array.isArray(item)) return [String(item[0] ?? `Step ${index + 1}`), numberValue(item[1], 0)];
    const record = objectValue(item);
    return [String(record.label ?? `Step ${index + 1}`), numberValue(record.value, 0)];
  });
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(Number(row[1]))));
  const visual = rows.map(([item, raw]) => {
    const value = Number(raw);
    return `<div class="waterfall-row ${value < 0 ? "saving" : "cost"}"><span>${escapeHtml(String(item))}</span><i style="--value:${Math.max(2, Math.round(Math.abs(value) / maximum * 100))}%"></i><strong>${value > 0 ? "+" : ""}${value}</strong></div>`;
  }).join("");
  return chartFrame("token-waterfall", label, summary, visual, ["Stage", "Token change"], rows);
}

function chartFrame(kind: string, label: string, summary: string, visual: string, headers: string[], rows: Array<Array<JsonValue | string | number>>): string {
  const viewName = kind === "risk-matrix" ? "Risk overview" : `Data view · ${humanize(kind)}`;
  const punctuation = /[.!?]$/.test(summary) ? "" : ".";
  return `<figure class="data-visual ${kind}" aria-labelledby="${escapeAttribute(slug(label))}-caption"><div class="visual-summary"><span>${escapeHtml(viewName)}</span><strong>${escapeHtml(summary)}</strong></div><div class="visual-canvas" aria-hidden="true">${visual}</div><details class="visual-table"><summary>View accessible data table</summary>${renderTable({ headers, rows } as Record<string, JsonValue>, `${label} data`)}</details><figcaption id="${escapeAttribute(slug(label))}-caption">${escapeHtml(summary)}${punctuation} Values are also available in the data table.</figcaption></figure>`;
}

function renderTimeline(value: JsonValue | undefined): string {
  const items = arrayValue(value);
  return `<ol class="semantic-timeline">${items.map((item, index) => {
    const record = objectValue(item);
    const label = Object.keys(record).length ? String(record.label ?? record.title ?? `Step ${index + 1}`) : String(item);
    const detail = Object.keys(record).length ? String(record.detail ?? record.status ?? "") : "";
    const parts = label.split("·").map((part) => part.trim());
    const eyebrow = parts.length > 1 ? parts.shift()! : `Step ${index + 1}`;
    const title = parts.length ? parts.join(" · ") : label;
    return `<li><span>${String(index + 1).padStart(2, "0")}</span><div><small>${escapeHtml(eyebrow)}</small><strong>${escapeHtml(title)}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ""}</div></li>`;
  }).join("")}</ol>`;
}

function renderDependencies(value: JsonValue | undefined): string {
  const items = arrayValue(value);
  return `<ul class="dependency-map">${items.map((item) => {
    const record = objectValue(item);
    const from = Object.keys(record).length ? String(record.from ?? record.label ?? "Input") : String(item);
    const to = Object.keys(record).length ? String(record.to ?? record.dependsOn ?? "Outcome") : "Outcome";
    return `<li><span>${escapeHtml(from)}</span><i aria-hidden="true">→</i><strong>${escapeHtml(to)}</strong></li>`;
  }).join("")}</ul>`;
}

function renderDecision(id: string, value: JsonValue | undefined): string {
  return `<fieldset data-decision-id="${escapeAttribute(id)}"><legend>Choose one option</legend><p class="decision-mode-hint">Switch to Decide mode to choose and record an option.</p>${arrayValue(value).map((item) => `<label><input type="radio" name="${escapeAttribute(id)}" value="${escapeAttribute(String(item))}">${escapeHtml(String(item))}</label>`).join("")}<details class="decision-context-fields"><summary>Add decision context</summary><label>Rationale<textarea data-decision-rationale name="${escapeAttribute(id)}-rationale" autocomplete="off" maxlength="4000" placeholder="Explain why this choice is best…"></textarea></label><div class="decision-field-grid"><label>Confidence<select data-decision-confidence name="${escapeAttribute(id)}-confidence"><option value="">Not set</option><option value="1">1 — Low</option><option value="2">2</option><option value="3">3 — Medium</option><option value="4">4</option><option value="5">5 — High</option></select></label><label>Owner<input data-decision-owner name="${escapeAttribute(id)}-owner" autocomplete="off" maxlength="200"></label><label>Due date<input data-decision-due name="${escapeAttribute(id)}-due" type="date"></label></div></details><button data-action="decision">Record decision</button></fieldset>`;
}

function renderCommentThread(artifact: FacetArtifact, comments: ReviewCommentView[]): string {
  const renderItem = (comment: ReviewCommentView): string => {
    const replies = comments.filter((candidate) => candidate.parentId === comment.id).map(renderItem).join("");
    return `<li data-comment-id="${escapeAttribute(comment.id)}" data-comment-status="${comment.status}" class="comment ${comment.status}${comment.parentId ? " reply" : ""}"><span class="comment-anchor">${escapeHtml(anchorLabel(comment))} · ${anchorState(artifact, comment)}</span>${comment.anchor && comment.anchor.kind !== "node" ? `<blockquote>${escapeHtml(comment.anchor.quote)}</blockquote>` : ""}<p>${escapeHtml(comment.body)}</p><div class="comment-actions"><button data-reply-comment="${escapeAttribute(comment.id)}" data-reply-node="${escapeAttribute(comment.nodeId)}">Reply</button>${comment.status === "open" ? `<button data-resolve-comment="${escapeAttribute(comment.id)}">Resolve</button>` : `<span class="resolved-label">Resolved</span>`}</div>${replies ? `<ol class="reply-list">${replies}</ol>` : ""}</li>`;
  };
  return comments.filter((comment) => !comment.parentId).map(renderItem).join("");
}

function arrayValue(value: JsonValue | undefined): JsonValue[] { return Array.isArray(value) ? value : [] }
function numberValue(value: JsonValue | undefined, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback }
function objectValue(value: JsonValue | undefined): Record<string, JsonValue> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {} }
function clampScale(value: JsonValue | undefined): number { return Math.max(1, Math.min(5, Math.round(numberValue(value, 1)))) }
function humanize(value: string): string { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;") }
function escapeAttribute(value: string): string { return escapeHtml(value) }
function safeJson(value: unknown): string { return JSON.stringify(value).replaceAll("<", "\\u003c") }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option" }
function nodeRole(node: FacetNode): string {
  const label = `${node.id} ${node.title ?? ""}`.toLowerCase();
  if (node.type === "decision") return "decision";
  if (node.type === "comparison") return "comparison";
  if (node.type === "risk") return "risk";
  if (node.type === "callout" || label.includes("recommendation")) return "recommendation";
  if (/benefits?/.test(label)) return "benefit";
  return "content";
}
function lensTags(node: FacetNode, role: string, changed: boolean): string {
  const tags = new Set(["all", "story", "board", "focus"]);
  if (["comparison", "recommendation", "decision"].includes(role) || node.type === "section") tags.add("summary");
  if (["citation", "table", "comparison", "chart", "metric", "diagram"].includes(node.type)) tags.add("evidence");
  if (role === "risk" || /assumption|constraint/i.test(`${node.id} ${node.title ?? ""}`)) tags.add("risk");
  if (["comparison", "recommendation", "decision", "risk"].includes(role)) tags.add("decision");
  if (changed) tags.add("change");
  return [...tags].join(" ");
}
function evidenceGravity(node: FacetNode): "strong" | "provisional" | "neutral" {
  if (node.type === "citation" || node.data?.confidence === "high") return "strong";
  if (/assumption|hypothesis|unverified/i.test(`${node.id} ${node.title ?? ""}`) || node.data?.confidence === "low") return "provisional";
  return "neutral";
}
function anchorLabel(comment: ReviewCommentView): string {
  if (!comment.anchor || comment.anchor.kind === "node") return `${comment.nodeId} · r${comment.anchorRevision}`;
  if (comment.anchor.kind === "code") return `${comment.nodeId} · lines ${comment.anchor.lineStart}–${comment.anchor.lineEnd} · r${comment.anchorRevision}`;
  return `${comment.nodeId} · characters ${comment.anchor.start}–${comment.anchor.end} · r${comment.anchorRevision}`;
}

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
