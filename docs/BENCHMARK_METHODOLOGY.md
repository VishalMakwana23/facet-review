# Token-Efficiency Benchmark Methodology v1

## Question

Can a Facet semantic artifact and two realistic revisions use materially fewer agent-output tokens than a self-contained HTML implementation while preserving the same information, interactions, accessibility, and visual quality?

## Frozen corpus

`benchmarks/corpus/manifest.json` defines 20 briefs across plans, reports, diagrams, tables, code, diffs, decisions, and operational workflows. The corpus is frozen for the protocol-selection benchmark. Changes require a new corpus version and must not replace prior results.

## Compared implementations

For every brief, produce:

1. **HTML baseline:** self-contained semantic HTML, CSS, JavaScript, and inline SVG needed for the required experience.
2. **Facet candidate:** one initial artifact plus any theme/capability declaration required by the candidate protocol.
3. **Revision 1:** a realistic content or data update.
4. **Revision 2:** a structural or decision-state update.

Do not count the Facet renderer bundle as agent output. Record renderer bundle size and load performance separately because it is shipped once by the product host.

## Equality rules

An entry is comparable only when both implementations contain:

- The same claims, labels, data, code, and decision options.
- The same required interactions and feedback states.
- Semantic headings, landmarks, controls, and keyboard operation.
- Equivalent mobile behavior and readable export.
- Equivalent diagram text alternatives and table semantics.
- No external runtime dependency hidden in one implementation.

If an implementation fails equality review, its token result is excluded until corrected—not scored as a saving.

## Measurements

Record per artifact and revision:

- UTF-8 bytes and non-whitespace characters.
- Tokens using each configured tokenizer, with package and tokenizer versions recorded.
- Initial-generation tokens.
- Revision tokens and revision/full ratio.
- Renderer defects by critical, major, and minor severity.
- Automated accessibility violations plus manual keyboard-flow result.
- Interactive-ready time on the fixed benchmark machine.
- Export success and offline-runtime success.

## Gates

### Protocol-selection gate

- Median initial-output reduction: at least 60%.
- No corpus category with negative median savings.
- No critical fidelity or accessibility defect.
- Both revisions apply deterministically and preserve stable node identity.

### MVP claim gate

- Median total reduction across initial output plus two revisions: at least 70%.
- 10th-percentile reduction: at least 40%.
- Typical revision payload: no more than 15% of full Facet artifact tokens.
- Zero critical accessibility findings and all primary flows keyboard-operable.

## Reproducibility

### Phase 4 baseline refinement

The current runner counts one self-contained HTML host plus two modeled incremental DOM updates, rather than regenerating the entire viewer for each revision. It also reports a cached-host sensitivity using only the artifact article plus those updates. The latter is essential when comparing against a product that also ships a reusable viewer: the primary 70% gate must not be advertised as a result against such products.

Raw emitted HTML and normalized measurements are both retained. Normalization removes leading indentation only in the authored runtime script; it does not change code/prose content. It is not an optimal-minifier comparison. Renderer size includes both the rendering entrypoint and browser runtime modules. The synthetic corpus is not a direct Lavish measurement, and output-token counts do not include model input, reasoning, retries, or skill-loading cost.

Measured UI response now includes the next animation frame; it is not merely synchronous handler execution and is not disk-commit latency.

Every result bundle must include the git commit, operating system, Node version, tokenizer names and versions, renderer version, raw inputs, raw outputs, measurements, screenshots, accessibility output, and reviewer decisions. The benchmark runner must never overwrite a prior result bundle.

## Anti-gaming rules

- Do not remove content, controls, states, responsive behavior, or accessibility semantics to reduce tokens.
- Do not count a long hidden system prompt for HTML but omit an equivalent prompt for Facet.
- Do not compare minified Facet against formatted HTML; report normalized and actual transmitted forms.
- Do not tune the protocol only to one artifact category.
- Publish failed cases and outliers with the successful aggregate.
