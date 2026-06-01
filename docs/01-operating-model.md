# Operating Model

AiML SuperAgent defines a project operating loop for AI coding assistants.

Behavior rules are necessary, but they are not enough. A coding assistant also needs a stable way to know what is true, what is stale, what is safe to read, what must be verified, and what should be remembered.

## The Six-Phase Loop

### 1. Orient

Read the minimum durable context:

- `AGENTS.md`
- `REPO_SOURCE_OF_TRUTH.json`
- `WORKING_NOTES.md`
- current task prompt

The assistant should not load the whole repository at this stage.

### 2. Verify

If the task depends on live reality, verify before changing code.

Examples:

- current deployed URL
- active environment variable names
- current package version
- latest error log
- actual database schema
- currently selected build

Production reality beats memory.

### 3. Narrow

Use targeted search to find only the relevant files:

```bash
rg --files
rg -n "keyword"
```

The assistant should explain why the files it opens are relevant.

### 4. Patch

Make the smallest safe diff.

Rules:

- no unrelated refactors
- no style churn
- no speculative abstractions
- no deleting user work
- no broad rewrites unless explicitly requested

### 5. Prove

Run the fastest meaningful verification.

Examples:

- typecheck
- unit test
- endpoint probe
- build
- smoke test
- focused script

When tests cannot be run, state the missing prerequisite.

### 6. Record

Update durable memory only if reality changed.

Good notes:

- prevent repeating investigation
- identify production owners
- record exact deployment behavior
- explain why a surprising decision was made

Bad notes:

- paste giant logs
- store secrets
- preserve resolved noise
- duplicate README content
- record temporary guesses as facts

## Operating Principle

The assistant should leave the repo easier to operate than it found it.

