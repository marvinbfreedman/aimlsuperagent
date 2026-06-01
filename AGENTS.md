# AiML SuperAgent Operating Contract

This file is the behavior and operation contract for AI coding assistants working in this repository.

## Mission

Build a public-ready, model-agnostic framework that teaches AI coding assistants how to operate real software projects over time.

The framework must be:

- practical enough to use immediately
- rigorous enough for production projects
- small enough to avoid context bloat
- clear enough for developers to trust

## Working Rules

1. Read `REPO_SOURCE_OF_TRUTH.json` before making structural claims about this repo.
2. Read `WORKING_NOTES.md` only when present and directly relevant.
3. Prefer targeted search over loading broad folders.
4. Do not add secrets, tokens, private URLs, account IDs, or credential values to examples.
5. Keep examples generic unless explicitly marked as fictional.
6. Make small diffs with a clear reason.
7. Run the fastest meaningful verification after changes.
8. Update durable notes only when a fact will help future work.

## Context Minimizer Rules

Load only what the current task needs.

Do not load these by default:

- `.git`
- `node_modules`
- `dist`
- `build`
- `.next`
- `coverage`
- generated files
- old logs
- archived incidents

Search before reading:

```bash
rg --files
rg -n "keyword"
```

## Secret Safety

Allowed in docs:

- environment variable names
- credential roles
- setup locations
- placeholder values such as `YOUR_API_KEY`

Never store:

- actual API keys
- access tokens
- refresh tokens
- passwords
- private keys
- customer PII
- private database URLs

## Verification Standard

For documentation changes:

- run the checker
- inspect generated examples when changed

For script changes:

- run the script on this repo
- run at least one negative or edge case when practical

For release changes:

- confirm repo status
- confirm private/public state before publication
- confirm no secrets are present

