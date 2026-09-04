# Protocol Selection Benchmark

- Corpus: facet-foundation-20 (20 artifacts)
- Selected candidate: **tuple**
- Gate: **PASS**
- Renderer compiled entry: 33858 bytes

| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |
|---|---:|---:|---|---|
| tree | 95.62% | 95.6% | pass | PASS |
| graph | 95.44% | 95.41% | pass | PASS |
| tuple | 96.42% | 96.37% | pass | PASS |

Compact revisions: 11.7% median and 15.85% maximum of the selected full artifact (o200k_base, 40 revisions).

MVP total-output gate: **PASS** — 95.59% median reduction and 95.36% p10 reduction across initial output plus two revisions.

Cached HTML host sensitivity: 55.33% median and 48.63% p10. This removes shared HTML chrome from output costs; do not generalize the main gate to reusable-host competitors.

Synthetic corpus. Full HTML host emitted once plus modeled incremental DOM updates. Not a direct Lavish comparison; excludes reasoning, input and retry tokens. Cached-host sensitivity is reported separately.

Structural checks are not a substitute for browser accessibility or human usability tests.
