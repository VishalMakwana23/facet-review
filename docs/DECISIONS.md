# Architecture Decisions

| ID | Decision | Status |
|---|---|---|
| ADR-0001 | Local-first core with optional hosting adapters | Accepted |
| ADR-0002 | Schema-first artifacts with a sandboxed rich-block escape hatch | Accepted |
| ADR-0003 | TypeScript npm-workspaces monorepo | Accepted |
| ADR-0004 | Apache-2.0 for the local core and SDK | Accepted |
| ADR-0005 | `facet-review` / `@facet-review/*` remain provisional names | Provisional |
| ADR-0006 | `ft1` compact tuple is the v1 agent wire format | Accepted |

## Non-goals for the first product proof

- Real-time multiplayer editing
- Enterprise SSO, billing, or organization administration
- Native mobile applications
- Arbitrary third-party JavaScript components
- Cloud-required local review
- A general-purpose website builder

## Naming evidence

On 2026-09-04, npm registry lookups returned `E404` for `facet-review` and the proposed `@facet-review/protocol`, `renderer`, `core`, and `cli` packages. This indicates no readable public package at that moment; it does not reserve the names, prove trademark availability, or prove that the npm scope can be created. All workspaces stay `private: true` until ownership and legal naming checks are complete.
