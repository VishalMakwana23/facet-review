import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEncoding } from "js-tiktoken";
import { applyPatch, decodeCompactPatch, decodeTuple, encodeTuple } from "../../packages/protocol/dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const benchmarkRoot = resolve(root, "benchmarks/competitive");
const manifest = JSON.parse(await readFile(resolve(benchmarkRoot, "manifest.json"), "utf8"));
const encoding = getEncoding("o200k_base");
const runId = new Date().toISOString().replaceAll(":", "-");
const resultsDirectory = resolve(benchmarkRoot, "results");
const outputDirectory = resolve(resultsDirectory, runId);
await mkdir(resultsDirectory, { recursive: true });
await mkdir(outputDirectory, { recursive: false });

const cases = [];
for (const definition of manifest.cases) {
  const capturePath = resolve(benchmarkRoot, "captures", definition.id, "capture.json");
  let capture;
  try { capture = JSON.parse(await readFile(capturePath, "utf8")) } catch { cases.push({ id: definition.id, status: "missing" }); continue }
  cases.push(await evaluateCase(definition, capture, dirname(capturePath)));
}

const completed = cases.filter((entry) => entry.status === "complete");
const visualVotes = completed.map((entry) => entry.evaluation.blindVisualPreference).filter((value) => ["facet", "lavish"].includes(value));
const facetVisualPreferencePercent = visualVotes.length ? round(100 * visualVotes.filter((value) => value === "facet").length / visualVotes.length) : null;
const workflowReductions = completed.map((entry) => entry.workflowTokenReductionPercent).filter(Number.isFinite);
const patchPercents = completed.map((entry) => entry.facetPatchPercent).filter(Number.isFinite);
const completedTasks = completed.reduce((total, entry) => total + (entry.evaluation.unassistedTasksCompleted ?? 0), 0);
const totalTasks = completed.reduce((total, entry) => total + (entry.evaluation.unassistedTasksTotal ?? 0), 0);
const unassistedTaskCompletionPercent = totalTasks ? round(100 * completedTasks / totalTasks) : null;
const criticalAccessibilityViolations = completed.reduce((total, entry) => total + (entry.evaluation.criticalAccessibilityViolations ?? 0), 0);
const coverageComplete = completed.length === manifest.gates.completedCases;
const report = {
  schemaVersion: 1,
  runId,
  benchmarkId: manifest.benchmarkId,
  gitCommit: commit(),
  dirtyWorktree: true,
  disclosure: "Direct captured-output harness. Final representation tokens, emitted workflow tokens, and authoritative turn usage are separate measures. Missing data fails closed and estimated text tokens are not billing usage.",
  coverage: { required: manifest.gates.completedCases, captured: cases.filter((entry) => entry.status !== "missing").length, completed: completed.length },
  summary: {
    facetVisualPreferencePercent,
    medianWorkflowTokenReductionPercent: workflowReductions.length ? median(workflowReductions) : null,
    unassistedTaskCompletionPercent,
    medianFacetPatchPercent: patchPercents.length ? median(patchPercents) : null,
    criticalAccessibilityViolations,
    gates: {
      coverage: coverageComplete,
      visualPreference: coverageComplete && facetVisualPreferencePercent !== null && facetVisualPreferencePercent >= manifest.gates.blindFacetPreferencePercent,
      taskCompletion: coverageComplete && unassistedTaskCompletionPercent !== null && unassistedTaskCompletionPercent >= manifest.gates.unassistedTaskCompletionPercent,
      workflowTokens: coverageComplete && workflowReductions.length === completed.length && median(workflowReductions) >= manifest.gates.workflowTokenReductionPercent,
      patchEfficiency: coverageComplete && patchPercents.length === completed.length && median(patchPercents) <= manifest.gates.medianFacetPatchPercent,
      accessibility: coverageComplete && criticalAccessibilityViolations <= manifest.gates.criticalAccessibilityViolations,
    }
  },
  cases
};
report.summary.gatePassed = Object.values(report.summary.gates).every(Boolean);
await writeFile(resolve(outputDirectory, "report.json"), pretty(report));
await writeFile(resolve(outputDirectory, "REPORT.md"), markdown(report));
await writeFile(resolve(resultsDirectory, "latest.json"), pretty({ runId, report: `./${runId}/report.json`, gatePassed: report.summary.gatePassed }));
console.log(markdown(report));

