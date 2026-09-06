# Facet

Facet is a local-first, token-efficient review canvas for human-agent collaboration. Agents emit compact, versioned semantic artifacts; the Facet host owns rendering, accessibility, responsive behavior, comments, decisions, and incremental patches.

## Current status

The beyond-Lavish implementation is complete through the local product phases: modular visual foundation, Option Showdown and Milestone Path recipes, answer-first report overviews, layered system flows, explanatory data views, threaded review intelligence, compact intent and feedback formats, honest token receipts, and nine no-regeneration review lenses. The competitive harness is implemented and fails closed; a superiority claim remains ineligible until five equal-content captures and blind human validation are complete. See [implementation status](docs/beyond-lavish/IMPLEMENTATION_STATUS.md). Public npm and marketplace distribution are not yet live.

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

The test suite checks the foundation, workspace types, protocol round trips, deterministic recipes, threaded review, intent compilation, patch optimization, workspace lenses, migrations, and conformance fixtures. Run `npm run benchmark:protocol` for protocol evidence and `npm run benchmark:competitive` for the fail-closed Facet-versus-Lavish report.

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
