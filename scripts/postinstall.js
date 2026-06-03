#!/usr/bin/env node

if (process.env.CI || process.env.AIMLSUPERAGENT_NO_POSTINSTALL) {
  process.exit(0);
}

console.log(`
AiML SuperAgent installed.

Next steps:
  npx @aimlsuperagent/agent init .
  npx @aimlsuperagent/agent check .

Then tell your AI assistant:
  Read AGENTS.md, REPO_SOURCE_OF_TRUTH.json, and WORKING_NOTES.md first.
  Use them as project operating context before editing code.

Docs:
  https://github.com/marvinbfreedman/aimlsuperagent

To hide this message:
  AIMLSUPERAGENT_NO_POSTINSTALL=1 npm install
`);
