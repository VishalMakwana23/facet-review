# Protocol Selection Record

## Outcome

Phase 2 selects the compact tuple candidate (`ft1`) as Facet's v1 agent wire format and the compact patch envelope (`fp1`) for revisions. The protocol-selection gate passes.

## Compared candidates

| Candidate | Role | o200k median reduction | cl100k median reduction | Decision |
|---|---|---:|---:|---|
| Descriptive tree | Readable reference and debugging format | 85.98% | 85.90% | Retain, not default |
| Normalized graph | Experimental normalized transport | 85.30% | 85.27% | Do not select |
| Compact tuple | Agent wire format | 88.54% | 88.34% | Selected |

All three candidates passed the 60% protocol gate, category gate, round-trip equality, byte-identical rendering, stable-ID, deterministic-patch, legacy-migration, and structural-accessibility checks. The tuple wins because it has the highest median saving and the lowest transmitted syntax overhead. Its weakest category still saved 87.02% at the median.

## Revision result

Across 40 realistic revision payloads, `fp1` patches were 11.70% of the selected full artifact at the median using `o200k_base`; the observed maximum was 15.85%. This passes the methodology's typical-revision target of no more than 15%, while the maximum remains an optimization case to track during MVP benchmarking.

## Fidelity review

The same canonical artifact is rendered before and after every candidate round trip. Rendered HTML was byte-identical for all 20 corpus entries. Playwright checks on product plan, architecture, comparison, code review, and dashboard artifacts passed mode switching, node selection, capability feedback, console-error, and horizontal-overflow checks. The product-plan mobile view passed at 375 × 812. Visual inspection found no material content, hierarchy, control, or responsive-layout loss.

## Reproducible evidence

- Raw benchmark: `benchmarks/results/2026-09-04T07-21-51.562Z/report.json`
- Human-readable benchmark: `benchmarks/results/2026-09-04T07-21-51.562Z/REPORT.md`
- Browser checks: `benchmarks/results/2026-09-04T07-21-51.562Z/visual-smoke.json`
- Screenshots: `benchmarks/results/2026-09-04T07-21-51.562Z/screenshots/`
- Selected JSON Schema: `packages/protocol/schema/facet-tuple-v1.schema.json`
- Conformance fixtures: `packages/protocol/fixtures/`

Reproduce with `npm test`, `npm run benchmark:protocol`, then `.venv\\Scripts\\python.exe benchmarks\\scripts\\visual_smoke.py` on this Windows development machine. The Python environment is local tooling and is not part of the product runtime.

## Claim boundary

The HTML baseline includes the semantic HTML, CSS, and JavaScript an agent would otherwise author for each standalone artifact. The Facet renderer is recorded separately because the host ships it once. Therefore, 88.54% is evidence for reduced agent-output tokens under this benchmark—not yet evidence for production latency, model billing, renderer download cost, or every possible artifact. Those broader claims remain gated in Phase 4.
