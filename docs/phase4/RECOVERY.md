# Local transaction and journal recovery

Session reads, mutations, and repairs use an exclusive `transaction.lock` directory shared by CLI and server processes. Contention retries for up to three seconds. Locks are never stolen based on age: a slow active writer must not be mistaken for a crashed process. Network-filesystem locking and power-loss durability are not certified.

## Interrupted journal append

The journal requires newline-terminated records. An unterminated tail blocks subsequent reads and writes instead of silently corrupting the next event.

After inspecting the session error, explicitly request repair:

```text
facet repair-journal <session-id> --confirm --data-dir <store-directory>
```

In source development use `node packages/cli/dist/index.js` in place of `facet`.

Repair preserves the original bytes in a uniquely named `.backup` next to the journal, validates/replays the terminated prefix, and atomically replaces the journal. The returned JSON identifies the backup. It refuses to remove a snapshotted event or repair a sequence gap. Repeating repair on a healthy journal is a no-op. It does not repair a corrupted snapshot or interior record.

## Interrupted lock

A process terminated during a transaction can leave the lock directory behind. The error is deliberately blocking. Stop every process using this store and verify none remain before manually removing only the empty `transaction.lock` directory for the affected session. Resume or run journal repair afterward as appropriate. There is no automatic stale-lock removal; do not remove a live process's lock.

## Verification

`scripts/test-phase3.mjs` launches four independent writer processes, verifies all 32 unique comments and contiguous event sequences, and tests backup preservation, successful tail repair, refusal to discard a snapshotted event, and timeout without writes when an interrupted lock exists.
