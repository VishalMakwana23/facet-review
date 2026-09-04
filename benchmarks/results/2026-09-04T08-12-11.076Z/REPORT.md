# Protocol Selection Benchmark

- Corpus: facet-foundation-20 (20 artifacts)
- Selected candidate: **none**
- Gate: **FAIL**
- Renderer compiled entry: 29938 bytes

| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |
|---|---:|---:|---|---|
| tree | 94.4% | 94.34% | fail | FAIL |
| graph | 94.16% | 94.07% | fail | FAIL |
| tuple | 95.42% | 95.31% | fail | FAIL |

This automated gate covers token reduction, round-trip equality, deterministic revisions, stable IDs, migration, and structural accessibility. The signed selection record adds responsive interaction and visual review evidence.
