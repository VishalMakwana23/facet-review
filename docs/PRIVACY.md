# Facet Review privacy notice

Effective date: 2026-09-06

Facet Review is a local-first command-line tool and Codex skill. The default runtime does not require an account, API key, or hosted Facet service.

## Data handled locally

Facet processes the artifacts, comments, decisions, revision history, and exports that a user provides during a review. By default, this information is stored on the user's device in the directory selected with `--data-dir`, or in `.facet-review` under the user profile.

The local review server binds to the loopback interface. Facet does not intentionally transmit review content, diagnostic output, identifiers, or usage telemetry to the Facet contributors.

## Third-party services

Users may obtain Facet through npm, GitHub, Codex, or the ChatGPT plugin directory. Those services process account, download, and operational data under their own privacy policies. Facet does not control those services.

If a user deliberately shares an export, commits an artifact, or connects Facet to another system, that destination's policies and the user's configuration govern the transferred data.

## Retention and deletion

Facet contributors do not operate a default cloud store for local review sessions. Users control their local retention. Uninstalling the npm package does not delete session data; users must remove the selected session directory separately after preserving any required exports.

## Security

Facet artifacts do not accept arbitrary third-party JavaScript or remote assets. Standalone exports use a restrictive content security policy. See the project [security documentation](../SECURITY.md) for the current threat model and reporting process.

## Changes and contact

Material changes to this notice will be recorded in the public repository. For privacy questions, open a private security report or a repository issue using the channels described in [SECURITY.md](../SECURITY.md).
