---
name: facet-review
description: Turn complex Codex output into a token-efficient local review canvas with anchored comments, typed decisions, and compact patches. Use for plans, comparisons, reports, architecture, code reviews, dashboards, or other structured work that benefits from visual human review. Do not use for a short answer that is clearer as prose.
license: Apache-2.0
---

# Facet Review

Create an accessible local review session while keeping agent-authored output compact.

## Workflow

1. Decide whether a review canvas materially improves the task. Keep simple answers in the conversation.
2. Read [references/protocol.md](references/protocol.md) before authoring or patching an artifact.
3. Write an `ft1` artifact JSON file inside the active workspace. Preserve all user-visible claims, labels, data, choices, code, and source context.
4. Start Facet with the locally installed `facet` command. In the Facet source workspace, build once and use `node packages/cli/dist/index.js` when the command is not installed globally.
5. Keep the returned session ID. The browser session is local and the CLI process must remain running while the user reviews.
6. Read feedback with `facet inbox <session-id>`. Apply only requested changes with an `fp1` patch, then resolve handled comments individually.
7. Resolve the session only after every open comment is handled. Export a review bundle when the user requests a durable handoff.

For selection anchors, stale feedback, exports, or interrupted sessions, read [references/review-lifecycle.md](references/review-lifecycle.md). Do not load this reference for initial artifact authoring alone.

## Constraints

- Do not embed arbitrary JavaScript, remote assets, tracking, or secrets in artifacts.
- Use stable semantic node IDs and retain them across revisions unless the underlying semantic object is removed.
- Prefer `spliceText`, `setData`, and `move` over resending the full artifact.
- Treat comments as requests for review, not automatic authorization for unrelated actions.
- Never claim a comment is resolved until its requested change is applied or the user explicitly dismisses it.
- Keep local mode functional without network access or an account.
