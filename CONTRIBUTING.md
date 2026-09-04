# Contributing to Facet

## Before contributing

1. Read `docs/DECISIONS.md`, `SECURITY.md`, and the package boundary README for the area you will change.
2. Open an issue or design note before changing the artifact protocol, public events, trust boundaries, or package ownership.
3. Keep the local workflow functional without hosted services.

## Development workflow

```bash
npm install
npm test
```

- Create focused changes with tests or verification fixtures.
- Do not weaken strict TypeScript settings to make a change compile.
- Do not add runtime network dependencies to the core viewer without an accepted architecture decision.
- Any new artifact component must define validation, accessible semantics, narrow-screen behavior, export behavior, and unsupported-version fallback.
- Schema changes require migration notes and conformance fixtures.

## Commit and review expectations

- Explain the user-visible behavior and risk in the pull request.
- Include benchmark evidence for token, rendering, bundle, or latency claims.
- Include threat-model changes for new input, storage, plugin, sharing, or execution boundaries.
- Preserve unrelated work and never commit credentials, private artifacts, or production data.

## License

By contributing, you agree that your contributions are licensed under Apache-2.0.
