# Phase 5 — distribution engineering

Status: in progress. The first local release candidate and isolated-consumer tests are implemented and pushed as commit `dc63dd4`. All six jobs in [GitHub Actions run 33857030587](https://github.com/VishalMakwana23/facet-review/actions/runs/33857030587) passed on 2026-09-04. Nothing has been published to npm, installed globally, or added to a Codex marketplace. The renamed repository is `https://github.com/VishalMakwana23/facet-review.git`, repository ID `1356915242`, default branch `master`; initial commit `d4ba1a3` is preserved.

## Package architecture

Keep all seven development workspaces private. `release/package.json` describes the provisional `facet-review@0.1.0-alpha.1` single-package CLI distribution and also remains private. The packer copies a closed set of compiled runtime modules, rewrites internal workspace imports to relative modules, excludes source maps/development dependencies, and includes the plugin source and example.

This avoids requiring consumers to install four unpublished workspace packages. It is a CLI distribution, not a public TypeScript SDK. No lifecycle hooks, runtime npm dependencies, telemetry, or automatic Codex configuration changes are included.

```text
npm run release:pack
npm run test:release
```

Each pack creates a fresh `.release/candidate-*` directory with a `.tgz` archive and a SHA-256 manifest. `.release/latest.json` locates the latest candidate. A successful isolated install test writes `install-test.json` next to that archive. Build outputs are ignored by Git; source release scripts and documentation remain tracked candidates.

`test:release` uses a fresh temp consumer and npm cache outside this repository, with offline mode, no install scripts, no audit, and no registry dependencies. It exercises npm exec, local installation, help/diagnostics, loopback startup, a saved comment, uninstall, same-version reinstall, and export. Temporary test files are removed afterward; release archives remain.

## Installation and discovery

The archive's README contains exact local-install instructions. Installing npm software does not install a Codex plugin. For local authoring, Codex supports repo `.agents/skills`; reusable skill distribution should use plugins. The bundled skill is under `plugin/skills/facet-review`. Follow [official skill discovery and plugin guidance](https://learn.chatgpt.com/docs/build-skills).

The runtime must be on the agent's PATH or supplied by absolute path. There is no public registry installation command yet: do not install an unverified similarly named registry package. No personal or team marketplace entry has been created during this phase.

## Automation and compatibility

`.github/workflows/ci.yml` is a read-only validation/candidate-build workflow. It pins external actions to commit SHAs and tests Node 22.14/24 on Ubuntu, Windows, and macOS. It uploads candidate archives/checksums/results only, not session data. It has no npm credentials, OIDC permission, publish step, or production environment access.

| Target | Evidence |
|---|---|
| Windows, Node 24 | Remote CI passed; local Node 24.12 isolated install also passed |
| Windows, Node 22.14 | Remote CI passed |
| Ubuntu, Node 22.14/24 | Both remote CI jobs passed |
| macOS, Node 22.14/24 | Both remote CI jobs passed |
| Registry-based npx install | Not available; candidate is unpublished |
| Cross-version rollback | Pending a previous released version; same-version reinstall is tested |
| Codex marketplace install | Source plugin validates; real marketplace installation pending |

Do not equate configured CI with passing remote runs. The under-three-minute result measures local archive installation through first artifact, not a network download or first-time Node installation.

## Publication requirements

The GitHub repository is confirmed above and recorded in the candidate manifest. A previous browser-based terminal login verified `vishalmakwanaa`, but `npm whoami` returned `E401` when rechecked on 2026-09-06. The most recent package lookup returned 404 for `facet-review`, which does not reserve the name or guarantee first-publish acceptance. The user authorized continuing Phase 5. Registry authentication and final account-security review remain owner tasks before publication. Then:

1. Establish repository ownership, package-name rights, license/release review, and public metadata. Keep provenance repository URLs exact.
2. Run the entire CI matrix on that repository and inspect the packed file list. Validate actual Codex installation from its intended distribution channel.
3. Configure an npm trusted publisher tied to the approved repository/workflow and protected release environment. Use short-lived OIDC, not a long-lived npm token. Confirm which publish action the owner enabled: npm currently distinguishes direct and staged publication. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
4. Prepare versioned release notes, provenance, and signed release evidence. The current SHA-256 manifest detects changed bytes; it is **not** a signature or proof of publisher identity.
5. Publish only with explicit owner authorization and an approved alpha tag. Do not change `private:true` as an incidental build step.

Remaining Phase 5 deliverables: public/marketplace installation, a version-to-version rollback rehearsal, signed release evidence, and the documentation website and its deployment. Draft alpha notes are in `release/NOTES-0.1.0-alpha.1.md`. Human acceptance remains deferred per the user's Phase 4 decision, not marked passed.

## Diagnostics, cleanup and rollback

`facet doctor` prints only platform/runtime/protocol compatibility to the local terminal, with no paths, session contents, account identifiers, or network transmission. Sharing its output is a user choice. No background telemetry exists.

Uninstall the npm package only from the installation scope used. Keep the session store and remove any manually copied skill only after inspecting its exact path and changes. Reinstall a saved archive to recover the same release. Before a future schema-changing upgrade, export a handoff and back up the actual session store; read-only exports are not a substitute for a resumable store backup.
