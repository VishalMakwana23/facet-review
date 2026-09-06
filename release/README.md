# Facet Review

Facet Review turns structured agent output into an accessible, local-first review canvas with anchored comments, explicit decisions, and compact revision patches.

## Install

Node.js 22.14 or newer is required. The package has no runtime npm dependencies, postinstall scripts, accounts, API keys, or telemetry.

```bash
npm install --global facet-review@alpha
facet doctor
```

Run without a global installation:

```bash
npm exec --yes --package=facet-review@alpha -- facet --help
```

## Start a review

Facet accepts compact `fi1` intent files and canonical `.facet.json` artifacts.

```bash
facet lint decision.fi1.json
facet open decision.fi1.json
```

The `open` command creates a session, prints its ID and private loopback URL, and opens the browser. Keep that process running during review. Use `--no-browser` to print the URL without opening it, and reuse the same `--data-dir` for isolated session stores.

```bash
facet inbox SESSION_ID
facet digest SESSION_ID
facet poll SESSION_ID
facet resume SESSION_ID
facet export SESSION_ID new-export-directory
```

Use **Review actions → Export standalone HTML** for a human-readable snapshot. Machine-readable export bundles and static HTML exports are read-only handoffs; keep the original session store to continue editing.

## Use the Codex skill

The npm package includes the plugin source under `plugin/`, but npm does not automatically register it with Codex. For repository-local use, copy `plugin/skills/facet-review` from the installed package into `.agents/skills/facet-review` only when that destination does not already exist, then start a new Codex task.

```text
Use $facet-review to turn this implementation plan into a decision-ready review workspace.
```

Reusable discovery through the universal plugin directory is a separate publication path. See OpenAI's [Build skills](https://learn.chatgpt.com/docs/build-skills) and [Build plugins](https://learn.chatgpt.com/docs/build-plugins) documentation.

## Privacy and data

- Review servers bind to loopback.
- No diagnostic or review data is transmitted by the CLI.
- No arbitrary artifact JavaScript or remote assets are accepted.
- Session data stays in `--data-dir`, or `.facet-review` under the user profile by default.
- Uninstalling the package does not delete session data.

Read the [complete project guide](https://github.com/VishalMakwana23/facet-review#readme) and [security model](https://github.com/VishalMakwana23/facet-review/blob/master/SECURITY.md) before using sensitive material.

## Remove or roll back

Stop running review processes, then uninstall the CLI:

```bash
npm uninstall --global facet-review
```

Install a saved archive or an explicitly selected npm version to roll back. Back up the actual session store before any future schema-changing upgrade.

## Alpha limits

Facet renders structured review content, not arbitrary websites. Hands-on screen-reader acceptance, broader human preference testing, cross-version rollback, and universal plugin-directory publication remain pending. Synthetic representation benchmarks are not direct measurements of full-model or competing-tool token usage.
