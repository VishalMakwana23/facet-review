# ADR-0006: Compact tuple as the v1 wire format

- Status: Accepted
- Date: 2026-09-04

## Context

Facet needs an agent-authored representation that is substantially smaller than self-contained HTML without changing the canonical artifact, rendered result, interaction model, accessibility structure, or revision semantics. Phase 2 compared a descriptive tree, a normalized graph, and a compact tuple over the frozen 20-artifact corpus.

## Decision

Use the versioned `ft1` compact tuple as the v1 agent wire format. Decode it immediately into the readable `FacetArtifact` canonical model. Use the `fp1` compact patch envelope for revisions. Keep the descriptive tree available as an authoring/debug representation and the graph candidate as experimental, but do not make either the default transport.

The tuple positions and node-type indexes are protocol surface. Changes require a new format marker and migration path; existing indexes must not be reordered.

## Evidence

Benchmark run `2026-09-04T07-21-51.562Z` selected the tuple with 88.54% median `o200k_base` reduction and 88.34% median `cl100k_base` reduction against self-contained HTML. Its lowest category median was 87.02%. Forty compact revisions measured 11.7% of the full tuple artifact at the median. Round-trip equality, rendered byte equality, stable IDs, deterministic patches, legacy migration, structural accessibility, representative browser interactions, and mobile overflow checks passed.

## Consequences

- Agents send less repeated layout and styling syntax.
- Humans and application code work with the canonical named-object model after decoding, avoiding tuple-index logic outside the protocol package.
- Schema, fixture, and migration compatibility become release gates.
- The measured saving is a protocol-selection result, not yet a production latency or total-cost claim.
