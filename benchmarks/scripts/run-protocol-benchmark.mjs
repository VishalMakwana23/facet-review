import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEncoding } from "js-tiktoken";
import {
  applyPatch, canonicalJson, collectNodeIds, decodeCompactPatch, decodeGraph, decodeTree, decodeTuple,
  encodeCompactPatch, encodeGraph, encodeTree, encodeTuple, migrateEnvelope, validateArtifact,
} from "../../packages/protocol/dist/index.js";
import { renderProductArtifact as renderArtifact } from "../../packages/renderer/dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const corpus = JSON.parse(await readFile(resolve(root, "benchmarks/corpus/manifest.json"), "utf8"));
const encodings = { o200k_base: getEncoding("o200k_base"), cl100k_base: getEncoding("cl100k_base") };
const runId = new Date().toISOString().replaceAll(":", "-");
const output = resolve(root, "benchmarks/results", runId);
await mkdir(resolve(output, "artifacts"), { recursive: true });

const candidates = {
  tree: { encode: encodeTree, decode: decodeTree },
  graph: { encode: encodeGraph, decode: decodeGraph },
  tuple: { encode: encodeTuple, decode: decodeTuple },
};

const rows = [];
for (const brief of corpus.artifacts) {
  const artifact = createArtifact(brief);
  const validation = validateArtifact(artifact);
  if (!validation.valid) throw new Error(`${brief.id} canonical artifact is invalid: ${JSON.stringify(validation.issues)}`);
  const html = renderArtifact(artifact);
  const audit = auditHtml(html, artifact);
  const artifactDir = resolve(output, "artifacts", brief.id);
  await mkdir(artifactDir, { recursive: true });
  await writeFile(resolve(artifactDir, "baseline.html"), html);
  await writeFile(resolve(artifactDir, "canonical.json"), pretty(artifact));

  const revision1Patch = { artifactId: artifact.id, baseRevision: 0, nextRevision: 1, operations: [{ op: "spliceText", id: artifact.nodes[0].id, start: artifact.nodes[0].text.length, deleteCount: 0, value: ` Revision: ${brief.revision1}.` }] };
  const revision1 = applyPatch(artifact, revision1Patch);
  const revision2Patch = { artifactId: artifact.id, baseRevision: 1, nextRevision: 2, operations: [{ op: "move", id: revision1.nodes[0].id, parentId: null, index: revision1.nodes.length - 1 }] };
  const revision2a = applyPatch(revision1, revision2Patch);
  const revision2b = applyPatch(revision1, revision2Patch);
  const revision1Html = renderArtifact(revision1);
  const revision2Html = renderArtifact(revision2a);
  const deterministic = canonicalJson(revision2a) === canonicalJson(revision2b);
  const stableIds = sameSet(collectNodeIds(artifact), collectNodeIds(revision2a));
  const compactRevision1 = encodeCompactPatch(revision1Patch);
  const compactRevision2 = encodeCompactPatch(revision2Patch);
  if (canonicalJson(applyPatch(artifact, decodeCompactPatch(compactRevision1))) !== canonicalJson(revision1)) throw new Error(`${brief.id} compact revision 1 is not lossless`);
  await writeFile(resolve(artifactDir, "revision-1.patch.json"), pretty(compactRevision1));
  await writeFile(resolve(artifactDir, "revision-2.patch.json"), pretty(compactRevision2));
  await writeFile(resolve(artifactDir, "baseline-revision-1.html"), revision1Html);
  await writeFile(resolve(artifactDir, "baseline-revision-2.html"), revision2Html);

  const legacy = { schemaVersion: 0, document: { id: artifact.id, revision: artifact.revision, title: artifact.title, blocks: artifact.nodes, actions: artifact.capabilities } };
  const migrationLossless = canonicalJson(migrateEnvelope(legacy)) === canonicalJson(artifact);
  const normalizedHtml = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, script) => `<script>${script.replace(/^[ \t]+/gm, '')}</script>`);
  const htmlMetrics = measure(normalizedHtml);
  const htmlActual = measure(html);
  await writeFile(resolve(artifactDir, 'baseline.normalized.html'), normalizedHtml);
  // Give the HTML comparison an incremental update strategy too. This is a modeled
  // semantic DOM updater, not a measurement of Lavish or another installed product.
  const htmlPatch1 = JSON.stringify(['html-patch', artifact.id, 0, 1, [['appendText', artifact.nodes[0].id, ` Revision: ${brief.revision1}.`]]]);
  const htmlPatch2 = JSON.stringify(['html-patch', artifact.id, 1, 2, [['move', artifact.nodes[0].id, null, artifact.nodes.length - 1]]]);
  const htmlIncremental = { revision1: measure(htmlPatch1), revision2: measure(htmlPatch2) };
  const htmlContentOnly = measure(html.match(/<article[^>]*>([\s\S]*?)<\/article>/)?.[1] ?? '');
  await writeFile(resolve(artifactDir, 'html-incremental-1.json'), htmlPatch1);
  await writeFile(resolve(artifactDir, 'html-incremental-2.json'), htmlPatch2);
  const candidateMetrics = {};
  for (const [name, candidate] of Object.entries(candidates)) {
    const encoded = candidate.encode(artifact);
    const compact = JSON.stringify(encoded);
    const decoded = candidate.decode(encoded);
    const roundTrip = canonicalJson(decoded) === canonicalJson(artifact);
    const renderedEqual = renderArtifact(decoded) === html;
    candidateMetrics[name] = { ...measure(compact), reduction: reductions(htmlMetrics.tokens, measure(compact).tokens), roundTrip, renderedEqual };
    await writeFile(resolve(artifactDir, `${name}.json`), pretty(encoded));
  }
  rows.push({ id: brief.id, category: brief.category, nodeCount: validation.nodeCount, html: htmlMetrics, htmlActual, htmlContentOnly, htmlIncremental, htmlRevisions: { revision1: measure(revision1Html), revision2: measure(revision2Html) }, candidates: candidateMetrics, patches: { revision1: measure(JSON.stringify(compactRevision1)), revision2: measure(JSON.stringify(compactRevision2)) }, checks: { structuralAccessibility: audit, deterministic, stableIds, migrationLossless } });
}

