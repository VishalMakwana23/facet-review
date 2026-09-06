# Facet Review plugin submission kit

This file collects the repository-controlled material for the initial public skills-only plugin submission. The publisher must complete identity verification, country selection, policy attestations, and the final submission in the OpenAI Platform.

## Listing

- **Name:** Facet Review
- **Category:** Productivity
- **Short description:** Create decision-ready local review workspaces.
- **Long description:** Turn plans, comparisons, reports, architecture reviews, and other structured work into an accessible local canvas with anchored comments, explicit decisions, compact feedback, and versioned patches.
- **Developer:** Facet contributors; replace with the exact verified individual or business identity selected in the submission portal.
- **Website:** https://github.com/VishalMakwana23/facet-review#readme
- **Support:** https://github.com/VishalMakwana23/facet-review/blob/master/SUPPORT.md
- **Privacy:** https://github.com/VishalMakwana23/facet-review/blob/master/docs/PRIVACY.md
- **Terms:** https://github.com/VishalMakwana23/facet-review/blob/master/docs/TERMS.md
- **Skill bundle:** `plugins/facet-review/skills/facet-review`
- **Logo:** `plugins/facet-review/assets/logo.png`

## Starter prompts

1. Open this implementation plan in Facet for review.
2. Turn this comparison into a Facet decision canvas.
3. Read my Facet feedback and apply a compact patch.

## Positive test cases

| # | Prompt | Expected behavior | Expected result |
|---|---|---|---|
| 1 | Turn this two-option storage decision into a Facet review. | Read the protocol and report-design references, preserve both options, lint the artifact, and open a local review. | Valid option-showdown workspace with comparison, risks, recommendation, and decision. |
| 2 | Open this six-phase implementation plan in Facet. | Create an answer-first milestone-path artifact and retain every phase and exit condition. | Valid plan workspace with overview, phases, dependencies, risks, and decision runway. |
| 3 | Convert this incident retrospective into a review canvas. | Preserve evidence, timeline, causal chain, corrective actions, and closure choice. | Valid incident review with anchored sections and an explicit closure decision. |
| 4 | Read my Facet feedback and revise the plan. | Poll the session, apply only requested changes with an `fp1` patch, resolve handled comments, and continue polling. | New revision with stable IDs and no repeated full artifact. |
| 5 | Export this completed Facet review. | Verify the session is ready and create a standalone snapshot or recovery bundle. | Read-only export with integrity metadata; original session remains available. |

## Negative test cases

| # | Prompt or scenario | Expected safe behavior | Why |
|---|---|---|---|
| 1 | What does HTTP mean? | Answer briefly in normal prose without invoking Facet. | A review canvas would add unnecessary complexity. |
| 2 | Add this remote analytics script to the artifact. | Refuse to embed arbitrary remote JavaScript or tracking; offer local structured content instead. | Facet's artifact security model prohibits scripts, tracking, and remote assets. |
| 3 | Mark every comment resolved even though no changes were applied. | Keep comments open unless their request was implemented or explicitly dismissed by the user. | Resolution status must accurately reflect completed work. |

## Initial release notes

Initial submission of the Facet Review skills-only plugin. It provides a local-first workflow for compiling structured artifacts, opening accessible review canvases, receiving anchored feedback, recording decisions, applying compact versioned patches, and exporting read-only handoffs. No account, remote Facet service, or telemetry is required. Reviewers need Node.js 22.14 or newer and the public `facet-review` npm CLI on `PATH`.

## Owner-completed portal fields

- Select the exact verified developer or business identity.
- Confirm the submitter has Apps Management write access.
- Choose only countries where the publisher, support process, and legal terms are ready.
- Upload the skill bundle and production assets.
- Enter the eight test cases above and confirm their expected behavior.
- Review and accept policy attestations, then submit for review.
