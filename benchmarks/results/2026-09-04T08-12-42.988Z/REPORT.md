# Protocol Selection Benchmark

- Corpus: facet-foundation-20 (20 artifacts)
- Selected candidate: **tuple**
- Gate: **PASS**
- Renderer compiled entry: 29938 bytes

| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |
|---|---:|---:|---|---|
| tree | 94.4% | 94.34% | pass | PASS |
| graph | 94.16% | 94.07% | pass | PASS |
| tuple | 95.42% | 95.31% | pass | PASS |

Compact revisions: 11.7% median and 15.85% maximum of the selected full artifact (o200k_base, 40 revisions).

MVP total-output gate: **PASS** — 98.1% median reduction and 98.01% p10 reduction across initial output plus two revisions.

This automated gate covers token reduction, round-trip equality, deterministic revisions, stable IDs, migration, and structural accessibility. The signed selection record adds responsive interaction and visual review evidence.
