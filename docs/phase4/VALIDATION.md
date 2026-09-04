# Phase 4 engineering validation

Status: engineering implemented and automated checks passed; human acceptance deferred by the user on 2026-09-04. This is not a completed 10-person pilot or a public-release certification. Phase 5 engineering may proceed under that explicit sequencing decision.

## Delivered

- Explore/Review/Decide action isolation; decision confirmation; disabled controls in read-only/resolved views.
- Exact text selections and complete code-line anchors. New stale-revision comments/decisions are rejected; existing stale/orphaned feedback retains its quote and revision.
- Before/after node-content and parent/index details for revisions, alongside compact operation summaries.
- Command palette, keyboard node selection, focus restoration, responsive feedback sheet with inert background and contained keyboard focus, reduced motion, code copy/wrap controls, and accessible table labels/chart values.
- Session-scoped draft recovery and failure feedback. Polling does not reload over a draft or silently erase a save failure. Ambiguous saves require inbox inspection before retrying.
- Snapshot-consistent exports with all comments, decisions, revision details, read-only HTML, and SHA-256 manifest. Existing destinations are refused. The manifest is written last so interrupted exports are detectable.
- Loopback Host/origin checks, bounded JSON requests, hash-based script CSP, no artifact JavaScript execution, strict anchor/patch validation, bounded JSON data, and script-safe escaping.
- Cross-process transaction coordination, including Windows delete-pending lock contention; fail-closed malformed/truncated journals; backup-first tail repair; no automatic lock stealing.
- Progressive skill reference for review lifecycle and recovery; the discovery entrypoint stays concise.

## Reproducible evidence

Run `npm test` for build, foundation, protocol, Phase 3/4 regression tests, and strict checks across all seven workspaces. Passed on 2026-09-04. The Phase 3 suite also passed separately after the Windows contention correction.

Browser prerequisites in this development environment: repository `.venv` with Playwright, installed Google Chrome, and local `axe-core` npm dependency. No CDN is used.

```text
npm run benchmark:protocol
.venv/Scripts/python.exe benchmarks/scripts/phase3_visual_smoke.py
.venv/Scripts/python.exe benchmarks/scripts/phase4_mvp_smoke.py
.venv/Scripts/python.exe benchmarks/scripts/phase4_corpus_smoke.py
```

The corpus browser test reads the artifacts produced by the latest protocol benchmark. Tests write new timestamped result folders, preserving failed and successful runs.

| Evidence | Result |
|---|---|
| `benchmarks/results/2026-09-04T08-42-16.801Z/report.json` | 20 artifacts; normalized self-contained HTML once + modeled incremental revisions: 95.55% median, 95.31% p10 reduction (`o200k_base`) |
| Same report, cached-host sensitivity | 55.44% median, 48.63% p10; does **not** meet a generalized 70% saving against reusable HTML hosts |
| Same report, compact revisions | 11.70% median, 15.85% maximum of full Facet payload across 40 revisions |
| `benchmarks/results/phase4-2026-09-04T08-42-19.301323+00-00/result.json` | Live comment/decision/selection/diff/export/draft/error flows passed; zero axe violations and console errors; p95 next-frame mode response 8.4 ms |
| `benchmarks/results/phase4-corpus-2026-09-04T08-42-39.716568+00-00/result.json` | All 20 examples passed desktop/mobile axe, no external requests or runtime errors, every per-artifact p95 below 100 ms |
| `benchmarks/results/phase3-2026-09-04T08-33-44.959234+00-00/result.json` | Existing create/decide/resolve browser workflow passed after adding confirmation |

Both latest browser runs include the final save-error indicator persistence fix. Screenshots accompany the live browser evidence and were visually inspected.

## Scope and remaining acceptance

Token results compare synthetic deterministic representations, not actual Lavish sessions or full model usage (input, reasoning, retries, and skill instructions are not measured). Host-reuse sensitivity must accompany any saving claim. Shared renderer code is shipped by the host; it is not included in Facet agent output.

Latency measures click-to-next-animation-frame on ordinary 4–6-node corpus artifacts on this Windows/Chrome machine without throttling. It is not disk-commit latency or a large-document guarantee. Responsive checks cover 375, 768, 812, 1024, and 1440px. The 720×450 test is a reduced-layout-width proxy, not actual browser 200% zoom.

Human usability, actual browser zoom, screen-reader testing, and visual acceptance remain manual validation work. Cross-platform clean-machine testing belongs to Phase 5. Power-loss/fsync and network-filesystem durability are not certified. Store snapshots/journals are trusted local files, not authenticated archives. A missing export manifest means incomplete export; retry into a new directory. Export bundles are read-only handoffs, not resumable store imports.

The MVP is a structured review renderer, not a general website builder: diagrams use text/list representations, image nodes show explicit text alternatives, and local checklist/filter controls are not saved review decisions. No arbitrary scripts, public sharing service, marketplace installation, or npm publication is enabled by this phase.

The user requested finishing skill implementation before human testing. Follow [MANUAL_TEST.md](MANUAL_TEST.md) when ready; do not fabricate testers or mark that gate passed from automated checks.
