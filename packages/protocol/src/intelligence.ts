import { validateArtifact } from "./validation.js";
import type { FacetArtifact, FacetNode, JsonValue } from "./types.js";

export type ReviewKind = "comparison" | "plan" | "technical-review" | "dashboard" | "report";
export interface ArtifactQualityIssue { level:"error"|"warning"|"suggestion"; code:string; nodeId?:string; message:string }
export interface ArtifactQualityReport { valid:boolean; kind:ReviewKind; recipe:string; issues:ArtifactQualityIssue[]; score:number }

/** Deterministic, model-free routing and quality checks for compact agent workflows. */
export function inspectArtifact(artifact: FacetArtifact): ArtifactQualityReport {
  const validation = validateArtifact(artifact);
  const flat = flatten(artifact.nodes);
  const types = new Set(flat.map((node) => node.type));
  const kind: ReviewKind = types.has("comparison") ? "comparison" : types.has("timeline") || types.has("checklist") ? "plan" : types.has("code") || types.has("diff") || types.has("diagram") ? "technical-review" : types.has("chart") || types.has("metric") ? "dashboard" : "report";
  const recipe = kind === "comparison" && types.has("decision") ? "option-showdown" : kind === "dashboard" ? "evidence-dashboard" : kind === "plan" ? "milestone-path" : kind === "technical-review" ? "technical-inspection" : "reading-flow";
  const issues: ArtifactQualityIssue[] = validation.issues.map((item) => ({level:"error",code:item.code,message:`${item.path}: ${item.message}`}));
  if (flat.length < 2) issues.push({level:"suggestion",code:"thin-artifact",message:"A review canvas is most useful with at least two reviewable sections; otherwise answer in prose."});
  if (kind === "comparison" && !types.has("decision")) issues.push({level:"warning",code:"missing-decision",message:"Comparison has no explicit decision node with two or more choices."});
  for (const node of flat) {
    if (node.type === "decision" && arrayValue(node.data?.options).length < 2) issues.push({level:"error",code:"decision-options",nodeId:node.id,message:"Decision nodes require at least two choices."});
    if (node.type === "chart" && typeof node.data?.summary !== "string") issues.push({level:"warning",code:"chart-summary",nodeId:node.id,message:"Add a plain-language summary so the visualization has a stated conclusion."});
    if (node.type === "diagram" && (typeof node.data?.summary !== "string" || arrayValue(node.data?.items).length === 0)) issues.push({level:"warning",code:"diagram-alternative",nodeId:node.id,message:"Diagrams need a summary and navigable items as a text alternative."});
    if (node.type === "risk" && node.data?.mitigation === undefined) issues.push({level:"warning",code:"risk-mitigation",nodeId:node.id,message:"Record a mitigation for this risk."});
  }
  const riskCount = flat.filter((node) => node.type === "risk").length;
  const hasRiskMatrix = flat.some((node) => node.type === "chart" && node.data?.kind === "risk-matrix");
  if (riskCount >= 3 && !hasRiskMatrix) issues.push({level:"suggestion",code:"risk-matrix",message:"Three or more risks may benefit from one compact risk-matrix chart."});
  const penalty = issues.reduce((sum, item) => sum + (item.level === "error" ? 25 : item.level === "warning" ? 8 : 2), 0);
  return { valid:validation.valid && !issues.some((item) => item.level === "error"),kind,recipe,issues,score:Math.max(0,100-penalty) };
}

function flatten(nodes: FacetNode[]): FacetNode[] { return nodes.flatMap((node) => [node,...flatten(node.children ?? [])]) }
function arrayValue(value: JsonValue | undefined): JsonValue[] { return Array.isArray(value) ? value : [] }
