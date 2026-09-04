# Protocol Candidate RFC v0

## Shared semantic model

All candidates encode the same validated artifact:

- Stable artifact ID and monotonically increasing revision.
- Protocol version and theme capability.
- Explicit interaction capabilities.
- Stable semantic node IDs.
- Allowlisted node types with title, text, JSON-safe data, and children.

## Candidate A — Descriptive tree

Nested objects use readable field names. This is easiest for humans and tool authors but repeats keys for every node.

**Strengths:** readable, easy to debug, natural generation order.  
**Risks:** highest token use; moving deep nodes produces larger patches.

## Candidate B — Normalized graph

Root IDs and a node dictionary separate identity from structure. Child relationships use IDs.

**Strengths:** explicit identity, natural cross-references, efficient targeted changes.  
**Risks:** more bookkeeping, cycle/missing-reference validation, less natural for streamed generation.

## Candidate C — Compact tuple tree

The envelope and nodes use positional arrays; node types are indexes into a versioned registry.

**Strengths:** smallest payload and still streams in document order.  
**Risks:** less readable, strong dependence on schema tooling, registry changes require disciplined migration.

## Selection rule

The runner compares all candidates across the frozen 20-artifact corpus with two revisions. A candidate is selectable only when it round-trips to the canonical artifact, renders byte-identically through the same host renderer, preserves IDs through both patches, migrates deterministically, has no critical structural accessibility issue, achieves at least 60% median token reduction, and has no corpus category with negative median savings.

The selected candidate and actual measurements are recorded in `docs/protocol/SELECTION.md` after the benchmark run.
