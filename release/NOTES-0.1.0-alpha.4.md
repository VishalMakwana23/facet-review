# Facet Review 0.1.0-alpha.4

## Highlights

- Publishes through GitHub Actions with npm trusted publishing and provenance.
- Pins npm 11.19.1 in the release job so the OIDC workflow meets npm's trusted-publisher requirement.
- Keeps prerelease publication on the `alpha` distribution tag.

## Compatibility

Node.js 22.14 or newer is required. The standalone CLI remains dependency-free at runtime.

## Known limits

Universal plugin-directory review, independent human preference testing, and hands-on screen-reader acceptance remain pending. The package does not automatically register the bundled skill with Codex.
