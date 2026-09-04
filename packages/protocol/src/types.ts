export const NODE_TYPES = [
  "section", "callout", "metric", "timeline", "checklist", "decision",
  "status", "dependency", "diagram", "legend", "comparison", "table",
  "code", "diff", "citation", "image", "risk", "chart", "filter",
  "navigation", "persona", "progress",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type NodeData = Record<string, JsonValue>;

export interface FacetNode {
  id: string;
  type: NodeType;
  title?: string;
  text?: string;
  data?: NodeData;
  children?: FacetNode[];
}

export interface FacetArtifact {
  protocol: "facet";
  version: 1;
  revision: number;
  id: string;
  title: string;
  theme: "precision-canvas";
  capabilities: string[];
  nodes: FacetNode[];
}

export interface ValidationIssue { path: string; code: string; message: string }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[]; nodeCount: number; maxDepth: number }
