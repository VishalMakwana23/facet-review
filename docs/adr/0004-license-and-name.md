# ADR-0004: License and provisional naming

- Status: Accepted with provisional product name
- Date: 2026-09-04
- Owners: repository owner

## Context

The local core should be broadly reusable while preserving clear patent terms. The Facet name and proposed npm scope are not yet reserved.

## Decision

License the repository under Apache-2.0. Use Facet and `@facet-review/*` only as development identifiers until npm ownership and trademark checks are complete. Keep all workspaces private meanwhile.

## Consequences

Contributors have explicit license terms. Public documentation must not imply ownership of the final brand before clearance.

## Verification

The repository contains the Apache-2.0 license, package manifests declare it, and every workspace remains private.
