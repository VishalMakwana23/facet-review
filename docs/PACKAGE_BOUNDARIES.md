# Package Boundaries

## Dependency direction

```text
apps/review ───────┐
packages/cli ──────┼──> packages/core ───> packages/protocol
services/share ────┘          │
                              └──> packages/renderer ───> packages/protocol

apps/docs may consume every public package for examples only.
```

## Rules

- `protocol` contains serializable contracts and pure validation/migration logic. It imports no UI, persistence, daemon, or hosting code.
- `renderer` turns validated nodes into accessible host-owned UI. It does not read files, start servers, or authenticate users.
- `core` owns domain events, annotations, decisions, patches, and storage interfaces. It does not depend on a concrete cloud provider.
- `cli` owns process, loopback session, filesystem import/export, and browser-launch behavior.
- `review-app` owns the Precision Canvas interaction shell and consumes public APIs only.
- `share-service` is optional and speaks the same versioned protocol. Local packages cannot import it.
- `docs-app` may demonstrate packages but cannot become a runtime dependency.

Boundary enforcement becomes an automated dependency-graph test when real cross-package imports are introduced.
