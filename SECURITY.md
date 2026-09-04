# Security Policy and Threat Model v0

## Supported versions

No public version is supported yet. This document defines the mandatory baseline for implementation.

## Reporting

Do not publish a suspected vulnerability with exploit details in a public issue. Until a dedicated security address is configured, contact the repository owner privately and include impact, affected inputs, reproduction steps, and a proposed mitigation if known.

## Security invariants

1. Local sessions bind to loopback only by default.
2. Every browser session uses an unguessable, short-lived secret and strict origin validation.
3. All artifacts are untrusted input and are validated before storage or rendering.
4. The core renderer executes no artifact-provided JavaScript.
5. The viewer requires no remote runtime assets; offline behavior is a tested property.
6. Hosted sharing is an optional adapter and cannot become necessary for local review.
7. Diagnostics are off by default and must redact content, paths, secrets, and identifiers.
8. Annotation and decision events are append-only at rest; corrections create new events.

## Trust boundaries

| Boundary | Principal risk | Required control |
|---|---|---|
| Agent/SDK → protocol | Malformed, oversized, recursive, or deceptive content | Versioned schema, depth/size limits, URL policy, deterministic validation |
| Protocol → renderer | Script injection or unsafe HTML/SVG | Allowlisted components and attributes, escaping, CSP, no `eval` |
| Browser → local daemon | Cross-origin request or session theft | Loopback binding, origin checks, random session secret, CSRF protection |
| Filesystem import/export | Path traversal, overwrite, secret leakage | Canonical path checks, explicit targets, safe names, atomic writes |
| Assets | Tracking, decompression bombs, hostile media | MIME verification, byte/pixel limits, local proxy or bundling |
| Plugins | Privilege escalation and supply-chain compromise | Signed manifest, explicit capabilities, sandbox, no unrestricted core access |
| Hosted sharing | Tenant leakage, link guessing, retention errors | Tenant isolation, encryption, expiry/revoke, audit, deletion verification |
| Diagnostics | Accidental private-content collection | Opt-in, minimization, local preview, redaction, documented retention |

## Initial abuse cases

- An artifact attempts to inject script through prose, code, SVG, URLs, or component properties.
- A malicious page attempts to call an active local Facet daemon from another origin.
- A deeply nested artifact exhausts memory or blocks the renderer.
- A patch targets a different artifact version or mutates immutable history.
- An imported bundle reads or overwrites files outside the selected path.
- A share recipient retains access after the owner revokes a link.
- A plugin declares a harmless capability but invokes network or filesystem access.

## Verification required before public alpha

- Schema fuzzing and property tests for patch/version invariants.
- CSP tests covering script, style, image, font, frame, and connection sources.
- Loopback and cross-origin tests on supported operating systems.
- Dependency and release-provenance checks.
- A documented response, revocation, upgrade, and rollback exercise.
