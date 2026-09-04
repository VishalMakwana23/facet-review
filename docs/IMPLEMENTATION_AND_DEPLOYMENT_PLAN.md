# Facet Implementation and Deployment Plan

## Outcome

Build Facet as a local-first, token-efficient review canvas that agents launch with one command, then grow it into an optional self-hosted and hosted collaboration product. “Best alternative to Lavish” means winning measurable workflows—not copying every feature.

## Product promise

1. **Compact generation:** agents emit a versioned semantic artifact instead of repeatedly authoring HTML/CSS.
2. **High-quality host UI:** the renderer owns responsive layout, accessibility, components, themes, and interaction behavior.
3. **Durable review:** comments, decisions, and patches survive revisions through stable semantic anchors.
4. **Local and private first:** the core workflow runs on loopback without an account or cloud dependency.
5. **Progressive distribution:** `npx` first, Docker and hosted sharing after the local product proves its value.

## Recommended architecture

```text
Agent / SDK / CLI
       |
       v
Versioned artifact protocol -----> validator + migrations
       |                                  |
       v                                  v
Local daemon <---- event/patch store ---- renderer host
       |                                  |
       +---- loopback session ----------> browser review UI
       |
       +---- export: self-contained HTML / JSON bundle
       |
       +---- optional adapter: hosted share or self-hosted server
```

### Packages

- `@facet-review/protocol`: types, JSON Schema, validation, migrations, capabilities.
- `@facet-review/renderer`: deterministic component renderer and theme tokens.
- `@facet-review/core`: events, annotations, decisions, patches, artifact store.
- `@facet-review/cli`: daemon lifecycle, local session, browser launch, export.
- `@facet-review/react`: optional authoring/embedding SDK after the protocol stabilizes.
- `apps/review`: Precision Canvas product UI.
- `apps/docs`: documentation, examples, playground, compatibility matrix.
- `services/share`: optional hosted control plane; never required by the local viewer.

Package and organization names are working candidates until registry and trademark checks are complete.

## Distribution ladder

### 1. Public local CLI — first release

```bash
npx @facet-review/cli open artifact.facet.json
```

The package starts a short-lived daemon on `127.0.0.1`, creates an unguessable session URL, opens the browser, and shuts down when the session ends. It bundles the viewer assets so the review experience works offline.

### 2. Published SDK and adapters

Agents and tools generate artifacts through the protocol package or stream patch events to the CLI. Add adapters only after the core conformance suite is stable.

### 3. Self-hosted distribution

Publish a versioned Docker image with read-only filesystem support, non-root execution, health checks, documented persistence mounts, and an upgrade/rollback guide.

### 4. Hosted sharing

Add optional authenticated, expiring, revocable share links. Store encrypted artifact bundles separately from identity and audit metadata. Keep the protocol and exported bundle portable so customers can leave the hosted service.

### 5. Ecosystem

Ship a permissioned component/exporter SDK and registry. No arbitrary third-party JavaScript in core artifacts.

## Phase-wise execution

### Phase 1 — Foundation and irreversible decisions

**Build:** repository workspace, ADR template, license decision, package naming check, contribution policy, threat model v0, benchmark methodology, and the Precision Canvas design system.

**Exit gate:** approved product boundary; package namespace available or replaced; security boundaries documented; 20 representative artifact briefs frozen.

### Phase 2 — Protocol and benchmark proof

**Build:** three schema candidates, tokenizer harness, HTML baselines, renderer spike, migration envelope, JSON Patch experiments, and conformance fixtures.

**Exit gate:** median output-token saving at least 60% with no material loss in content, interaction, accessibility, or visual fidelity. If it fails, change the protocol before building the app.

### Phase 3 — Local vertical slice

**Build:** CLI/daemon, artifact store, 12 core components, review shell, semantic node comments, typed decisions, feedback inbox, patch application, and crash recovery.

**Exit gate:** a real agent task completes open → review → feedback → patch → resolve entirely offline; annotations survive two revisions.

### Phase 4 — Product-quality MVP

**Build:** production Precision Canvas UI, Explore/Review/Decide modes, text/code anchors, semantic diff, responsive bottom sheet, command palette, keyboard workflow, export, CSP/sandbox, failure recovery, and accessibility testing.

**Exit gate:** median token reduction at least 70%; p10 at least 40%; zero critical accessibility findings; 10 pilot users complete a review without assistance; p95 local interaction under 100ms for ordinary artifacts.

**Sequencing decision, 2026-09-04:** the user requested completing skill implementation before human testing. Phase 4 engineering and automated evidence are recorded in `docs/phase4/VALIDATION.md`; the human usability gate is deferred, not passed. Phase 5 development may continue without waiting for pilot recruitment. This does not imply public-release readiness or measured savings against Lavish.

### Phase 5 — Public alpha distribution

**Build:** public npm package, `npx` zero-install flow, GitHub Actions tests/releases, trusted publishing, provenance, signed release notes, docs site, examples, opt-in diagnostics, compatibility matrix, and an uninstall/cleanup path.

**Exit gate:** clean-machine tests pass on supported Windows/macOS/Linux versions; install-to-first-artifact under three minutes; rollback tested; no long-lived npm token in CI.

### Phase 6 — Self-hosted and hosted beta

