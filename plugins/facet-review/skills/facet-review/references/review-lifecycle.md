# Review lifecycle

Explore enables local artifact controls. Review enables section/text selection and comments while disabling artifact actions. Decide enables declared choices with confirmation before submission. The desktop command palette uses Ctrl/Cmd+K; the mobile Feedback button opens a keyboard-contained sheet.

## Anchor integrity

Comments retain the original revision and quote. Text offsets are UTF-16 offsets into `node.text` only, not headings or rendered HTML. Code anchors use one-based inclusive lines from `data.code` (or `data.value`) and quote complete lines. Selections are limited to 2,000 characters; select the section for longer feedback.

Do not assume an old selection still matches after a patch. The viewer labels stale/orphaned anchors and preserves their original quote. Re-read the current artifact and feedback before implementing changes. New comments targeting an old revision are rejected. Drafts survive reload in session storage where available; after an artifact revision changes, the user must select a fresh anchor.

## Export and recovery

`facet export <session-id> <new-directory>` requires an absent destination under an existing parent. It does not overwrite existing directories. The bundle includes artifact, feedback, session snapshot, read-only HTML, and a final SHA-256 manifest from one sequence. A missing manifest indicates an incomplete export: preserve it for diagnosis and retry into a different directory. Exported HTML cannot save feedback or contact the local service.

If a save is not confirmed, inspect `facet inbox <session-id>` before retrying; do not assume it failed before reaching disk. No automatic mutation retries are performed.

An incomplete journal fails closed. `facet repair-journal <session-id> --confirm` backs up the original and removes only an unterminated unsnapshotted tail. Request authorization before repair. Do not remove transaction locks while a process may still own them. Stop the session processes, inspect the specific session, and follow the source repository's recovery guide; never delete the entire store as a repair.

Pass the same `--data-dir` for all commands. Static export does not support resume/import; keep the original local store for continued review.
