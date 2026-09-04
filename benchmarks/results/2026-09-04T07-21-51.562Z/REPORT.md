# Protocol Selection Benchmark

- Corpus: facet-foundation-20 (20 artifacts)
- Selected candidate: **tuple**
- Gate: **PASS**
- Renderer compiled entry: 11224 bytes

| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |
|---|---:|---:|---|---|
| tree | 85.98% | 85.9% | pass | PASS |
| graph | 85.3% | 85.27% | pass | PASS |
| tuple | 88.54% | 88.34% | pass | PASS |

Compact revisions: 11.7% median and 15.85% maximum of the selected full artifact (o200k_base, 40 revisions).

This automated gate covers token reduction, round-trip equality, deterministic revisions, stable IDs, migration, and structural accessibility. The signed selection record adds responsive interaction and visual review evidence.
