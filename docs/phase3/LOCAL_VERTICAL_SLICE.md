# Phase 3 Local Vertical Slice

## Outcome

Facet now completes a local open → review → feedback → patch → resolve workflow without an account, cloud service, CDN, or runtime package dependency beyond Node.js. The Codex plugin is a thin skill adapter over this runtime.

## Runtime path

```text
Codex skill
    ↓ writes ft1 / fp1 JSON
Facet CLI on 127.0.0.1
    ↓
Precision Canvas renderer ↔ local review API
    ↓
atomic snapshot + append-only event journal
```

The server binds only to `127.0.0.1`. Every session receives a cryptographically random 192-bit URL identifier. Responses disable caching and include a restrictive Content Security Policy; browser mutations reject foreign origins. Artifact content is escaped and cannot supply executable JavaScript.

## Commands

```text
facet open artifact.facet.json
facet resume <session-id>
facet inbox <session-id>
facet apply <session-id> revision.patch.json
facet resolve-comment <session-id> <comment-id>
facet resolve <session-id>
facet export <session-id> review-bundle
```

During repository development, replace `facet` with `node packages/cli/dist/index.js`. Use `--data-dir <path>` consistently when choosing a non-default store.

## Durable review model

- Comments anchor to stable semantic node IDs and record the artifact revision on which they were created.
- Decisions are accepted only for decision nodes and must match a declared option.
- Patches must target the session artifact and advance exactly one revision.
- A session cannot resolve while comments remain open.
- Exports contain the final artifact, feedback inbox, complete session snapshot, and a standalone HTML review.

Each mutation is appended to `events.ndjson` before the atomic snapshot is replaced. On restart, events newer than the snapshot sequence are replayed. This recovers a mutation interrupted between journal append and snapshot replacement while rejecting sequence gaps.

## Codex plugin

`plugins/facet-review` contains the valid Codex plugin manifest and the `facet-review` skill. The skill keeps discovery instructions concise and loads its wire-protocol reference only when it creates or patches an artifact. Public marketplace installation remains a Phase 5 distribution task; Phase 3 validates the local plugin package and runtime contract.

## Verification

- `scripts/test-phase3.mjs` simulates interrupted persistence and then exercises browser API creation, feedback, a typed decision, two revisions, comment resolution, session resolution, restart, and export.
- `benchmarks/scripts/phase3_visual_smoke.py` uses Chrome to test keyboard node selection, persisted comment creation/resolution, typed decisions, console errors, and desktop/mobile layouts.
- The skill and plugin pass the official local validators bundled with Codex.
