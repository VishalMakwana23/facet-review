import { NODE_TYPES, type FacetArtifact, type ValidationIssue, type ValidationResult } from "./types.js";

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,95}$/;
const ALLOWED_TYPES = new Set<string>(NODE_TYPES);
const MAX_NODES = 1_000;
const MAX_DEPTH = 16;
const MAX_TEXT_LENGTH = 200_000;

export function validateArtifact(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  let nodeCount = 0;
  let maxDepth = 0;
  if (!isRecord(input)) return { valid: false, issues: [issue("$", "type", "Artifact must be an object")], nodeCount, maxDepth };
  if (input.protocol !== "facet") issues.push(issue("$.protocol", "constant", "Protocol must be facet"));
  if (input.version !== 1) issues.push(issue("$.version", "version", "Only protocol version 1 is supported"));
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) issues.push(issue("$.revision", "range", "Revision must be a non-negative safe integer"));
  if (typeof input.id !== "string" || !ID_PATTERN.test(input.id)) issues.push(issue("$.id", "format", "Artifact ID is invalid"));
  if (typeof input.title !== "string" || input.title.length === 0) issues.push(issue("$.title", "required", "Title is required"));
  if (input.theme !== "precision-canvas") issues.push(issue("$.theme", "enum", "Unknown theme"));
  if (!Array.isArray(input.capabilities) || input.capabilities.some((value) => typeof value !== "string")) issues.push(issue("$.capabilities", "type", "Capabilities must be strings"));
  if (!Array.isArray(input.nodes)) issues.push(issue("$.nodes", "type", "Nodes must be an array"));

  function visit(node: unknown, path: string, depth: number): void {
    nodeCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    if (nodeCount > MAX_NODES) {
      if (!issues.some((entry) => entry.code === "node-limit")) issues.push(issue(path, "node-limit", `Artifact exceeds ${MAX_NODES} nodes`));
      return;
    }
    if (depth > MAX_DEPTH) { issues.push(issue(path, "depth-limit", `Artifact exceeds depth ${MAX_DEPTH}`)); return; }
    if (!isRecord(node)) { issues.push(issue(path, "type", "Node must be an object")); return; }
    if (typeof node.id !== "string" || !ID_PATTERN.test(node.id)) issues.push(issue(`${path}.id`, "format", "Node ID is invalid"));
    else if (ids.has(node.id)) issues.push(issue(`${path}.id`, "duplicate", `Duplicate node ID: ${node.id}`));
    else ids.add(node.id);
    if (typeof node.type !== "string" || !ALLOWED_TYPES.has(node.type)) issues.push(issue(`${path}.type`, "enum", "Unknown node type"));
    for (const key of ["title", "text"] as const) {
      const value = node[key];
      if (value !== undefined && typeof value !== "string") issues.push(issue(`${path}.${key}`, "type", `${key} must be a string`));
      if (typeof value === "string" && value.length > MAX_TEXT_LENGTH) issues.push(issue(`${path}.${key}`, "length", `${key} is too long`));
    }
    if (node.data !== undefined && (!isRecord(node.data) || !isJsonValue(node.data))) issues.push(issue(`${path}.data`, "json", "Node data must be a bounded JSON-safe object"));
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) issues.push(issue(`${path}.children`, "type", "Children must be an array"));
      else node.children.forEach((child, index) => visit(child, `${path}.children[${index}]`, depth + 1));
    }
  }
  if (Array.isArray(input.nodes)) input.nodes.forEach((node, index) => visit(node, `$.nodes[${index}]`, 1));
  return { valid: issues.length === 0, issues, nodeCount, maxDepth };
}

export function assertValidArtifact(input: unknown): asserts input is FacetArtifact {
  const result = validateArtifact(input);
  if (!result.valid) throw new Error(result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("; "));
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= MAX_TEXT_LENGTH;
  if (value === null || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length <= 10_000 && value.every(item => isJsonValue(item, depth + 1));
  return isRecord(value) && Object.values(value).length <= 10_000 && Object.values(value).every(item => isJsonValue(item, depth + 1));
}
function issue(path: string, code: string, message: string): ValidationIssue { return { path, code, message } }
