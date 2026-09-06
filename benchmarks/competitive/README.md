# Facet versus Lavish benchmark

This benchmark is separate from the frozen protocol-selection corpus. It compares real captured workflows and must not reuse the synthetic HTML baseline as a Lavish result.

## Capture contract

Run each manifest case in two fresh chats with the same model and reasoning effort. Change only the requested skill. Preserve the initial output, revision output, failures, retries, elapsed time, screenshots, and any available turn-usage record.

Each case stores `capture.json` under `captures/<case-id>/`. A capture is complete only when both variants include initial and revision evidence, content and interaction parity have been reviewed, and usage values are either recorded from an authoritative source or explicitly unavailable.

The scorer reports three different quantities:

- final representation tokens;
- emitted initial-plus-revision tokens;
- total turn usage, only when supplied by an authoritative capture.

These quantities are never substituted for one another. Estimated text tokens are not described as billing or account usage.

Run `npm run benchmark:competitive` after building the workspaces. Results are timestamped and never overwrite previous evidence.

Each completed capture must also record `evaluation.unassistedTasksCompleted`, `evaluation.unassistedTasksTotal`, and `evaluation.criticalAccessibilityViolations`. The scorer fails closed across all six gates: coverage, blind visual preference, unassisted task completion, emitted workflow tokens, Facet patch ratio, and critical accessibility findings.
