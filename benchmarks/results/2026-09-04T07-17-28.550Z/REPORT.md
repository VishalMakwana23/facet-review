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

The selected candidate is provisional until human visual review of the rendered corpus confirms no material fidelity loss.
