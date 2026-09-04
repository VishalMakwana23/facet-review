# Protocol Selection Benchmark

- Corpus: facet-foundation-20 (20 artifacts)
- Selected candidate: **tuple**
- Gate: **PASS**
- Renderer compiled entry: 10743 bytes

| Candidate | o200k median reduction | cl100k median reduction | Equality/checks | Gate |
|---|---:|---:|---|---|
| tree | 85.15% | 85.13% | pass | PASS |
| graph | 84.41% | 84.43% | pass | PASS |
| tuple | 87.85% | 87.65% | pass | PASS |

The selected candidate is provisional until human visual review of the rendered corpus confirms no material fidelity loss.