const summary = Object.fromEntries(Object.keys(candidates).map((name) => [name, summarize(name, rows)]));
const eligible = Object.entries(summary).filter(([, value]) => value.gatePassed).sort((a, b) => b[1].medianReduction.o200k_base - a[1].medianReduction.o200k_base);
const selected = eligible[0]?.[0] ?? null;
const patchSummary = selected ? summarizePatches(selected, rows) : null;
const mvpSummary = selected ? summarizeMvp(selected, rows, patchSummary) : null;
const rendererBytes = (await stat(resolve(root, "packages/renderer/dist/index.js"))).size + (await stat(resolve(root, "packages/renderer/dist/runtime.js"))).size;
const report = {
  runId, corpusId: corpus.corpusId, gitCommit: commit(), dirtyWorktree: true,
  environment: { platform: process.platform, architecture: process.arch, node: process.version, tokenizers: ["js-tiktoken@1.0.21:o200k_base", "js-tiktoken@1.0.21:cl100k_base"] },
  renderer: { package: "@facet-review/renderer", version: "0.0.0", compiledEntryBytes: rendererBytes },
  baselineDisclosure: 'Synthetic corpus. Full HTML host emitted once plus modeled incremental DOM updates. Not a direct Lavish comparison; excludes reasoning, input and retry tokens. Cached-host sensitivity is reported separately.',
  normalization: 'Primary HTML counts remove leading indentation from the authored runtime script only; code/prose content is unchanged. Actual emitted HTML counts are in htmlActual. Wire JSON and HTML patches are compact JSON. This is not an optimal minifier baseline.',
  artifactCount: rows.length, selected, gatePassed: selected !== null && mvpSummary.gatePassed, summary, patchSummary, mvpSummary, rows,
};
await writeFile(resolve(output, "report.json"), pretty(report));
await writeFile(resolve(output, "REPORT.md"), markdown(report));
await writeFile(resolve(root, "benchmarks/results/latest.json"), pretty({ runId, report: `./${runId}/report.json`, selected, gatePassed: report.gatePassed }));
console.log(markdown(report));
if (!report.gatePassed) process.exitCode = 1;

