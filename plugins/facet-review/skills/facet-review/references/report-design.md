# Report design quality contract

Read this for plans, comparisons, reports, architecture reviews, and decision briefs.

## First viewport

Make the opening screen useful before the reader scrolls. It should expose:

- the outcome or proposed direction;
- the boundary of the work;
- the few counts or states that change how the report is read;
- the next review action or decision gate.

Do not begin with background prose, a decorative hero, or a dense table. Titles identify; summaries orient; actions move the review forward.

## Information shape

Use the selected recipe to create a deliberate reading path:

- **Milestone path:** goal → architecture → phases → dependencies → acceptance → risks → recommendation → approval.
- **Option showdown:** decision → concrete options → aligned evidence → costs and failure modes → recommendation → choice.
- **Technical inspection:** verdict → system boundary → evidence → issues by severity → fixes → disposition.
- **Evidence dashboard:** conclusion → key measures → trends or relationships → anomalies → action.
- **Reading flow:** executive answer → supporting sections → implications → risks → recommendation.

Use headings that answer reader questions. Keep corresponding items aligned. Group repeated objects as cards only when each card represents a real phase, option, risk, or module.

## Visual explanation

Every visual must answer one named question. Lead with a plain-language conclusion, then the visual, then exact values or supporting detail.

- Direct-label important marks; avoid legend decoding.
- Add scales, units, direction, and named zones where applicable.
- Never rely on color alone.
- Prefer a short system overview followed by inspectable module detail over one dense architecture graph.
- Preserve an accessible semantic fallback for charts and diagrams.

## Decision runway

End with a visibly distinct recommendation and decision surface. State what will happen after each choice. Keep rationale, confidence, owner, and due date optional but available. A reader should never have to hunt for the requested response.

## Progressive disclosure

Keep primary conclusions visible and move raw evidence, module inventories, revision detail, and token accounting into disclosures. Navigation and feedback tools should be available on demand without permanently shrinking the artifact.

## Release gate

Before opening the review:

1. Run `facet lint` and resolve errors.
2. Verify the report at 375, 768, 1024, and 1440 CSS pixels.
3. Confirm no horizontal page overflow, obscured focus, unlabeled controls, or color-only meaning.
4. Exercise section navigation, review mode, a saved comment, decision mode, and the accessible data fallback.
5. Check long titles, long labels, empty optional data, reduced motion, and 200% zoom.

Do not claim “world-class,” “accessible,” or “production-ready” from appearance alone. Report the checks actually performed and keep remaining human acceptance explicit.
