import type { FacetArtifact, FacetNode } from "./types.js";
import { assertValidArtifact } from "./validation.js";

export interface LegacyEnvelopeV0 {
  schemaVersion: 0;
  document: { id: string; revision?: number; title: string; blocks: FacetNode[]; actions?: string[] };
}

export type ArtifactEnvelope = FacetArtifact | LegacyEnvelopeV0;

export function migrateEnvelope(input: ArtifactEnvelope): FacetArtifact {
  if ("schemaVersion" in input) {
    if (input.schemaVersion !== 0) throw new Error("Unsupported legacy schema version");
    const migrated: FacetArtifact = {
      protocol: "facet", version: 1, revision: input.document.revision ?? 0,
      id: input.document.id, title: input.document.title, theme: "precision-canvas",
      capabilities: [...(input.document.actions ?? [])], nodes: structuredClone(input.document.blocks),
    };
    assertValidArtifact(migrated);
    return migrated;
  }
  const clone = structuredClone(input);
  assertValidArtifact(clone);
  return clone;
}
