---
name: facet-review
description: Turn complex Codex output into a token-efficient local review canvas with anchored comments, typed decisions, and compact patches. Use for plans, comparisons, reports, architecture, code reviews, dashboards, or other structured work that benefits from visual human review. Do not use for a short answer that is clearer as prose.
license: Apache-2.0
---

# Facet Review

Create an accessible local review session while keeping agent-authored output compact.

## Workflow

1. Decide whether a review canvas materially improves the task. Keep simple answers in the conversation.
2. Read [references/protocol.md](references/protocol.md) before authoring or patching an artifact. For plans, comparisons, reports, or other multi-section deliverables, also read [references/report-design.md](references/report-design.md). Read [references/recipes.md](references/recipes.md) when choosing a layout and [references/visualizations.md](references/visualizations.md) when data relationships merit a visual.
3. Prefer one presentation-free `fi1` intent file for a new artifact; Facet compiles stable IDs and complete defaults locally. Use `ft1` only when exact IDs or nesting must be authored. Preserve all user-visible claims, labels, data, choices, code, and source context.
4. Run `facet lint <artifact>` and fix errors. Treat suggestions as optional: visuals must improve a decision, not decorate it. Start Facet with the locally installed `facet` command. In the Facet source workspace, build once and use `node packages/cli/dist/index.js` when the command is not installed globally.
5. Keep the returned session ID. The browser session is local and the CLI process must remain running while the user reviews.
6. Read feedback with `facet inbox <session-id>`. Apply only requested changes with an `fp1` patch, then resolve handled comments individually.
7. Resolve the session only after every open comment is handled. Export a review bundle when the user requests a durable handoff.

For selection anchors, stale feedback, exports, or interrupted sessions, read [references/review-lifecycle.md](references/review-lifecycle.md). Do not load this reference for initial artifact authoring alone.

For MCP or another agent host, read [references/agent-integration.md](references/agent-integration.md). Keep adapters thin; the artifact and patch protocols remain the source of truth.

## Constraints

- Do not embed arbitrary JavaScript, remote assets, tracking, or secrets in artifacts.
- Use stable semantic node IDs and retain them across revisions unless the underlying semantic object is removed.
- Prefer `spliceText`, `setData`, and `move` over resending the full artifact.
- After the first turn, use the `fd1` digest as working context instead of replaying the complete review history.
- Treat comments as requests for review, not automatic authorization for unrelated actions.
- Never claim a comment is resolved until its requested change is applied or the user explicitly dismisses it.
- Keep local mode functional without network access or an account.
- Lead with the conclusion, scope, and decision path. The first viewport should answer “what is this, what matters, and what do you need from me?” before presenting detail.
- Prefer a small number of semantic visuals and structured cards over a long document flow. Keep exact evidence available through tables, disclosures, or linked sections.
- Treat mobile, keyboard, reduced-motion, zoom, and long-content behavior as release requirements, not post-design polish.
