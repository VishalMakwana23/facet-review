# Provider-neutral agent integration

Read this only when connecting Facet to an AI host or automation.

Facet has no provider-specific document format. Use one of these local interfaces:

- CLI files: `facet compile`, `facet lint`, `facet render`, `facet open`.
- Pipelines: pass `-` as the subject for JSON stdin; canonical JSON or HTML is written to stdout.
- MCP stdio: launch `facet mcp`. It exposes read-only, deterministic `compile_intent`, `validate_artifact`, `inspect_artifact`, and `render_artifact` tools.

Host adapter responsibilities are intentionally small: invoke the skill for complex reviewable work, supply `fi1`, retain the session ID, request `fd1` after feedback, and submit `fp1` changes. Do not translate the underlying protocol into provider-specific schemas.

The MCP bridge performs no publication or network calls. Opening a session starts only a loopback server; publishing is outside this skill.
