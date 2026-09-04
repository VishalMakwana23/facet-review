import type { FacetArtifact, FacetNode, JsonValue } from "./types.js";
import { assertValidArtifact } from "./validation.js";

export type PatchOperation =
  | { op: "setText"; id: string; value: string }
  | { op: "spliceText"; id: string; start: number; deleteCount: number; value: string }
  | { op: "setData"; id: string; key: string; value: JsonValue }
  | { op: "insert"; parentId: string | null; index: number; node: FacetNode }
  | { op: "move"; id: string; parentId: string | null; index: number };

export interface PatchEnvelope { artifactId: string; baseRevision: number; nextRevision: number; operations: PatchOperation[] }
export type CompactPatchOperation =
  | ["t", string, string]
  | ["s", string, number, number, string]
  | ["d", string, string, JsonValue]
  | ["i", string | 0, number, FacetNode]
  | ["m", string, string | 0, number];
export type CompactPatchEnvelope = ["fp1", string, number, number, CompactPatchOperation[]];

export function applyPatch(source: FacetArtifact, patch: PatchEnvelope): FacetArtifact {
  assertValidArtifact(source);
  if (!Array.isArray(patch.operations) || patch.operations.length > 1000) throw new Error("Invalid patch operations");
  for (const operation of patch.operations) {
    if (!operation || !["setText", "spliceText", "setData", "insert", "move"].includes(operation.op)) throw new Error("Unknown patch operation");
    if (operation.op !== "insert" && typeof operation.id !== "string") throw new Error("Patch node ID must be a string");
    if ((operation.op === "setText" || operation.op === "spliceText") && typeof operation.value !== "string") throw new Error("Patch text must be a string");
    if (operation.op === "setData" && (typeof operation.key !== "string" || !operation.key || operation.key.length > 200 || operation.value === undefined)) throw new Error("Invalid data patch key or value");
    if ((operation.op === "move" || operation.op === "insert") && operation.parentId !== null && typeof operation.parentId !== "string") throw new Error("Patch parent must be a node ID or null");
  }
  if (patch.artifactId !== source.id) throw new Error("Patch artifact ID does not match");
  if (patch.baseRevision !== source.revision) throw new Error(`Patch expects revision ${patch.baseRevision}, received ${source.revision}`);
  if (patch.nextRevision !== patch.baseRevision + 1) throw new Error("Patch must advance exactly one revision");
  const artifact = structuredClone(source);
  for (const operation of patch.operations) applyOperation(artifact, operation);
  artifact.revision = patch.nextRevision;
  assertValidArtifact(artifact);
  return artifact;
}

export function collectNodeIds(artifact: FacetArtifact): string[] {
  const ids: string[] = [];
  const visit = (node: FacetNode): void => { ids.push(node.id); node.children?.forEach(visit) };
  artifact.nodes.forEach(visit);
  return ids;
}

export function encodeCompactPatch(patch: PatchEnvelope): CompactPatchEnvelope {
  const operations: CompactPatchOperation[] = patch.operations.map((operation) => {
    if (operation.op === "setText") return ["t", operation.id, operation.value];
    if (operation.op === "spliceText") return ["s", operation.id, operation.start, operation.deleteCount, operation.value];
    if (operation.op === "setData") return ["d", operation.id, operation.key, operation.value];
    if (operation.op === "insert") return ["i", operation.parentId ?? 0, operation.index, operation.node];
    return ["m", operation.id, operation.parentId ?? 0, operation.index];
  });
  return ["fp1", patch.artifactId, patch.baseRevision, patch.nextRevision, operations];
}

export function decodeCompactPatch(patch: CompactPatchEnvelope): PatchEnvelope {
  if (!Array.isArray(patch) || patch.length !== 5 || !Array.isArray(patch[4])) throw new Error("Invalid compact patch envelope");
  if (patch[0] !== "fp1") throw new Error("Unsupported compact patch version");
  const operations: PatchOperation[] = patch[4].map((operation) => {
    if (!Array.isArray(operation) || !["t", "s", "d", "i", "m"].includes(operation[0])) throw new Error("Unknown compact patch operation");
    const length = { t: 3, s: 5, d: 4, i: 4, m: 4 }[operation[0]];
    if (operation.length !== length) throw new Error("Invalid compact patch operation length");
    if (operation[0] === "t") return { op: "setText", id: operation[1], value: operation[2] };
    if (operation[0] === "s") return { op: "spliceText", id: operation[1], start: operation[2], deleteCount: operation[3], value: operation[4] };
    if (operation[0] === "d") return { op: "setData", id: operation[1], key: operation[2], value: operation[3] };
    if (operation[0] === "i") return { op: "insert", parentId: operation[1] === 0 ? null : operation[1], index: operation[2], node: operation[3] };
    return { op: "move", id: operation[1], parentId: operation[2] === 0 ? null : operation[2], index: operation[3] };
  });
  return { artifactId: patch[1], baseRevision: patch[2], nextRevision: patch[3], operations };
}

function applyOperation(artifact: FacetArtifact, operation: PatchOperation): void {
  if (operation.op === "setText") { requireNode(artifact.nodes, operation.id).text = operation.value; return }
  if (operation.op === "spliceText") {
    const node = requireNode(artifact.nodes, operation.id);
    const current = node.text ?? "";
    if (!Number.isInteger(operation.start) || !Number.isInteger(operation.deleteCount) || operation.start < 0 || operation.deleteCount < 0 || operation.start + operation.deleteCount > current.length) throw new Error("Invalid text splice range");
    node.text = current.slice(0, operation.start) + operation.value + current.slice(operation.start + operation.deleteCount);
    return;
  }
  if (operation.op === "setData") {
    const node = requireNode(artifact.nodes, operation.id);
    node.data = { ...(node.data ?? {}), [operation.key]: structuredClone(operation.value) };
    return;
  }
  if (operation.op === "insert") {
    const target = childrenOf(artifact, operation.parentId);
    if (findNode(artifact.nodes, operation.node.id)) throw new Error(`Cannot insert duplicate node ID: ${operation.node.id}`);
    assertIndex(target, operation.index); target.splice(operation.index, 0, structuredClone(operation.node)); return;
  }
  const removed = removeNode(artifact.nodes, operation.id);
  if (!removed) throw new Error(`Cannot move missing node: ${operation.id}`);
  const target = childrenOf(artifact, operation.parentId);
  assertIndex(target, operation.index); target.splice(operation.index, 0, removed);
}

function childrenOf(artifact: FacetArtifact, parentId: string | null): FacetNode[] {
  if (parentId === null) return artifact.nodes;
  const parent = requireNode(artifact.nodes, parentId); parent.children ??= []; return parent.children;
}
function findNode(nodes: FacetNode[], id: string): FacetNode | undefined {
  for (const node of nodes) { if (node.id === id) return node; const nested = node.children ? findNode(node.children, id) : undefined; if (nested) return nested }
  return undefined;
}
function requireNode(nodes: FacetNode[], id: string): FacetNode { const node = findNode(nodes, id); if (!node) throw new Error(`Missing node: ${id}`); return node }
function removeNode(nodes: FacetNode[], id: string): FacetNode | undefined {
  const index = nodes.findIndex((node) => node.id === id);
  if (index >= 0) return nodes.splice(index, 1)[0];
  for (const node of nodes) { const removed = node.children ? removeNode(node.children, id) : undefined; if (removed) return removed }
  return undefined;
}
function assertIndex(nodes: FacetNode[], index: number): void { if (!Number.isInteger(index) || index < 0 || index > nodes.length) throw new Error(`Invalid insertion index: ${index}`) }
