# AiML SuperAgent And CLAUDE.md

A `CLAUDE.md` file can teach an assistant how to behave.

AiML SuperAgent teaches an assistant how to operate a real project over time.

## The Behavior Layer

The viral `CLAUDE.md` pattern is strong because it captures obvious engineering discipline:

- think before coding
- keep changes simple
- make surgical edits
- define success criteria
- verify the result

That should remain the baseline.

## The Missing Operating Layer

Behavior rules do not answer:

- Which repository owns production?
- Which deployment is live?
- Which env var is stale?
- Which logs are resolved history?
- Which notes are safe to trust?
- Which files should not be loaded by default?
- Which proof is meaningful for this task?
- Which credential names are safe to document?

AiML SuperAgent adds that layer.

## Practical Difference

Behavior rule:

```text
Do not make unnecessary changes.
```

Operating rule:

```text
Before changing this route, confirm which backend is live, check the deployment log, inspect only the route and config files, avoid stale notes, patch the smallest diff, run the route probe, then update durable memory only if the production fact changed.
```

## Positioning

AiML SuperAgent is not a replacement for `CLAUDE.md`.

It is the next layer after it:

- use `CLAUDE.md` for session behavior
- use AiML SuperAgent for project memory, verification, deployment discipline, secret safety, and context minimization

