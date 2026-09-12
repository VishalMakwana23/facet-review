# Phase 5 — distribution engineering

Status: public alpha available. `facet-review@0.1.0-alpha.5` was published to npm on 2026-09-06 by the trusted GitHub Actions workflow and verified through a fresh public-registry `npm exec` run. The repository marketplace and `facet-review@personal` installation were also verified. On 2026-09-12, the public repository was verified with the skills.sh CLI, which discovered the bundled `facet-review` skill. The first local release candidate and isolated-consumer tests were implemented in commit `dc63dd4`; all six jobs in [GitHub Actions run 33857030587](https://github.com/VishalMakwana23/facet-review/actions/runs/33857030587) passed on 2026-09-04. The provenance-backed [alpha.5 publish run](https://github.com/VishalMakwana23/facet-review/actions/runs/34049917251) passed on 2026-09-06. Universal Codex plugin-directory review remains pending. The repository is `https://github.com/VishalMakwana23/facet-review.git`, repository ID `1356915242`, default branch `master`; initial commit `d4ba1a3` is preserved.

## Package architecture

Keep all seven development workspaces private. `release/package.json` describes the public `facet-review` single-package CLI distribution. The packer copies a closed set of compiled runtime modules, rewrites internal workspace imports to relative modules, excludes source maps/development dependencies, and includes the plugin source and examples.

This avoids requiring consumers to install four unpublished workspace packages. It is a CLI distribution, not a public TypeScript SDK. No lifecycle hooks, runtime npm dependencies, telemetry, or automatic Codex configuration changes are included.

```text
npm run release:pack
npm run test:release
```

Each pack creates a fresh `.release/candidate-*` directory with a `.tgz` archive and a SHA-256 manifest. `.release/latest.json` locates the latest candidate. A successful isolated install test writes `install-test.json` next to that archive. Build outputs are ignored by Git; source release scripts and documentation remain tracked candidates.

`test:release` uses a fresh temp consumer and npm cache outside this repository, with offline mode, no install scripts, no audit, and no registry dependencies. It exercises npm exec, local installation, help/diagnostics, loopback startup, a saved comment, uninstall, same-version reinstall, and export. Temporary test files are removed afterward; release archives remain.

## Installation and discovery

Install the public alpha with `npm install --global facet-review@alpha`, or run it without a permanent installation using `npm exec --yes --package=facet-review@alpha -- facet --help`. Installing npm software does not install a Codex plugin. For local authoring, Codex supports repo `.agents/skills`; reusable skill distribution should use plugins. The bundled skill is under `plugin/skills/facet-review`. Follow [official skill discovery and plugin guidance](https://learn.chatgpt.com/docs/build-skills).

The runtime must be on the agent's PATH or supplied by absolute path. The verified npm package is [facet-review](https://www.npmjs.com/package/facet-review) and the expected repository metadata points to `VishalMakwana23/facet-review`. The repository now exposes a `personal` marketplace with `facet-review@personal`; universal plugin-directory review remains separate.

The public skill is also discoverable through the skills.sh CLI:

```text
npx skills add https://github.com/VishalMakwana23/facet-review --skill facet-review
```

skills.sh has no separate publish command: it indexes public GitHub skills through CLI discovery and anonymous install telemetry. This route installs the skill instructions, not the npm runtime.

## Automation and compatibility

`.github/workflows/ci.yml` is a read-only validation/candidate-build workflow. It pins external actions to commit SHAs and tests Node 22.14/24 on Ubuntu, Windows, and macOS. It uploads candidate archives/checksums/results only, not session data. It has no npm credentials, OIDC permission, publish step, or production environment access.

| Target | Evidence |
|---|---|
| Windows, Node 24 | Remote CI passed; local Node 24.12 isolated install also passed |
| Windows, Node 22.14 | Remote CI passed |
| Ubuntu, Node 22.14/24 | Both remote CI jobs passed |
| macOS, Node 22.14/24 | Both remote CI jobs passed |
| Registry-based npm exec | Passed on Windows with `facet-review@alpha` after publication |
| Cross-version rollback | Alpha.1 → alpha.5 → alpha.1 preserved the open comment, resumable session, and standalone export |
| Codex marketplace install | `facet-review@personal` installed and enabled from the GitHub repository marketplace |
| skills.sh discovery | Public GitHub source resolved and the CLI found `facet-review` |

Do not equate configured CI with passing remote runs. The under-three-minute result measures local archive installation through first artifact, not a network download or first-time Node installation.

## Publication evidence and next-release requirements

Alpha.5 was published by the npm trusted publisher tied to `VishalMakwana23/facet-review`, workflow `publish.yml`, and environment `npm`. Registry metadata exposes the `facet` binary, the expected GitHub repository URL, a 39-file archive, SHA-512 integrity `sha512-iyJsejvTwpA8T9So3yqdMtHeDTmNcR+NyjAyCAUuPxoRSZXrK+eWvLT3tqgL/1fxlozGSSda0qdHZaulD/GFnw==`, and a SLSA v1 provenance attestation.

For subsequent releases:

1. Establish repository ownership, package-name rights, license/release review, and public metadata. Keep provenance repository URLs exact.
2. Run the entire CI matrix on that repository and inspect the packed file list. Validate actual Codex installation from its intended distribution channel.
3. Configure an npm trusted publisher tied to the approved repository/workflow and protected release environment. Use short-lived OIDC, not a long-lived npm token. Confirm which publish action the owner enabled: npm currently distinguishes direct and staged publication. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
4. Prepare versioned release notes, provenance, and signed release evidence. The current SHA-256 manifest detects changed bytes; it is **not** a signature or proof of publisher identity.
5. Publish only with explicit owner authorization and an approved release tag. Never make the private development workspaces publishable as an incidental build step.

Remaining Phase 5 deliverables: universal plugin-directory review and the documentation website and its deployment. Alpha notes are in `release/NOTES-0.1.0-alpha.5.md`. Human acceptance remains deferred per the user's Phase 4 decision, not marked passed.

## Diagnostics, cleanup and rollback

`facet doctor` prints only platform/runtime/protocol compatibility to the local terminal, with no paths, session contents, account identifiers, or network transmission. Sharing its output is a user choice. No background telemetry exists.

Uninstall the npm package only from the installation scope used. Keep the session store and remove any manually copied skill only after inspecting its exact path and changes. Reinstall a saved archive to recover the same release. Before a future schema-changing upgrade, export a handoff and back up the actual session store; read-only exports are not a substitute for a resumable store backup.