**Build:** hardened Docker image, authenticated projects, expiring/revocable shares, encryption and key-handling design, quotas, rate limits, audit events, backup/restore, and deployment reference architecture.

**Exit gate:** independent self-host install succeeds from docs; tenant isolation test passes; share revoke works immediately; backup restore and one-version rollback are demonstrated.

### Phase 7 — Collaboration, extension SDK, and general availability

**Build:** roles, review requests, threaded replies, notifications, optional presence, component/exporter manifests, permission review, registry moderation, performance and security audits, SLOs, incident/rollback playbooks, version policy, migration guarantees, support docs, and staged stable release.

**Exit gate:** two organizations complete multi-reviewer pilots; extension isolation tests pass; unknown components degrade to readable placeholders; all launch gates pass for two consecutive release candidates; no unresolved critical/high security issue; and migration from the previous supported version succeeds on the fixture corpus.

## Starting execution sequence

| Step | Deliverable | Owner |
|---|---|---|
| 1 | Freeze target users, use cases, non-goals, license default, and working namespace | Product/lead |
| 2 | Freeze 20 artifact briefs and equal-quality comparison rubric | Product + design |
| 3 | Capture HTML baselines and tokenizer settings | Protocol engineer |
| 4 | Draft tree, graph, and tuple schema candidates | Protocol engineer |
| 5 | Render seven core nodes and record fidelity/accessibility defects | UI engineer |
| 6 | Benchmark initial and two-patch token costs | Protocol engineer |
| 7 | Threat-model daemon, content, assets, export, and future plugins | Security owner |
| 8 | Choose protocol; publish RFC v0 and rejected alternatives | Team |
| 9 | Demo annotation → event → patch on one artifact | Full stack |
| 10 | Gate review: continue, revise protocol, or stop | Lead |

## Core component set

The first 12 components are: document section, callout, metric, card grid, comparison table, data table, code block, diff, diagram, timeline, checklist, and decision form. Every component requires loading, empty, overflow, invalid, unsupported, print/export, keyboard, and narrow-screen behavior.

## CI/CD and release channels

```text
pull request
  -> format + typecheck + unit + schema fuzz + accessibility
  -> golden render + browser matrix + security scan
  -> merge to main
  -> canary package
  -> release candidate on version tag
  -> npm trusted publish + provenance
  -> Docker multi-platform image
  -> docs + changelog + compatibility matrix
  -> staged stable promotion / rollback
```

- `canary`: every accepted main build for maintainers and dogfood.
- `alpha`: regular public preview; schema may change with migrations.
- `beta`: feature complete; compatibility promises begin.
- `latest`: stable only after GA gates.

## Security baseline

- Bind local mode only to loopback; use random session secrets and strict origin checks.
- Validate artifact size, depth, URLs, MIME types, and all schema fields before rendering.
- Strict CSP; no `eval`, inline untrusted scripts, remote runtime dependencies, or unrestricted custom HTML.
- Treat imports, plugins, exports, comments, and share links as separate trust boundaries.
- Redact secrets from diagnostics; telemetry is off by default and explicitly opt-in.
- Define retention, deletion, export, revoke, and audit behavior before hosted beta.
- Publish dependency update policy, security contact, supported versions, and disclosure process.

## Launch use cases

1. **Agent implementation plan:** review phases, annotate risks, approve scope, patch only changed nodes.
2. **Code review explainer:** inspect semantic diff, architecture diagram, and decisions without a repository UI dependency.
3. **Research report:** filter evidence, comment on claims, and export a durable offline copy.
4. **Design review:** compare responsive states, attach feedback to components, and resolve versioned threads.
5. **Operational decision:** rank options, capture approval, and preserve the decision with its evidence.

## Team model

A focused 3–4 person team is recommended. A solo implementation should preserve the same phase order and defer hosted collaboration until the local CLI has repeat users.

Minimum sustained ownership: protocol/backend, product UI, quality/security, and product/design. One person can cover multiple roles early, but security and release approvals need explicit owners.

## Global success metrics

- Median artifact output tokens: at least 70% below equal-quality HTML baseline.
- Typical revision payload: no more than 15% of full artifact tokens.
- First useful artifact: under three minutes from a clean supported machine.
- Review completion: at least 80% of pilot sessions finish without developer help.
- Repeat usage: at least 40% of activated pilot users open a second real artifact.
- Accessibility: no critical issues and all primary flows usable without a pointer.
- Reliability: no silent event loss; recoverable local sessions after an ordinary process crash.

## Decisions and recommended defaults

- **License:** Apache-2.0 for the local core and SDK; reassess an open-core boundary only before hosted beta.
- **Distribution:** public scoped npm CLI first; Docker second; hosted service third.
- **Compatibility:** schema-first with a sandboxed rich-block escape hatch.
- **Audience:** developer and agent workflows first, then design/research/operations after repeatability is proven.
- **Hosting:** provider-neutral interfaces. A Workers/static-assets plus object-storage deployment may be one reference implementation, not a protocol dependency.

## Definition of “ready to implement”

This plan is ready to begin **Phase 1 immediately**. Production feature work begins only after the foundation decisions and benchmark corpus are frozen. The product is not declared “better than Lavish” until the token, task-completion, accessibility, and repeat-usage gates are measured and published.
