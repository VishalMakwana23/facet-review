# Facet Review 0.1.0-alpha.1 — release candidate notes

Status: locally verified, unpublished candidate. These notes are not signed release evidence. The npm release manifest remains private until registry authentication and final publication checks succeed.

## Included

- Dependency-free CLI runtime, Codex skill/plugin source, and a working example.
- Compact `ft1` artifacts and incremental `fp1` revisions.
- Explore, Review, and Decide modes; exact selection anchors; preserved stale feedback; before/after revision details.
- Local comments and confirmed decisions, draft recovery, journal recovery, and read-only exports with checksum manifests.
- Keyboard-accessible responsive review UI and local-only diagnostics with no telemetry or install hooks.
- Answer-first report overviews, on-demand navigation, milestone-path layouts, system-flow diagrams, grouped risk cards, explanatory risk matrices, and prominent decision runways.
- A reusable report-design quality contract for plans, comparisons, reports, architecture reviews, and decision briefs.

## Verified candidate

Commit `dc63dd4c6369fad3e61753a8ca229487a431e412` passed all six jobs in [the platform matrix](https://github.com/VishalMakwana23/facet-review/actions/runs/33857030587): Windows, macOS, and Ubuntu using Node 22.14 and Node 24. Each job runs source tests, builds the standalone archive, and tests an isolated offline installation, npm exec, saved feedback, uninstall/reinstall preservation, and export.

The tested minimum Node version is 22.14. The supplied archive needs no runtime npm dependencies. The current design upgrade passed the complete local source suite plus browser checks at 375, 768, 1024, and 1440 CSS pixels with no detected axe violations, console errors, or horizontal page overflow. Candidate archives/checksums are workflow artifacts, not public npm releases. A checksum proves byte integrity, not publisher identity.

## Installation and data

Until publication, follow the archive's README using its exact local path. Do not assume a registry package with this name is ours. npm runtime installation does not automatically register the Codex plugin.

Session data remains outside the installed package. Uninstalling the runtime does not delete reviews. Static HTML exports cannot resume a session; keep the original store for continued work.

## Known limits

Blind human preference testing and hands-on screen-reader acceptance remain pending. Real marketplace installation, public registry installation, provenance/signature verification, and rollback between different released versions are not yet demonstrated. The host renders structured review content, not arbitrary websites or artifact JavaScript. Token savings are synthetic representation measurements, not a direct Lavish or full-model usage benchmark.
