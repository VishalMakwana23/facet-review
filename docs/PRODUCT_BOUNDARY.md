# Product Boundary v1

## Primary user

A developer or technical product owner collaborating with an AI agent on plans, architecture, code reviews, research, migrations, and operational decisions. They need a faster way to inspect, annotate, decide, and return structured feedback than reading long chat output or regenerating a full HTML artifact.

## Core job

> Turn compact agent output into a polished, accessible review surface, then return durable human feedback as small semantic events and patches.

## Required first-product workflow

1. An agent or CLI creates a versioned Facet artifact.
2. A local process validates and stores it.
3. The browser opens an unguessable loopback review session.
4. The user explores content, anchors comments, and completes structured decisions.
5. The agent reads durable feedback and applies a version-aware patch.
6. The user reviews the semantic diff, resolves feedback, and exports a portable artifact.

## Must win

- Material token reduction compared with equal-quality, self-contained HTML.
- Consistent modern UI without repeated styling instructions.
- Stable comments and decisions across ordinary revisions.
- Account-free, offline-capable local operation.
- Accessible keyboard and narrow-screen review flows.
- Portable artifacts and exports that do not lock users to hosted infrastructure.

## Explicit non-goals before public proof

- General-purpose site generation or arbitrary page building.
- Real-time multiplayer document editing.
- Enterprise administration, SSO, billing, or marketplace economics.
- Native mobile clients.
- Unrestricted artifact or plugin JavaScript.
- Replacing source-code hosting, issue trackers, or full design tools.

## Product principles

1. **Intent over markup:** the agent expresses semantic content; the host owns pixels.
2. **Patch over regenerate:** revisions address stable IDs instead of replacing the document.
3. **Local over required cloud:** hosting extends the product but never defines the core.
4. **Review over presentation:** the dominant surface supports comprehension and decisions.
5. **Measured over claimed:** token, quality, accessibility, latency, and repeat-use claims require reproducible evidence.

## Boundary-change rule

Changing the primary user, local-first invariant, schema-first approach, or arbitrary-code policy requires a new ADR and an updated benchmark corpus version.
