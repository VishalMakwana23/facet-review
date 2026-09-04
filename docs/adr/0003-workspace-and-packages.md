# ADR-0003: TypeScript npm-workspaces monorepo

- Status: Accepted
- Date: 2026-09-04
- Owners: engineering lead

## Context

Protocol, core behavior, renderer, CLI, applications, and optional hosting must evolve together while preserving explicit public boundaries.

## Decision

Use strict TypeScript with npm workspaces. Packages expose separate entry points and may depend only in this direction: apps/adapters → CLI or core → renderer/protocol. `protocol` has no dependency on UI, storage, or hosting.

## Consequences

Cross-package changes remain atomic and easy to test. Publishing remains disabled until the public-alpha phase.

## Verification

Root typecheck and foundation verification pass, and dependency-boundary checks will be added when real imports begin.
