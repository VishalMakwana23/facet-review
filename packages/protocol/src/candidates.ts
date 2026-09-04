import { NODE_TYPES, type FacetArtifact, type FacetNode, type JsonValue, type NodeData, type NodeType } from "./types.js";
import { assertValidArtifact } from "./validation.js";

export interface TreeCandidate {
  format: "facet-tree";
  schemaVersion: 1;
  artifactId: string;
  revision: number;
  title: string;
  theme: "precision-canvas";
  capabilities: string[];
  nodes: FacetNode[];
}

interface GraphNode { type: NodeType; title?: string; text?: string; data?: NodeData; children?: string[] }
export interface GraphCandidate { f: "fg1"; a: string; r: number; t: string; h: "p"; c: string[]; roots: string[]; nodes: Record<string, GraphNode> }
export type CompactNode = [string, number, string | 0, string | 0, NodeData | 0, CompactNode[]?];
export type TupleCandidate = ["ft1", string, number, string, "p", string[], CompactNode[]];
export type ProtocolCandidate = TreeCandidate | GraphCandidate | TupleCandidate;

export function encodeTree(artifact: FacetArtifact): TreeCandidate {
  assertValidArtifact(artifact);
  return { format: "facet-tree", schemaVersion: 1, artifactId: artifact.id, revision: artifact.revision, title: artifact.title, theme: artifact.theme, capabilities: [...artifact.capabilities], nodes: structuredClone(artifact.nodes) };
}

export function decodeTree(candidate: TreeCandidate): FacetArtifact {
  const artifact: FacetArtifact = { protocol: "facet", version: 1, revision: candidate.revision, id: candidate.artifactId, title: candidate.title, theme: candidate.theme, capabilities: [...candidate.capabilities], nodes: structuredClone(candidate.nodes) };
  assertValidArtifact(artifact); return artifact;
}

export function encodeGraph(artifact: FacetArtifact): GraphCandidate {
  assertValidArtifact(artifact);
  const nodes: Record<string, GraphNode> = {};
  const flatten = (node: FacetNode): string => {
    const graphNode: GraphNode = { type: node.type };
    if (node.title !== undefined) graphNode.title = node.title;
    if (node.text !== undefined) graphNode.text = node.text;
    if (node.data !== undefined) graphNode.data = structuredClone(node.data);
    if (node.children?.length) graphNode.children = node.children.map(flatten);
    nodes[node.id] = graphNode; return node.id;
  };
  return { f: "fg1", a: artifact.id, r: artifact.revision, t: artifact.title, h: "p", c: [...artifact.capabilities], roots: artifact.nodes.map(flatten), nodes };
}

export function decodeGraph(candidate: GraphCandidate): FacetArtifact {
  const seen = new Set<string>();
  const expand = (id: string): FacetNode => {
    if (seen.has(id)) throw new Error(`Graph cycle or duplicate reference: ${id}`);
    seen.add(id);
    const source = candidate.nodes[id]; if (!source) throw new Error(`Missing graph node: ${id}`);
    const node: FacetNode = { id, type: source.type };
    if (source.title !== undefined) node.title = source.title;
    if (source.text !== undefined) node.text = source.text;
    if (source.data !== undefined) node.data = structuredClone(source.data);
    if (source.children?.length) node.children = source.children.map(expand);
    return node;
  };
  const artifact: FacetArtifact = { protocol: "facet", version: 1, revision: candidate.r, id: candidate.a, title: candidate.t, theme: "precision-canvas", capabilities: [...candidate.c], nodes: candidate.roots.map(expand) };
  assertValidArtifact(artifact); return artifact;
}

export function encodeTuple(artifact: FacetArtifact): TupleCandidate {
  assertValidArtifact(artifact);
  const pack = (node: FacetNode): CompactNode => {
    const tuple: CompactNode = [node.id, NODE_TYPES.indexOf(node.type), node.title ?? 0, node.text ?? 0, node.data ? structuredClone(node.data) : 0];
    if (node.children?.length) tuple.push(node.children.map(pack));
    return tuple;
  };
  return ["ft1", artifact.id, artifact.revision, artifact.title, "p", [...artifact.capabilities], artifact.nodes.map(pack)];
}

export function decodeTuple(candidate: TupleCandidate): FacetArtifact {
  const unpack = (tuple: CompactNode): FacetNode => {
    const [id, typeIndex, title, text, data, children] = tuple;
    const type = NODE_TYPES[typeIndex]; if (!type) throw new Error(`Unknown compact node type index: ${typeIndex}`);
    const node: FacetNode = { id, type };
    if (title !== 0) node.title = title;
    if (text !== 0) node.text = text;
    if (data !== 0) node.data = structuredClone(data);
    if (children?.length) node.children = children.map(unpack);
    return node;
  };
  const artifact: FacetArtifact = { protocol: "facet", version: 1, revision: candidate[2], id: candidate[1], title: candidate[3], theme: "precision-canvas", capabilities: [...candidate[5]], nodes: candidate[6].map(unpack) };
  assertValidArtifact(artifact); return artifact;
}

export function decodeCandidate(candidate: ProtocolCandidate): FacetArtifact {
  if (Array.isArray(candidate)) return decodeTuple(candidate);
  if ("format" in candidate) return decodeTree(candidate);
  if ("f" in candidate) return decodeGraph(candidate);
  throw new Error("Unknown protocol candidate");
}

export function canonicalJson(value: JsonValue | FacetArtifact | ProtocolCandidate): string { return JSON.stringify(sortValue(value)) }
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortValue(child)]));
  return value;
}
