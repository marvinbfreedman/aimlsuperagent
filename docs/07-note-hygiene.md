# Note Hygiene

Notes are useful only when they reduce future work.

## Keep

- durable project facts
- surprising production behavior
- deployment history
- incident outcomes
- known stale credentials
- exact verification commands
- decisions that prevent future mistakes

## Remove Or Archive

- resolved logs
- speculative guesses
- duplicate notes
- stale TODOs
- one-off command output
- old screenshots
- copied documentation

## Compression Pattern

Turn raw logs into a useful memory:

```text
Observed:
Route /api/catalog/sync returned 413 for large payloads.

Cause:
Payload exceeded platform body limit.

Fix:
Chunk upload into product batches.

Verified:
227 products and 1068 variants synced on 2026-05-31.
```

## Note Review Cadence

For active projects:

- review `WORKING_NOTES.md` weekly
- archive resolved incidents monthly
- update `REPO_SOURCE_OF_TRUTH.json` whenever production ownership changes
- prune logs as soon as they stop helping

