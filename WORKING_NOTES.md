# Working Notes

## Current State

- Repository is private at `github.com/marvinbfreedman/aimlsuperagent`.
- npm package is `@aimlsuperagent/agent` and uses restricted/private package access.
- Goal is a public-ready release candidate for AiML SuperAgent.
- Positioning: not a replacement for behavior files, but the next operating layer after them.
- Core differentiator: Context Minimizer, which reduces token waste by separating durable memory from active task context.
- Checker now validates unresolved placeholders, source-of-truth paths, context-bloat size limits, and optional release/strict gates.

## Release Requirements

- README must explain the framework in one minute.
- Docs must make the system usable without a course or video.
- Templates must be safe to copy into customer or open-source repos.
- Examples must not contain real secrets or private infrastructure.
- Checker must catch missing operating files and obvious secret leakage.

## Open Decisions

- Whether to make the npm package public after private-package testing is complete.
- Whether to add model-specific adapter files for Claude, Codex, Cursor, and Gemini in separate folders.

## Decisions

- License set to MIT while repository remains private. This preserves private development while preparing clean public reuse terms.
- Package metadata points at `github.com/marvinbfreedman/aimlsuperagent`.
- npm scope ownership and restricted package access are confirmed for `@aimlsuperagent/agent`.
