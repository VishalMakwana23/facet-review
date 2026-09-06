# Facet wire protocol quick reference

Read this file when creating an artifact, reading feedback, or applying a revision.

## Intent tuple (`fi1`, preferred for new work)

```json
["fi1", "artifact-id", "Title", ["review", "decide"], [
  ["section", "Context", "Why this decision matters."],
  ["decision", "Decision", "Choose one.", {"options":["Approve","Revise"]}]
]]
```

Positions are format marker, artifact ID, title, capabilities, and nodes. Intent nodes are type name or type index, title, optional text, and optional data. The local compiler derives stable IDs and canonical defaults; duplicate headings receive deterministic numeric suffixes.

## Artifact tuple (`ft1`)

```json
["ft1", "artifact-id", 0, "Title", "p", ["annotate section"], [
  ["stable-node-id", 0, "Section title", "Section text", 0]
]]
```

Artifact positions are format marker, artifact ID, revision, title, theme (`p`), capabilities, and root nodes.

Node positions are stable ID, node-type index, title or `0`, text or `0`, data object or `0`, and optional child-node array.

Node-type indexes are append-only:

| Index | Type | Index | Type |
|---:|---|---:|---|
| 0 | section | 11 | table |
| 1 | callout | 12 | code |
| 2 | metric | 13 | diff |
| 3 | timeline | 14 | citation |
| 4 | checklist | 15 | image |
| 5 | decision | 16 | risk |
| 6 | status | 17 | chart |
| 7 | dependency | 18 | filter |
| 8 | diagram | 19 | navigation |
| 9 | legend | 20 | persona |
| 10 | comparison | 21 | progress |

For decisions, use `{"options":["Approve","Revise"]}` as node data. Tables use `headers` and `rows`; every chart requires a textual `summary`; diagrams require a textual `summary` and navigable `items`. See `visualizations.md` for specialized chart shapes.

## Patch tuple (`fp1`)

```json
["fp1", "artifact-id", 0, 1, [
  ["s", "stable-node-id", 12, 0, "added text"]
]]
```

Patch positions are format marker, artifact ID, base revision, next revision, and operations. Advance exactly one revision.

Operations:

- `["t", id, text]` — replace node text.
- `["s", id, start, deleteCount, text]` — splice node text.
- `["d", id, key, jsonValue]` — set one data field.
- `["i", parentIdOr0, index, canonicalNode]` — insert a node.
- `["m", id, parentIdOr0, index]` — move a node.

## Local commands

```text
facet open artifact.facet.json
facet compile intent.fi1.json
facet lint artifact.facet.json
facet render artifact.facet.json
facet resume <session-id>
facet poll <session-id> [--after <submission-sequence>]
facet inbox <session-id>
facet apply <session-id> revision.patch.json
facet resolve-comment <session-id> <comment-id>
facet resolve <session-id>
facet export <session-id> review-bundle
facet mcp
```

Pass the same `--data-dir` to commands when the session uses a non-default data directory.

`facet poll` marks the agent as listening and waits silently until the reviewer presses **Send to Agent**. It returns one compact submission tuple:

```json
["fs1","artifact-id",1,7,0,[["comment-id","node-id","requested change",0]],[]]
```

Positions are format marker, artifact ID, artifact revision, submission sequence, end flag (`0` continue, `1` end), open comments, and recorded decisions. Start the next poll with `--after 7` after handling this example.