async function evaluateCase(definition, capture, captureDirectory) {
  const facet = await measureFacet(capture.variants?.facet, captureDirectory);
  const lavish = await measureLavish(capture.variants?.lavish, captureDirectory);
  const complete = capture.status === "complete" && facet.initial && facet.revisions.length && lavish.initial && lavish.revisions.length && capture.evaluation?.contentParity === "pass";
  const facetWorkflow = sum([facet.initial, ...facet.revisions].map((item) => item?.tokens));
  const lavishWorkflow = sum([lavish.initial, ...lavish.revisions].map((item) => item?.tokens));
  const workflowTokenReductionPercent = complete && lavishWorkflow > 0 ? round(100 * (1 - facetWorkflow / lavishWorkflow)) : null;
  const finalRepresentationReductionPercent = facet.final && lavish.final ? round(100 * (1 - facet.final.tokens / lavish.final.tokens)) : null;
  const facetRevisionTokens = sum(facet.revisions.map((item) => item.tokens));
  const facetPatchPercent = complete && facet.initial?.tokens && facetRevisionTokens !== null ? round(100 * facetRevisionTokens / facet.initial.tokens) : null;
  return { id: definition.id, status: complete ? "complete" : "partial", model: capture.model ?? null, reasoningEffort: capture.reasoningEffort ?? null, facet, lavish, workflowTokenReductionPercent, finalRepresentationReductionPercent, facetPatchPercent, evaluation: capture.evaluation ?? {} };
}

async function measureFacet(value, base) {
  if (!value?.initialFile) return { initial: null, revisions: [], final: null };
  const initialText = await readRelative(base, value.initialFile);
  let artifact = decodeTuple(JSON.parse(initialText));
  const revisions = [];
  for (const file of value.revisionFiles ?? []) {
    const patchText = await readRelative(base, file);
    revisions.push(measure(patchText));
    artifact = applyPatch(artifact, decodeCompactPatch(JSON.parse(patchText)));
  }
  return { initial: measure(initialText), revisions, final: measure(JSON.stringify(encodeTuple(artifact))), authoritativeUsage: usage(value) };
}

async function measureLavish(value, base) {
  const initial = value?.initialFile ? measure(await readRelative(base, value.initialFile)) : null;
  const revisions = [];
  for (const file of value?.revisionFiles ?? []) revisions.push(measure(await readRelative(base, file)));
  const final = value?.finalFile ? measure(await readRelative(base, value.finalFile)) : (revisions.at(-1) ?? initial);
  return { initial, revisions, final, authoritativeUsage: usage(value) };
}

function usage(value) {
  const initial = value?.initialTurnUsage;
  const revision = value?.revisionTurnUsage;
  return initial === null || initial === undefined || revision === null || revision === undefined ? null : { initial, revision, total: initial + revision };
}
async function readRelative(base, path) { return readFile(resolve(base, path), "utf8") }
function measure(text) { return { bytes: Buffer.byteLength(text), tokens: encoding.encode(text).length } }
function sum(values) { return values.every(Number.isFinite) ? values.reduce((total, value) => total + value, 0) : null }
function median(values) { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) }
function round(value) { return Math.round(value * 100) / 100 }
function pretty(value) { return `${JSON.stringify(value, null, 2)}\n` }
function commit() { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() } catch { return "uncommitted" } }
function markdown(report) {
  const lines = ["# Facet versus Lavish benchmark", "", `- Run: ${report.runId}`, `- Coverage: ${report.coverage.completed}/${report.coverage.required} complete (${report.coverage.captured} captured)`, `- Competitive gate: **${report.summary.gatePassed ? "PASS" : "NOT YET ELIGIBLE"}**`, `- Blind Facet preference: ${percent(report.summary.facetVisualPreferencePercent)}`, `- Unassisted completion: ${percent(report.summary.unassistedTaskCompletionPercent)}`, `- Median workflow reduction: ${percent(report.summary.medianWorkflowTokenReductionPercent)}`, `- Median Facet patch: ${percent(report.summary.medianFacetPatchPercent)}`, `- Critical accessibility violations: ${report.summary.criticalAccessibilityViolations}`, "", "| Gate | Result |", "|---|---|", ...Object.entries(report.summary.gates).map(([name, passed]) => `| ${name} | ${passed ? "PASS" : "PENDING / FAIL"} |`), "", "| Case | Status | Final representation reduction | Workflow reduction | Facet patch | Visual preference |", "|---|---|---:|---:|---:|---|"];
  for (const item of report.cases) lines.push(`| ${item.id} | ${item.status} | ${percent(item.finalRepresentationReductionPercent)} | ${percent(item.workflowTokenReductionPercent)} | ${percent(item.facetPatchPercent)} | ${item.evaluation?.blindVisualPreference ?? "—"} |`);
  lines.push("", report.disclosure, ""); return lines.join("\n");
}
function percent(value) { return value === null || value === undefined ? "—" : `${value}%` }
