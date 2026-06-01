# Working Notes

## Current State

- Repository is public at `github.com/marvinbfreedman/aimlsuperagent`.
- npm package is public at `@aimlsuperagent/agent`.
- Goal is a public release candidate for AiML SuperAgent.
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

- Whether to add model-specific adapter files for Claude, Codex, Cursor, and Gemini in separate folders.

## Decisions

- License set to MIT for public reuse.
- Package metadata points at `github.com/marvinbfreedman/aimlsuperagent`.
- npm package public access is confirmed for `@aimlsuperagent/agent`.
