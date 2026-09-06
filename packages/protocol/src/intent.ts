import { NODE_TYPES, type FacetArtifact, type JsonValue, type NodeData, type NodeType } from "./types.js";
import { assertValidArtifact } from "./validation.js";
import { encodeTuple } from "./candidates.js";

export type IntentNode = [NodeType | number, string, string?, NodeData?];
export type CompactIntent = ["fi1", string, string, string[], IntentNode[]];

/** Compile presentation-free intent into a complete, stable Facet artifact. */
export function compileIntent(intent: CompactIntent): FacetArtifact {
  if (!Array.isArray(intent) || intent.length !== 5 || intent[0] !== "fi1" || !Array.isArray(intent[3]) || !Array.isArray(intent[4])) throw new Error("Invalid compact intent");
  const used = new Set<string>();
  const nodes = intent[4].map((source, index) => {
    if (!Array.isArray(source) || source.length < 2 || source.length > 4) throw new Error(`Invalid intent node at index ${index}`);
    const type = typeof source[0] === "number" ? NODE_TYPES[source[0]] : source[0];
    if (!type || !NODE_TYPES.includes(type)) throw new Error(`Unknown intent node type at index ${index}`);
    if (typeof source[1] !== "string" || !source[1].trim()) throw new Error(`Intent node title is required at index ${index}`);
    const base = stableSlug(source[1]);
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    const node: FacetArtifact["nodes"][number] = { id, type, title: source[1].trim() };
    if (source[2] !== undefined) node.text = source[2];
    if (source[3] !== undefined) node.data = structuredClone(source[3]);
    return node;
  });
  const artifact: FacetArtifact = { protocol: "facet", version: 1, revision: 0, id: intent[1], title: intent[2], theme: "precision-canvas", capabilities: [...intent[3]], nodes };
  assertValidArtifact(artifact);
  return artifact;
}

export interface RepresentationReceipt {
  basis: "estimated-from-characters";
  canonicalCharacters: number;
  compactCharacters: number;
  estimatedCanonicalTokens: number;
  estimatedCompactTokens: number;
  estimatedReductionPercent: number;
}

export function representationReceipt(artifact: FacetArtifact): RepresentationReceipt {
  assertValidArtifact(artifact);
  const canonicalCharacters = JSON.stringify(artifact).length;
  const compactCharacters = JSON.stringify(encodeTuple(artifact)).length;
  return {
    basis: "estimated-from-characters",
    canonicalCharacters,
    compactCharacters,
    estimatedCanonicalTokens: estimateTokens(canonicalCharacters),
    estimatedCompactTokens: estimateTokens(compactCharacters),
    estimatedReductionPercent: canonicalCharacters ? Number(((1 - compactCharacters / canonicalCharacters) * 100).toFixed(1)) : 0,
  };
}

function stableSlug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "section";
}
function estimateTokens(characters: number): number { return Math.ceil(characters / 4) }
