# ADR-0002: Schema-first artifacts

- Status: Accepted
- Date: 2026-09-04
- Owners: protocol owner, UI owner

## Context

Repeated full HTML/CSS generation is token-heavy and makes visual, responsive, and accessibility quality inconsistent.

## Decision

Agents produce versioned semantic artifact nodes and incremental patch operations. The Facet renderer owns layout and interaction. A future rich-block escape hatch must be sandboxed, capability-declared, and readable as a fallback.

## Consequences

Novel layouts are constrained by the component registry, but output becomes compact, deterministic, migratable, and accessible by construction.

## Verification

The benchmark compares equal-content semantic artifacts and self-contained HTML baselines. Protocol work continues only after the token and fidelity gate passes.
