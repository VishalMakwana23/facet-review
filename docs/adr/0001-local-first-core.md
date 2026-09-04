# ADR-0001: Local-first core

- Status: Accepted
- Date: 2026-09-04
- Owners: product lead, protocol owner

## Context

Facet must provide a fast, private review workflow and remain usable without accounts or hosted infrastructure.

## Decision

The CLI, artifact store, renderer, annotations, decisions, patches, and export workflow run locally. Hosted and self-hosted collaboration use adapters over the same protocol and cannot become dependencies of local review.

## Consequences

The local daemon requires explicit lifecycle and security controls. Cloud-only collaboration features are deferred until the local value proposition is proven.

## Verification

The vertical-slice conformance test completes open → review → feedback → patch → export with networking disabled.
