# Phase 5 — distribution engineering

Status: public alpha available. `facet-review@0.1.0-alpha.1` was published to npm on 2026-09-06 and verified through a fresh public-registry `npm exec` run. The first local release candidate and isolated-consumer tests were implemented in commit `dc63dd4`; all six jobs in [GitHub Actions run 33857030587](https://github.com/VishalMakwana23/facet-review/actions/runs/33857030587) passed on 2026-09-04. Universal Codex plugin-directory publication remains pending. The repository is `https://github.com/VishalMakwana23/facet-review.git`, repository ID `1356915242`, default branch `master`; initial commit `d4ba1a3` is preserved.

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

The runtime must be on the agent's PATH or supplied by absolute path. The verified npm package is [facet-review](https://www.npmjs.com/package/facet-review) and the expected repository metadata points to `VishalMakwana23/facet-review`. No personal, team, or universal plugin-directory entry has been created during this phase.

## Automation and compatibility

`.github/workflows/ci.yml` is a read-only validation/candidate-build workflow. It pins external actions to commit SHAs and tests Node 22.14/24 on Ubuntu, Windows, and macOS. It uploads candidate archives/checksums/results only, not session data. It has no npm credentials, OIDC permission, publish step, or production environment access.

| Target | Evidence |
|---|---|
| Windows, Node 24 | Remote CI passed; local Node 24.12 isolated install also passed |
| Windows, Node 22.14 | Remote CI passed |
| Ubuntu, Node 22.14/24 | Both remote CI jobs passed |
| macOS, Node 22.14/24 | Both remote CI jobs passed |
| Registry-based npm exec | Passed on Windows with `facet-review@alpha` after publication |
| Cross-version rollback | Pending a previous released version; same-version reinstall is tested |
| Codex marketplace install | Source plugin validates; real marketplace installation pending |

Do not equate configured CI with passing remote runs. The under-three-minute result measures local archive installation through first artifact, not a network download or first-time Node installation.

## Publication evidence and next-release requirements

The package was published by the authenticated npm account `vishalmakwanaa` after npm's browser-based second-factor approval. Registry metadata resolves `alpha` and `latest` to `0.1.0-alpha.1`; the public package exposes the `facet` binary and the expected GitHub repository URL. The published tarball contained 35 allowlisted files, was 65,179 bytes, and matched local SHA-256 `b8091d984c786fdf16c40844060d5990cdcde2426c6662b842c6b35180a4526b` before upload.

For subsequent releases:

1. Establish repository ownership, package-name rights, license/release review, and public metadata. Keep provenance repository URLs exact.
2. Run the entire CI matrix on that repository and inspect the packed file list. Validate actual Codex installation from its intended distribution channel.
3. Configure an npm trusted publisher tied to the approved repository/workflow and protected release environment. Use short-lived OIDC, not a long-lived npm token. Confirm which publish action the owner enabled: npm currently distinguishes direct and staged publication. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
4. Prepare versioned release notes, provenance, and signed release evidence. The current SHA-256 manifest detects changed bytes; it is **not** a signature or proof of publisher identity.
5. Publish only with explicit owner authorization and an approved release tag. Never make the private development workspaces publishable as an incidental build step.

Remaining Phase 5 deliverables: universal plugin-directory installation, a version-to-version rollback rehearsal, signed release evidence, and the documentation website and its deployment. Alpha notes are in `release/NOTES-0.1.0-alpha.1.md`. Human acceptance remains deferred per the user's Phase 4 decision, not marked passed.

## Diagnostics, cleanup and rollback

`facet doctor` prints only platform/runtime/protocol compatibility to the local terminal, with no paths, session contents, account identifiers, or network transmission. Sharing its output is a user choice. No background telemetry exists.

Uninstall the npm package only from the installation scope used. Keep the session store and remove any manually copied skill only after inspecting its exact path and changes. Reinstall a saved archive to recover the same release. Before a future schema-changing upgrade, export a handoff and back up the actual session store; read-only exports are not a substitute for a resumable store backup.
