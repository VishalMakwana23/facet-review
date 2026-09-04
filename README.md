# Facet

Facet is a local-first, token-efficient review canvas for human-agent collaboration. Agents emit compact, versioned semantic artifacts; the Facet host owns rendering, accessibility, responsive behavior, comments, decisions, and incremental patches.

## Current status

Phases 1–3 are complete. Phase 4 engineering now includes mode isolation, exact selection anchors, semantic revision details, draft recovery, responsive keyboard-accessible review, secure read-only exports, and expanded automated verification. Human acceptance is deferred by the user until skill implementation is ready; it has not passed. See [Phase 4 evidence and limits](docs/phase4/VALIDATION.md). Public packaging and distribution remain Phase 5 work.

## Workspace map

| Workspace | Responsibility |
|---|---|
| `packages/protocol` | Artifact types, schema, validation, migrations, capabilities |
| `packages/renderer` | Deterministic rendering and design tokens |
| `packages/core` | Events, annotations, decisions, patches, persistence contracts |
| `packages/cli` | Local daemon lifecycle, browser sessions, import and export |
| `apps/review` | Precision Canvas review application |
| `apps/docs` | Documentation, examples, playground, compatibility matrix |
| `services/share` | Optional hosted collaboration adapter |

## Foundation verification

```bash
npm install
npm test
```

The test suite checks the foundation, workspace types, protocol round trips, migrations, deterministic revision behavior, and conformance fixtures. Run `npm run benchmark:protocol` to create a timestamped token and fidelity result bundle.

## Product boundaries

- Local mode remains usable without an account or cloud service.
- Hosted sharing is an optional adapter, not a protocol dependency.
- Artifacts are schema-first; arbitrary third-party JavaScript is not accepted.
- Package workspaces remain private until the npm scope is owned and the release pipeline is ready.

Read [the implementation plan](docs/IMPLEMENTATION_AND_DEPLOYMENT_PLAN.md), [protocol selection record](docs/protocol/SELECTION.md), [architecture decisions](docs/DECISIONS.md), and [security model](SECURITY.md) before changing these boundaries.

## Local vertical slice

```bash
npm run build
node packages/cli/dist/index.js open examples/phase3-demo.facet.json
```

The command prints a private loopback session URL and opens the review UI. See [the Phase 3 workflow](docs/phase3/LOCAL_VERTICAL_SLICE.md) for feedback, patch, resume, resolve, and export commands.

## Local release candidate

Run `npm run release:pack` followed by `npm run test:release` to build and test an isolated, dependency-free CLI archive. `.release/latest.json` identifies the archive and checksum. No registry publication or Codex installation occurs automatically. See [Phase 5 distribution status](docs/phase5/DISTRIBUTION.md) for installation, CI, cleanup, and remaining release gates.