function createArtifact(brief) {
  return { protocol: "facet", version: 1, revision: 0, id: brief.id, title: brief.title, theme: "precision-canvas", capabilities: brief.interactions,
    nodes: brief.requiredNodes.map((type, index) => ({ id: `${brief.id}.${type}.${index + 1}`, type, title: titleCase(type), text: `${titleCase(type)} content for ${brief.title}. This section preserves the complete claim, state, and review context required by the benchmark brief.`, data: dataFor(type, brief, index) })) };
}
function dataFor(type, brief, index) {
  if (type === "metric") return { value: index === 0 ? "70%" : `${index + 1}×`, label: "Measured target" };
  if (["timeline", "checklist", "navigation", "legend", "dependency", "diagram"].includes(type)) return { items: ["Prepare evidence", "Review the change", "Record the decision"], summary: `${brief.title} sequence` };
  if (["table", "comparison"].includes(type)) return { headers: ["Criterion", "Current", "Target"], rows: [["Clarity", "Variable", "Consistent"], ["Review", "Manual", "Structured"]] };
  if (["code", "diff"].includes(type)) return { code: "export function review(input) {\n  return validate(input);\n}" };
  if (type === "decision") return { options: ["Continue", "Revise", "Stop"] };
  if (type === "chart") return { values: [28, 46, 63, 78], summary: `${brief.title} trend` };
  if (type === "filter") return { label: "View", options: ["All", "Open", "Resolved"] };
  if (type === "progress") return { value: 64, label: "Completion" };
  if (type === "citation") return { source: "Benchmark evidence source" };
  if (type === "image") return { alt: `${brief.title} responsive preview` };
  if (type === "status") return { value: "Ready for review" };
  if (type === "persona") return { role: "Technical reviewer", need: "Reach a confident decision" };
  return { value: brief.revision1 };
}
function auditHtml(html, artifact) {
  const checks = {
    language: html.includes('<html lang="en">'), viewport: html.includes('name="viewport"'), landmarks: ["main", "article"].every((tag) => new RegExp(`<${tag}(?:\\s[^>]*)?>`).test(html)) && html.includes('role="complementary"'),
    labelledReview: /<div\b[^>]*\baria-label="Review panel"[^>]*>/.test(html), labelledInput: html.includes('<label for="comment">'), visibleFocus: html.includes(":focus-visible"), reducedMotion: html.includes("prefers-reduced-motion"),
    stableNodeHooks: artifact.nodes.every((node) => html.includes(`data-node-id="${node.id}"`)), capabilities: artifact.capabilities.every((capability) => html.includes(`data-capability="${capability}"`)),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}
function measure(text) {
  return { bytes: Buffer.byteLength(text), nonWhitespaceCharacters: text.replace(/\s/g, "").length, tokens: Object.fromEntries(Object.entries(encodings).map(([name, encoding]) => [name, encoding.encode(text).length])) };
}
function reductions(baseline, candidate) { return Object.fromEntries(Object.keys(baseline).map((name) => [name, round((1 - candidate[name] / baseline[name]) * 100)])) }
function summarize(name, allRows) {
  const medianReduction = Object.fromEntries(Object.keys(encodings).map((encoding) => [encoding, median(allRows.map((row) => row.candidates[name].reduction[encoding]))]));
  const categories = [...new Set(allRows.map((row) => row.category))];
  const categoryMedians = Object.fromEntries(categories.map((category) => [category, median(allRows.filter((row) => row.category === category).map((row) => row.candidates[name].reduction.o200k_base))]));
  const checksPassed = allRows.every((row) => row.candidates[name].roundTrip && row.candidates[name].renderedEqual && row.checks.structuralAccessibility.passed && row.checks.deterministic && row.checks.stableIds && row.checks.migrationLossless);
  return { medianReduction, categoryMedians, checksPassed, gatePassed: medianReduction.o200k_base >= 60 && Object.values(categoryMedians).every((value) => value >= 0) && checksPassed };
}
function summarizePatches(name, allRows) {
  const byEncoding = Object.fromEntries(Object.keys(encodings).map((encoding) => {
    const percentages = allRows.flatMap((row) => [row.patches.revision1, row.patches.revision2].map((patch) => 100 * patch.tokens[encoding] / row.candidates[name].tokens[encoding]));
    return [encoding, { medianPercentOfFullArtifact: median(percentages), maximumPercentOfFullArtifact: round(Math.max(...percentages)) }];
  }));
  return { candidate: name, revisionCount: allRows.length * 2, byEncoding };
}
function summarizeMvp(name, allRows, patches) {
  const totals = Object.fromEntries(Object.keys(encodings).map((encoding) => {
    const reductions = allRows.map((row) => {
      const htmlTotal = row.html.tokens[encoding] + row.htmlIncremental.revision1.tokens[encoding] + row.htmlIncremental.revision2.tokens[encoding];
      const facetTotal = row.candidates[name].tokens[encoding] + row.patches.revision1.tokens[encoding] + row.patches.revision2.tokens[encoding];
      return 100 * (1 - facetTotal / htmlTotal);
    });
    return [encoding, { medianReduction: median(reductions), p10Reduction: percentile(reductions, 0.1) }];
  }));
  const primary = totals.o200k_base;
  const cachedHostSensitivity = Object.fromEntries(Object.keys(encodings).map(encoding => {
    const values = allRows.map(row => 100 * (1 - (row.candidates[name].tokens[encoding] + row.patches.revision1.tokens[encoding] + row.patches.revision2.tokens[encoding]) / (row.htmlContentOnly.tokens[encoding] + row.htmlIncremental.revision1.tokens[encoding] + row.htmlIncremental.revision2.tokens[encoding])));
    return [encoding,{medianReduction:median(values),p10Reduction:percentile(values,0.1)}];
  }));
  return { candidate: name, totals, cachedHostSensitivity, gatePassed: primary.medianReduction >= 70 && primary.p10Reduction >= 40 && patches.byEncoding.o200k_base.medianPercentOfFullArtifact <= 15 };
}
function markdown(report) {
  const lines = ["# Protocol Selection Benchmark", "", `- Corpus: ${report.corpusId} (${report.artifactCount} artifacts)`, `- Selected candidate: **${report.selected ?? "none"}**`, `- Gate: **${report.gatePassed ? "PASS" : "FAIL"}**`, `- Renderer compiled entry: ${report.renderer.compiledEntryBytes} bytes`, "", "| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |", "|---|---:|---:|---|---|"];
  for (const [name, value] of Object.entries(report.summary)) lines.push(`| ${name} | ${value.medianReduction.o200k_base}% | ${value.medianReduction.cl100k_base}% | ${value.checksPassed ? "pass" : "fail"} | ${value.gatePassed ? "PASS" : "FAIL"} |`);
  if (report.patchSummary) lines.push("", `Compact revisions: ${report.patchSummary.byEncoding.o200k_base.medianPercentOfFullArtifact}% median and ${report.patchSummary.byEncoding.o200k_base.maximumPercentOfFullArtifact}% maximum of the selected full artifact (o200k_base, ${report.patchSummary.revisionCount} revisions).`);
  if (report.mvpSummary) lines.push("", `MVP total-output gate: **${report.mvpSummary.gatePassed ? "PASS" : "FAIL"}** — ${report.mvpSummary.totals.o200k_base.medianReduction}% median reduction and ${report.mvpSummary.totals.o200k_base.p10Reduction}% p10 reduction across initial output plus two revisions.`);
  if (report.mvpSummary) lines.push('', `Cached HTML host sensitivity: ${report.mvpSummary.cachedHostSensitivity.o200k_base.medianReduction}% median and ${report.mvpSummary.cachedHostSensitivity.o200k_base.p10Reduction}% p10. This removes shared HTML chrome from output costs; do not generalize the main gate to reusable-host competitors.`);
  lines.push('', report.baselineDisclosure, '', 'Structural checks are not a substitute for browser accessibility or human usability tests.', ''); return lines.join('\n');
}
function median(values) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) }
function percentile(values, fraction) { const sorted = [...values].sort((a, b) => a - b); const index = (sorted.length - 1) * fraction; const lower = Math.floor(index); const upper = Math.ceil(index); return round(lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)) }
function round(value) { return Math.round(value * 100) / 100 }
function sameSet(a, b) { return a.length === b.length && a.every((value) => b.includes(value)) }
function titleCase(value) { return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function pretty(value) { return `${JSON.stringify(value, null, 2)}\n` }
function commit() { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() } catch { return "uncommitted" } }
