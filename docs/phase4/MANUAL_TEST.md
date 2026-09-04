# Deferred human acceptance test

The user deferred human testing on 2026-09-04 to finish skill implementation first. No participants have been recorded. Development may continue; this checklist is not a test result.

## First maintainer session

Build and run `node packages/cli/dist/index.js open examples/phase3-demo.facet.json` from the repository. Keep its process running. Note the printed session ID; use it for subsequent commands.

1. Read the artifact in Explore. Try code copy/wrap and confirm comment/decision submission is disabled.
2. Switch to Review. Select a section by keyboard, then add feedback. Select text and code lines; verify the displayed quote matches the intended selection.
3. Switch to Decide, choose an option, cancel confirmation, then confirm. Verify only the confirmed decision appears in the inbox.
4. Keep a draft while an agent applies a patch. Check the update notice; reload after copying/saving the draft. Confirm stale selections retain the old quote rather than pointing at unrelated text.
5. Use Ctrl/Cmd+K, Escape, Tab and Shift+Tab. At phone width, open/close Feedback and confirm focus never moves behind the sheet.
6. Try real browser 200% zoom and a screen reader. Record any obscured controls, unlabeled actions, confusing announcements, or horizontal page overflow.
7. Stop the local process with a draft open. Attempt a save, verify failure is explicit, resume the session, and check the inbox before retrying.
8. Resolve handled comments. Export to a new directory. Open `review.html`; confirm comments, decisions and revision details are present and cannot be changed. Confirm a second export to the same directory fails without changing it.

Record browser/OS, task, expected result, actual result, screenshot if useful, severity, and whether assistance was required. Do not include secrets or personal content in shared reports.

## Later pilot

Use ten consenting participants for the original usability gate. Give each the review tasks without coaching, record completion and assistance separately, and retain concrete feedback. One maintainer session is useful but is not equivalent to ten independent participants. Revisit the original gate explicitly if the user chooses a smaller pilot; do not silently redefine it.
