# Context Minimizer

Context Minimizer is the central feature of AiML SuperAgent.

It reduces token waste by separating durable memory from active working context.

The goal is not smaller notes.

The goal is smaller active context.

## Problem

Large-context agents often fail because they read too much:

- stale notes
- resolved logs
- generated files
- unrelated code
- old screenshots
- duplicate repos
- package output

The model becomes slower, more expensive, and more confused.

## Strategy

AiML SuperAgent divides context into four layers.

### Layer 1: Durable Memory

Always small. Read first.

- `AGENTS.md`
- `REPO_SOURCE_OF_TRUTH.json`
- `WORKING_NOTES.md`

### Layer 2: Task Context

Provided by the user or issue.

- current request
- relevant error message
- direct file path
- screenshot or log excerpt

### Layer 3: Targeted Source Context

Found through search.

- files matching the symbol
- route handling the endpoint
- config controlling the behavior
- test covering the bug

### Layer 4: Proof Context

Generated during verification.

- focused test result
- build result
- endpoint response
- deployment status

Proof context should be summarized before being saved.

## Context Budget

Every task should answer:

1. What durable files are needed?
2. What exact source files are needed?
3. What logs or production checks are needed?
4. What can be skipped?

## Do Not Load By Default

- `node_modules`
- `.git`
- `.next`
- `dist`
- `build`
- `coverage`
- `DerivedData`
- huge logs
- old screenshots
- resolved incidents
- unrelated archives

## Search-First Commands

```bash
rg --files
rg -n "symbolOrKeyword"
rg -n "route|env|error|function"
```

## Note Compression Rule

When saving a finding, write the smallest future-useful version:

```text
Bad:
Pasted 700 lines of build logs.

Good:
Build failed because Next.js could not resolve package X from route Y.
Fixed by pinning package version Z. Verified with npm run build on 2026-05-31.
```

## Success Metric

Context Minimizer is working when future tasks need fewer broad searches and fewer repeated investigations.

