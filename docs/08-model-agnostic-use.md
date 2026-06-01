# Model-Agnostic Use

AiML SuperAgent is not tied to one model or vendor.

The framework can be used with:

- Claude
- GPT-5.5
- Codex
- Cursor
- Perplexity
- Gemini
- local models
- future coding assistants

## Why Model-Agnostic Matters

Models change quickly. Project operation should not.

The stable layer should be:

- memory structure
- verification loop
- secret policy
- deployment discipline
- note hygiene
- context minimization

## Adapter Pattern

Different tools can read different files:

- `AGENTS.md` for general coding agents
- `CLAUDE.md` for Claude-specific behavior
- `.cursor/rules` for Cursor
- local skill files for specialized workflows

AiML SuperAgent can generate or coexist with those files. The source of truth remains the project memory, not the vendor-specific wrapper.

## Prompt Starter

Use this with any coding assistant:

```text
Follow AiML SuperAgent for this task.
Read AGENTS.md, REPO_SOURCE_OF_TRUTH.json, and only the relevant working notes.
Use targeted search before loading broad folders.
Verify production reality when the task depends on live state.
Make the smallest safe diff.
Run the fastest meaningful proof.
Update durable notes only if reality changed.
```

