# Review recipe routing

Read this only when choosing the structure of a new review.

- **Option showdown** — two or more approaches, tradeoffs, a recommendation, and a decision. Use a comparison node, option-prefixed benefit/risk titles, then recommendation and decision nodes.
- **Milestone path** — a phased plan or rollout. Use context, timeline, dependencies, risks, checkpoints, and a final approval decision.
- **Technical inspection** — architecture or code review. Use summary, diagram or dependency map, evidence/code/diff, risks, and disposition decision.
- **Evidence dashboard** — metrics or observations that support an action. Use a short conclusion before charts and tables; end with an explicit action or decision.
- **Reading flow** — reports without a single comparison. Order summary, evidence, implications, risks, recommendation.

Run `facet lint` after authoring. The deterministic classifier reports its chosen recipe. Do not add nodes merely to satisfy a recipe; each section must change understanding or action.
