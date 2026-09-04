# Facet Review — local alpha candidate

This archive contains the Facet CLI, its standalone runtime, the Codex plugin source, and example artifacts. Node.js 22.14 or newer is required. No runtime npm dependencies, postinstall scripts, accounts, API keys, or telemetry are required.

This is an unpublished candidate. The package name is provisional. Do not assume a similarly named registry package is this project.

## Run the supplied archive

Use the exact absolute archive path supplied with the release:

```text
npm exec --offline --yes --package=/absolute/path/facet-review-0.1.0-alpha.1.tgz -- facet --help
```

For repeated use, install the supplied archive in a dedicated local folder with `npm install --ignore-scripts --no-audit --no-fund /absolute/path/archive.tgz`. Invoke the installed `facet` binary or `node node_modules/facet-review/runtime/cli/index.js`. On Windows, the npm executable shim is `node_modules/.bin/facet.cmd`.

```text
facet open artifact.facet.json
facet inbox SESSION_ID
facet export SESSION_ID new-export-directory
```

Keep the `open` process running during review. The URL binds only to loopback. `--no-browser` prints the URL without launching a browser; use `--data-dir DIRECTORY` consistently to isolate local sessions.

## Codex skill

The plugin source is in `plugin/`. Installing the npm runtime does not automatically install a Codex plugin or modify Codex settings. For repo-local experimentation, copy `plugin/skills/facet-review` to the target repository's `.agents/skills/facet-review` only if that path does not already exist. Start a new Codex task if the skill is not discovered. Ensure the runtime is on PATH, or tell the task its absolute `runtime/cli/index.js` path.

Reusable distribution should use the plugin packaging flow; marketplace registration is separate and not included in this local alpha. See [official skill discovery and plugin guidance](https://learn.chatgpt.com/docs/build-skills).

## Remove or roll back

Stop review processes before uninstalling. Run `npm uninstall facet-review` in the dedicated installation folder. Remove only the repo-local skill folder you installed, after checking for edits. No uninstall hook removes user data. Sessions remain in the directory selected by `--data-dir` or the default `.facet-review` under your user profile. Export anything important before choosing to delete a specific session.

To restore a previous release, reinstall its saved archive. Keep the store unchanged; rollback compatibility must be tested before adopting a future store schema. Static export bundles are read-only handoffs, not resumable store imports.

## Limits

This is a structured review skill, not a general website builder. Human acceptance and cross-platform release certification are pending. Benchmark savings are synthetic output-representation comparisons, not measured full-model or Lavish usage savings. Keep the original store for continued editing; exports cannot save changes.
