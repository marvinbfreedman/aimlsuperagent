# Agent Operating Contract

## Project Mission

Describe the project in one paragraph.

## First Files To Read

1. `REPO_SOURCE_OF_TRUTH.json`
2. `WORKING_NOTES.md`
3. the current task prompt

## Working Rules

- Use targeted search before loading broad folders.
- Before changing code, confirm which backend, service, deployment, or environment is live when relevant.
- Check `DEPLOYMENT_LOG.md` and `PRODUCTION_CHECK.md` when the task depends on release or live behavior.
- Inspect the relevant source file before proposing or applying changes.
- Treat old notes as suspect until verified against source or production reality.
- Make small, task-traceable diffs.
- Verify production reality before changing code when the task depends on live state.
- Do not store secrets in notes, examples, commits, or logs.
- Keep generated notes commit-safe: names and roles are okay; credential values, local paths, customer data, and scratch-only notes are not.
- Update durable notes only when reality changed.

## Do Not Load By Default

- `.git`
- `node_modules`
- `.next`
- `dist`
- `build`
- `coverage`
- large logs
- generated files
- archived incidents

## Verification

Default proof command:

```bash
REPLACE_WITH_COMMAND
```

If the command cannot run, state why.
