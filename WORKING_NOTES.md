# Working Notes

## Current State

- Repository is private.
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

- Whether to publish as a GitHub-only framework or an npm starter package.
- Whether to add model-specific adapter files for Claude, Codex, Cursor, and Gemini in separate folders.

## Decisions

- License set to MIT while repository remains private. This preserves private development while preparing clean public reuse terms.
- Package name prepared as `@aimlsuperagent/agent`, but `private:true` remains as a safety brake until npm scope ownership and private package access are confirmed.
